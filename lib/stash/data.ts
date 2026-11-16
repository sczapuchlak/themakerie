import "server-only";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/dal";
import { isUuid } from "@/lib/library/constants";
import { signPaths } from "@/lib/library/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type Tables = Database["public"]["Tables"];
export type StashItemRow = Tables["stash_items"]["Row"];
export type StashOverview = Database["public"]["Views"]["stash_item_overview"]["Row"];
export type LotRow = Tables["stash_lots"]["Row"];
export type HoldingRow = Tables["stash_holdings"]["Row"];
export type LocationRow = Tables["stash_locations"]["Row"];
export type CollectionRow = Tables["stash_collections"]["Row"];
export type AllocationRow = Tables["stash_allocations"]["Row"];
export type WantRow = Tables["stash_wants"]["Row"];
export type KitRow = Tables["stash_kits"]["Row"];
export type MaterialReqRow = Tables["pattern_materials"]["Row"];

async function session() {
  const owner = await requireOwner();
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase is not configured");
  return { owner, supabase };
}
type Client = Awaited<ReturnType<typeof session>>["supabase"];

export type StashCard = StashOverview & { coverUrl: string | null; locationNames: string[] };

/** Path names for nested locations: "Closet › Top shelf". */
export function locationLabel(locations: Pick<LocationRow, "id" | "name" | "parent_id">[], id: string | null | undefined) {
  if (!id) return null;
  const byId = new Map(locations.map((l) => [l.id, l]));
  const parts: string[] = [];
  let cur = byId.get(id);
  for (let i = 0; cur && i < 20; i++) {
    parts.unshift(cur.name);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return parts.join(" › ") || null;
}

async function toCards(supabase: Client, rows: StashOverview[], locations: LocationRow[]): Promise<StashCard[]> {
  const ids = rows.map((r) => r.id!).filter(Boolean);
  const photos = ids.length ? await supabase.from("stash_photos").select("item_id, storage_path, created_at").in("item_id", ids).order("created_at") : { data: [] };
  const first = new Map<string, string>();
  for (const p of photos.data ?? []) if (!first.has(p.item_id)) first.set(p.item_id, p.storage_path);
  const paths = rows.map((r) => r.cover_path ?? first.get(r.id!) ?? null);
  const urls = await signPaths(supabase, paths);
  return rows.map((r, i) => ({
    ...r,
    coverUrl: urls.get(paths[i] ?? "") ?? null,
    locationNames: (r.location_ids ?? []).map((id) => locationLabel(locations, id)).filter((x): x is string => Boolean(x)),
  }));
}

export async function getStashOptions() {
  const { supabase } = await session();
  const [locations, collections, categories, projects] = await Promise.all([
    supabase.from("stash_locations").select("*").order("sort_order").order("name"),
    supabase.from("stash_collections").select("*").order("sort_order").order("name"),
    supabase.from("stash_categories").select("*").order("name"),
    supabase.from("projects").select("id, name, status").in("status", ["planned", "in_progress", "paused"]).order("updated_at", { ascending: false }).limit(100),
  ]);
  return {
    locations: locations.data ?? [],
    collections: collections.data ?? [],
    categories: categories.data ?? [],
    projects: projects.data ?? [],
  };
}

/* ------------------------------------------------------------- landing */

export async function getStashHome() {
  const { supabase } = await session();
  const [overview, wants, allocations, kits, options] = await Promise.all([
    supabase.from("stash_item_overview").select("*").is("archived_at", null).order("created_at", { ascending: false }).limit(500),
    supabase.from("stash_wants").select("id, list, status, price_cents, currency, project_id").in("status", ["open", "partial"]),
    supabase
      .from("stash_allocations")
      .select("id, item_id, kind, reserved_quantity, used_quantity, planned_quantity, measure, status, project:projects(id, name)")
      .in("status", ["planned", "active"])
      .order("updated_at", { ascending: false })
      .limit(60),
    supabase.from("stash_kits").select("id, name, color, project_id, location_id").order("updated_at", { ascending: false }).limit(12),
    getStashOptions(),
  ]);
  const rows = overview.data ?? [];
  const cards = await toCards(supabase, rows.slice(0, 500), options.locations);
  const byId = new Map(cards.map((c) => [c.id!, c]));

  const materials = cards.filter((c) => c.kind === "material");
  const tools = cards.filter((c) => c.kind === "tool");
  const lowStock = cards.filter((c) => c.low_stock_threshold != null && (c.quantity_total ?? 0) - (c.reserved_total ?? 0) <= c.low_stock_threshold);
  const reserved = (allocations.data ?? [])
    .filter((a) => a.kind === "material" ? (a.reserved_quantity ?? 0) > 0 : true)
    .map((a) => ({ ...a, item: byId.get(a.item_id) ?? null }))
    .filter((a) => a.item);
  const colorCounts = new Map<string, number>();
  for (const c of materials) for (const f of c.color_families ?? []) colorCounts.set(f, (colorCounts.get(f) ?? 0) + 1);
  const categoryCounts = new Map<string, { family: string; category: string; n: number }>();
  for (const c of cards) {
    const k = `${c.family}:${c.category}`;
    const e = categoryCounts.get(k) ?? { family: c.family!, category: c.category!, n: 0 };
    e.n++;
    categoryCounts.set(k, e);
  }
  // Yarn totals only where units are comparable (known per-unit length).
  let yarnLengthCm = 0;
  let yarnUnknown = 0;
  for (const c of materials.filter((m) => m.family === "yarn")) {
    const known = (c.loose_length_cm ?? 0) + (c.unit_length_cm ? (c.full_units ?? 0) * c.unit_length_cm : 0);
    yarnLengthCm += known;
    if ((!c.unit_length_cm && (c.full_units ?? 0) > 0) || (c.partial_units ?? 0) > 0 || (c.loose_mass_dg ?? 0) > 0) yarnUnknown++;
  }
  const openWants = wants.data ?? [];
  return {
    total: cards.length,
    materials: materials.length,
    tools: tools.length,
    recent: cards.slice(0, 10),
    favorites: cards.filter((c) => c.favorite).slice(0, 10),
    lowStock,
    reserved,
    colors: [...colorCounts.entries()].sort((a, b) => b[1] - a[1]),
    categories: [...categoryCounts.values()].sort((a, b) => b.n - a.n),
    yarn: { lengthCm: yarnLengthCm, skeinsWithoutLength: yarnUnknown, colourways: materials.filter((m) => m.family === "yarn").length },
    shoppingOpen: openWants.filter((w) => w.list === "shopping").length,
    wishlistOpen: openWants.filter((w) => w.list === "wishlist").length,
    kits: kits.data ?? [],
    options,
  };
}

/* -------------------------------------------------------------- browse */

export const STASH_SORTS = [
  { value: "recent", label: "Recently added" },
  { value: "name", label: "Name" },
  { value: "brand", label: "Brand" },
  { value: "available", label: "Most available" },
] as const;

export type StashQuery = {
  q: string;
  view: "all" | "materials" | "tools";
  family: string | null;
  category: string | null;
  color: string | null;
  location: string | null; // uuid | "none"
  collection: string | null;
  reserved: boolean;
  favorites: boolean;
  low: boolean;
  sort: (typeof STASH_SORTS)[number]["value"];
  layout: "gallery" | "list";
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
export function parseStashQuery(p: Record<string, string | string[] | undefined>): StashQuery {
  const view = one(p.view);
  const sort = one(p.sort);
  const location = one(p.location);
  return {
    q: (one(p.q) ?? "").trim().slice(0, 100),
    view: view === "materials" || view === "tools" ? view : "all",
    family: one(p.family)?.match(/^(yarn|thread|fabric|notion|tool|other)$/)?.[0] ?? null,
    category: one(p.category)?.slice(0, 60) || null,
    color: one(p.color)?.match(/^[a-z]{3,8}$/)?.[0] ?? null,
    location: location === "none" ? "none" : isUuid(location) ? location! : null,
    collection: isUuid(one(p.collection)) ? one(p.collection)! : null,
    reserved: one(p.reserved) === "1",
    favorites: one(p.favorites) === "1",
    low: one(p.low) === "1",
    sort: STASH_SORTS.some((s) => s.value === sort) ? (sort as StashQuery["sort"]) : "recent",
    layout: one(p.layout) === "list" ? "list" : "gallery",
  };
}

export async function browseStash(q: StashQuery) {
  const { supabase } = await session();
  const options = await getStashOptions();
  let query = supabase.from("stash_item_overview").select("*").is("archived_at", null);
  if (q.view !== "all") query = query.eq("kind", q.view === "tools" ? "tool" : "material");
  if (q.family) query = query.eq("family", q.family);
  if (q.category) query = query.eq("category", q.category);
  if (q.color) query = query.contains("color_families", [q.color]);
  if (q.collection) {
    // Include nested collections.
    const ids = descendants(options.collections, q.collection);
    query = query.in("collection_id", ids);
  }
  if (q.location === "none") query = query.is("location_ids", null);
  else if (q.location) query = query.overlaps("location_ids", descendants(options.locations, q.location));
  if (q.favorites) query = query.eq("favorite", true);
  if (q.reserved) query = query.gt("reserved_total", 0);
  if (q.q) {
    const term = q.q.toLowerCase().replace(/[%_\\]/g, (c) => `\\${c}`);
    query = query.ilike("search_text", `%${term}%`);
  }
  query =
    q.sort === "name"
      ? query.order("name")
      : q.sort === "brand"
        ? query.order("brand", { nullsFirst: false }).order("name")
        : q.sort === "available"
          ? query.order("quantity_total", { ascending: false })
          : query.order("created_at", { ascending: false });
  const { data, error } = await query.order("id").limit(300);
  if (error) throw error;
  let rows = data ?? [];
  if (q.low) rows = rows.filter((c) => c.low_stock_threshold != null && (c.quantity_total ?? 0) - (c.reserved_total ?? 0) <= c.low_stock_threshold);
  return { cards: await toCards(supabase, rows, options.locations), options };
}

function descendants(rows: { id: string; parent_id: string | null }[], id: string) {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const r of rows) {
      if (r.parent_id && out.has(r.parent_id) && !out.has(r.id)) {
        out.add(r.id);
        grew = true;
      }
    }
  }
  return [...out];
}

/* ---------------------------------------------------------------- item */

export async function getStashItem(id: string) {
  const { supabase } = await session();
  if (!isUuid(id)) notFound();
  const [item, lots, holdings, photos, movements, allocations, kitItems, options] = await Promise.all([
    supabase.from("stash_item_overview").select("*").eq("id", id).maybeSingle(),
    supabase.from("stash_lots").select("*").eq("item_id", id).order("created_at"),
    supabase.from("stash_holdings").select("*").eq("item_id", id).order("created_at"),
    supabase.from("stash_photos").select("*").eq("item_id", id).order("created_at"),
    supabase.from("stash_movements").select("*, project:projects(id, name)").eq("item_id", id).order("created_at", { ascending: false }).limit(60),
    supabase.from("stash_allocations").select("*, project:projects(id, name, status)").eq("item_id", id).order("created_at", { ascending: false }),
    supabase.from("stash_kit_items").select("*, kit:stash_kits(id, name)").eq("item_id", id),
    getStashOptions(),
  ]);
  if (!item.data) notFound();
  const urls = await signPaths(supabase, [item.data.cover_path, ...(photos.data ?? []).map((p) => p.storage_path)]);
  const photoList = (photos.data ?? []).map((p) => ({ ...p, url: urls.get(p.storage_path) ?? null }));
  return {
    item: item.data,
    coverUrl: urls.get(item.data.cover_path ?? "") ?? photoList[0]?.url ?? null,
    photos: photoList,
    lots: (lots.data ?? []).map((l) => ({
      ...l,
      locationName: locationLabel(options.locations, l.location_id),
      holdings: (holdings.data ?? []).filter((h) => h.lot_id === l.id),
    })),
    movements: movements.data ?? [],
    allocations: allocations.data ?? [],
    kits: kitItems.data ?? [],
    options,
  };
}
export type StashItemDetail = Awaited<ReturnType<typeof getStashItem>>;

/* ------------------------------------------------------------ shopping */

export async function getWants() {
  const { supabase } = await session();
  const [wants, options] = await Promise.all([
    supabase.from("stash_wants").select("*, project:projects(id, name)").neq("status", "dropped").order("status").order("priority").order("created_at", { ascending: false }),
    getStashOptions(),
  ]);
  return { wants: wants.data ?? [], options };
}

/* ---------------------------------------------------------------- kits */

export async function getKits() {
  const { supabase } = await session();
  const [kits, items, options] = await Promise.all([
    supabase.from("stash_kits").select("*, project:projects(id, name)").order("updated_at", { ascending: false }),
    supabase.from("stash_kit_items").select("kit_id, item_id, quantity, holding_id"),
    getStashOptions(),
  ]);
  const ids = [...new Set((items.data ?? []).map((i) => i.item_id))];
  const overview = ids.length ? await supabase.from("stash_item_overview").select("*").in("id", ids) : { data: [] };
  const cards = await toCards(supabase, overview.data ?? [], options.locations);
  const byId = new Map(cards.map((c) => [c.id!, c]));
  return {
    kits: (kits.data ?? []).map((k) => ({
      ...k,
      locationName: locationLabel(options.locations, k.location_id),
      items: (items.data ?? []).filter((i) => i.kit_id === k.id).map((i) => ({ ...i, card: byId.get(i.item_id) ?? null })),
    })),
    options,
  };
}

/* ------------------------------------------------------------ projects */

/** Everything a project uses, plus the pattern's suggested materials. */
export async function getProjectSupplies(projectId: string, patternId: string | null) {
  const { supabase } = await session();
  const [allocations, requirements, kits, wants, options] = await Promise.all([
    supabase.from("stash_allocations").select("*").eq("project_id", projectId).order("created_at"),
    patternId ? supabase.from("pattern_materials").select("*").eq("pattern_id", patternId).order("position") : Promise.resolve({ data: [] as MaterialReqRow[] }),
    supabase.from("stash_kits").select("id, name, location_id").eq("project_id", projectId),
    supabase.from("stash_wants").select("*").eq("project_id", projectId).neq("status", "dropped"),
    getStashOptions(),
  ]);
  const itemIds = [...new Set((allocations.data ?? []).map((a) => a.item_id))];
  const [overview, holdings] = await Promise.all([
    itemIds.length ? supabase.from("stash_item_overview").select("*").in("id", itemIds) : Promise.resolve({ data: [] as StashOverview[] }),
    itemIds.length ? supabase.from("stash_holdings").select("*, lot:stash_lots(dye_lot, location_id)").in("item_id", itemIds) : Promise.resolve({ data: [] }),
  ]);
  const cards = await toCards(supabase, overview.data ?? [], options.locations);
  const byId = new Map(cards.map((c) => [c.id!, c]));
  const holdingById = new Map((holdings.data ?? []).map((h) => [h.id, h]));
  return {
    allocations: (allocations.data ?? []).map((a) => ({
      ...a,
      item: byId.get(a.item_id) ?? null,
      holding: a.holding_id ? (holdingById.get(a.holding_id) ?? null) : null,
    })),
    requirements: requirements.data ?? [],
    kits: kits.data ?? [],
    wants: wants.data ?? [],
    options,
  };
}
export type ProjectSupplies = Awaited<ReturnType<typeof getProjectSupplies>>;

/** Picker data: items with their holdings, for "Add from stash". */
export async function getPickableStock() {
  const { supabase } = await session();
  const options = await getStashOptions();
  const [overview, holdings] = await Promise.all([
    supabase.from("stash_item_overview").select("*").is("archived_at", null).order("name").limit(500),
    supabase.from("stash_holdings").select("*, lot:stash_lots(dye_lot, location_id)").gt("quantity", 0),
  ]);
  const cards = await toCards(supabase, overview.data ?? [], options.locations);
  return cards.map((c) => ({
    ...c,
    holdings: (holdings.data ?? [])
      .filter((h) => h.item_id === c.id)
      .map((h) => ({ ...h, locationName: locationLabel(options.locations, h.lot?.location_id) })),
  }));
}
export type Pickable = Awaited<ReturnType<typeof getPickableStock>>;

export async function getPatternMaterials(patternId: string) {
  const { supabase } = await session();
  if (!isUuid(patternId)) return [];
  const { data } = await supabase.from("pattern_materials").select("id, kind, family, description, quantity_text").eq("pattern_id", patternId).order("position");
  return data ?? [];
}
