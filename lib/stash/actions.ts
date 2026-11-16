"use server";

import { refresh } from "next/cache";
import { requireOwner } from "@/lib/auth/dal";
import { BUCKET, FOLDER_COLORS, isUuid } from "@/lib/library/constants";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { CATEGORIES, FAMILIES, familiesFor, familyKind, normalizeCode, type EntryUnit, type Measure } from "./catalog";

/**
 * Stash mutations. Every action re-verifies the owner and runs with the
 * owner's session (RLS applies). Stock changes go through the stash_*
 * database functions with a client-generated id, so retries and double
 * taps never double-count.
 */

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string) => ({ ok: false as const, error });

async function ctx() {
  const owner = await requireOwner();
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase is not configured");
  return { owner, supabase };
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) || null : null);
const int = (v: unknown, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : null);
const FAMILY_VALUES: string[] = FAMILIES.map((f) => f.value);
const MEASURES: Measure[] = ["count", "mass", "length", "piece"];
const ENTRY_UNITS: EntryUnit[] = ["unit", "g", "oz", "m", "yd", "cm", "in", "piece"];
const COLORS: string[] = [...FOLDER_COLORS];
const dateOnly = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/** Database errors → plain language (our functions raise readable messages). */
function dbError(error: { code?: string; message?: string } | null, fallback: string) {
  if (!error) return null;
  if (error.code === "23514" || error.code === "22023") return fail(error.message ?? fallback);
  if (error.code === "P0002") return fail("That supply couldn't be found.");
  if (error.code === "23505") return fail("That already exists.");
  if (error.code === "23503") return fail("Something it refers to no longer exists.");
  return fail(fallback);
}

/* ---------------------------------------------------------------- items */

export type HoldingInput = {
  id?: string;
  measure: Measure;
  quantity: number;
  condition: "full" | "partial";
  amountKnown: boolean;
  entryUnit: EntryUnit;
  widthMm?: number | null;
  heightMm?: number | null;
  label?: string | null;
};
export type LotInput = {
  id?: string;
  dyeLot?: string | null;
  locationId?: string | null;
  purchasedOn?: string | null;
  source?: string | null;
  priceCents?: number | null;
  currency?: string | null;
  holdings: HoldingInput[];
};
export type ItemInput = {
  id: string;
  isNew: boolean;
  family: string;
  category: string;
  name: string;
  brand?: string | null;
  productLine?: string | null;
  colorCode?: string | null;
  colorName?: string | null;
  colorHexes?: string[];
  specs?: Record<string, string>;
  unitLabel?: string;
  unitMassDg?: number | null;
  unitLengthCm?: number | null;
  lowStockThreshold?: number | null;
  collectionId?: string | null;
  tags?: string[];
  favorite?: boolean;
  notes?: string | null;
  photos?: { path: string; fileName: string; mimeType: string; size: number }[];
  removedPhotoIds?: string[];
  lot?: LotInput | null;
};

function holdingRow(h: HoldingInput) {
  if (!MEASURES.includes(h.measure)) return null;
  const quantity = int(h.quantity, 0, 2_000_000_000);
  if (quantity === null) return null;
  return {
    ...(isUuid(h.id) ? { id: h.id } : {}),
    measure: h.measure,
    quantity: h.measure === "piece" ? Math.max(1, quantity) : quantity,
    condition: h.condition === "partial" ? "partial" : "full",
    amount_known: h.amountKnown !== false,
    entry_unit: ENTRY_UNITS.includes(h.entryUnit) ? h.entryUnit : "unit",
    width_mm: h.measure === "piece" ? int(h.widthMm, 1, 100_000) : null,
    height_mm: h.measure === "piece" ? int(h.heightMm, 1, 100_000) : null,
    label: text(h.label, 80),
  };
}

export async function saveItem(input: ItemInput): Promise<Result<{ id: string }>> {
  const { owner, supabase } = await ctx();
  if (!isUuid(input.id)) return fail("Invalid item.");
  if (!FAMILY_VALUES.includes(input.family)) return fail("Choose a kind of supply.");
  const name = text(input.name, 200);
  if (!name) return fail("Give it a name.");
  const category = text(input.category, 60) ?? CATEGORIES[input.family as keyof typeof CATEGORIES]?.[0] ?? "Other";
  const hexes = (input.colorHexes ?? []).filter((h) => /^#[0-9a-f]{6}$/i.test(h)).slice(0, 8);
  const specs: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.specs ?? {})) {
    if (/^[a-z_]{1,30}$/.test(k)) {
      const t = text(v, 200);
      if (t) specs[k] = t;
    }
  }
  const row = {
    id: input.id,
    kind: familyKind(input.family),
    family: input.family,
    category,
    name,
    brand: text(input.brand, 120),
    product_line: text(input.productLine, 120),
    color_code: normalizeCode(text(input.colorCode, 40)),
    color_name: text(input.colorName, 120),
    color_hexes: hexes,
    color_families: familiesFor(hexes),
    specs: specs as { [key: string]: Json },
    unit_label: text(input.unitLabel, 30) ?? (input.family === "fabric" ? "piece" : "unit"),
    unit_mass_dg: int(input.unitMassDg, 1, 100_000_000),
    unit_length_cm: int(input.unitLengthCm, 1, 1_000_000_000),
    low_stock_threshold: int(input.lowStockThreshold, 0, 1_000_000),
    collection_id: isUuid(input.collectionId) ? input.collectionId : null,
    tags: (input.tags ?? []).map((t) => t.slice(0, 40)).slice(0, 30),
    favorite: Boolean(input.favorite),
    notes: text(input.notes, 10000),
  };

  if (input.isNew) {
    const { error } = await supabase.from("stash_items").insert(row);
    const e = dbError(error, "Couldn't save this supply.");
    if (e) return e;
    // Every item starts with a lot, so stock always has a place.
    const lot = input.lot ?? { holdings: [] };
    const lotRes = await addLotInternal(supabase, input.id, lot);
    if (!lotRes.ok) return lotRes;
  } else {
    const { error } = await supabase.from("stash_items").update(row).eq("id", input.id);
    const e = dbError(error, "Couldn't save this supply.");
    if (e) return e;
  }

  // Photos: only paths inside this item's own folder are accepted.
  const prefix = `${owner.id}/stash/${input.id}/`;
  const newPhotos = (input.photos ?? []).filter((p) => typeof p.path === "string" && p.path.startsWith(prefix) && !p.path.includes(".."));
  if (newPhotos.length) {
    await supabase.from("stash_photos").insert(
      newPhotos.map((p) => ({ item_id: input.id, storage_path: p.path, file_name: text(p.fileName, 200), mime_type: text(p.mimeType, 100), size_bytes: int(p.size, 0, 200_000_000) })),
    );
  }
  const removed = (input.removedPhotoIds ?? []).filter(isUuid);
  if (removed.length) {
    const { data } = await supabase.from("stash_photos").delete().in("id", removed).eq("item_id", input.id).select("storage_path");
    const paths = (data ?? []).map((d) => d.storage_path);
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  }
  refresh();
  return { ok: true, id: input.id };
}

async function addLotInternal(supabase: Awaited<ReturnType<typeof ctx>>["supabase"], itemId: string, lot: LotInput): Promise<Result<{ lotId: string }>> {
  const lotRow = {
    ...(isUuid(lot.id) ? { id: lot.id } : {}),
    item_id: itemId,
    dye_lot: text(lot.dyeLot, 60),
    location_id: isUuid(lot.locationId) ? lot.locationId : null,
    purchased_on: dateOnly(lot.purchasedOn),
    source: text(lot.source, 200),
    price_cents: int(lot.priceCents, 0, 100_000_000),
    currency: typeof lot.currency === "string" && /^[A-Z]{3}$/.test(lot.currency) ? lot.currency : null,
  };
  const { data, error } = await supabase.from("stash_lots").insert(lotRow).select("id").single();
  const e = dbError(error, "Couldn't add that stock.");
  if (e || !data) return e ?? fail("Couldn't add that stock.");
  const holdings = (lot.holdings ?? []).map(holdingRow).filter((h): h is NonNullable<ReturnType<typeof holdingRow>> => Boolean(h));
  if (holdings.length) {
    const { error: hErr } = await supabase.from("stash_holdings").insert(holdings.map((h) => ({ ...h, lot_id: data.id, item_id: itemId })));
    const he = dbError(hErr, "Couldn't add that stock.");
    if (he) return he;
  }
  return { ok: true, lotId: data.id };
}

/** "Add more": a new purchase / dye lot for an existing item. */
export async function addLot(itemId: string, lot: LotInput): Promise<Result<{ lotId: string }>> {
  const { supabase } = await ctx();
  if (!isUuid(itemId)) return fail("Invalid item.");
  // Idempotent: a retried request with the same lot id is a no-op.
  if (isUuid(lot.id)) {
    const { data } = await supabase.from("stash_lots").select("id").eq("id", lot.id).maybeSingle();
    if (data) return { ok: true, lotId: data.id };
  }
  const r = await addLotInternal(supabase, itemId, lot);
  if (r.ok) refresh();
  return r;
}

export async function updateLot(lotId: string, patch: { dyeLot?: string | null; locationId?: string | null; notes?: string | null; source?: string | null }) {
  const { supabase } = await ctx();
  if (!isUuid(lotId)) return fail("Invalid batch.");
  const row: Record<string, unknown> = {};
  if ("dyeLot" in patch) row.dye_lot = text(patch.dyeLot, 60);
  if ("locationId" in patch) row.location_id = isUuid(patch.locationId) ? patch.locationId : null;
  if ("notes" in patch) row.notes = text(patch.notes, 2000);
  if ("source" in patch) row.source = text(patch.source, 200);
  const { error } = await supabase.from("stash_lots").update(row as never).eq("id", lotId);
  const e = dbError(error, "Couldn't update that batch.");
  if (e) return e;
  refresh();
  return { ok: true as const };
}

/** A new bucket in an existing lot — e.g. "38 g leftover" or a fabric offcut. */
export async function addHolding(lotId: string, itemId: string, h: HoldingInput): Promise<Result> {
  const { supabase } = await ctx();
  if (!isUuid(lotId) || !isUuid(itemId)) return fail("Invalid batch.");
  const row = holdingRow(h);
  if (!row) return fail("Enter an amount.");
  if (isUuid(h.id)) {
    const { data } = await supabase.from("stash_holdings").select("id").eq("id", h.id).maybeSingle();
    if (data) return { ok: true };
  }
  const { error } = await supabase.from("stash_holdings").insert({ ...row, lot_id: lotId, item_id: itemId });
  const e = dbError(error, "Couldn't add that stock.");
  if (e) return e;
  refresh();
  return { ok: true };
}

export async function deleteHolding(holdingId: string): Promise<Result> {
  const { supabase } = await ctx();
  if (!isUuid(holdingId)) return fail("Invalid stock.");
  const { error } = await supabase.from("stash_holdings").delete().eq("id", holdingId);
  const e = dbError(error, "Couldn't remove that stock.");
  if (e) return e;
  refresh();
  return { ok: true };
}

/** Add / remove / correct a quantity. opId makes it safe to retry. */
export async function changeStock(input: { opId: string; holdingId: string; kind: "add" | "remove" | "adjust"; delta: number; note?: string | null }): Promise<Result<{ quantity: number }>> {
  const { supabase } = await ctx();
  if (!isUuid(input.opId) || !isUuid(input.holdingId)) return fail("Invalid change.");
  const delta = int(input.delta, -2_000_000_000, 2_000_000_000);
  if (!delta) return fail("Enter an amount.");
  const { data, error } = await supabase.rpc("stash_change", { p_id: input.opId, p_holding: input.holdingId, p_kind: input.kind, p_delta: delta, p_note: text(input.note, 1000) ?? undefined });
  const e = dbError(error, "Couldn't change the quantity.");
  if (e) return e;
  refresh();
  return { ok: true, quantity: data?.[0]?.r_quantity ?? 0 };
}

export async function setItemFavorite(id: string, favorite: boolean): Promise<Result> {
  const { supabase } = await ctx();
  if (!isUuid(id)) return fail("Invalid item.");
  const { error } = await supabase.from("stash_items").update({ favorite }).eq("id", id);
  if (error) return fail("Couldn't update favourite.");
  refresh();
  return { ok: true };
}

export async function archiveItem(id: string, archived: boolean): Promise<Result> {
  const { supabase } = await ctx();
  if (!isUuid(id)) return fail("Invalid item.");
  const { error } = await supabase.from("stash_items").update({ archived_at: archived ? new Date().toISOString() : null }).eq("id", id);
  if (error) return fail("Couldn't update the item.");
  refresh();
  return { ok: true };
}

/** Deleting is refused while projects use the item; archive instead. */
export async function deleteItem(id: string): Promise<Result> {
  const { supabase } = await ctx();
  if (!isUuid(id)) return fail("Invalid item.");
  const { count } = await supabase.from("stash_allocations").select("id", { count: "exact", head: true }).eq("item_id", id);
  if (count) return fail("Projects use this supply — archive it instead to keep their history.");
  const { data: photos } = await supabase.from("stash_photos").select("storage_path").eq("item_id", id);
  const { error } = await supabase.from("stash_items").delete().eq("id", id);
  const e = dbError(error, "Couldn't delete this supply.");
  if (e) return e;
  const paths = (photos ?? []).map((p) => p.storage_path);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  refresh();
  return { ok: true };
}

/** Likely duplicates: same code+brand, or same name+colour. */
export async function findSimilarItems(input: { excludeId?: string; name?: string; brand?: string; colorCode?: string; colorName?: string }) {
  const { supabase } = await ctx();
  const code = normalizeCode(input.colorCode);
  let q = supabase.from("stash_items").select("id, name, brand, color_code, color_name").is("archived_at", null).limit(5);
  if (input.excludeId && isUuid(input.excludeId)) q = q.neq("id", input.excludeId);
  if (code) q = q.eq("color_code", code);
  else if (input.name && input.name.trim().length >= 3) q = q.ilike("name", input.name.trim().replace(/[%_\\]/g, ""));
  else return [];
  const { data } = await q;
  return (data ?? []).filter((d) => !input.brand || !d.brand || d.brand.toLowerCase() === input.brand.trim().toLowerCase());
}

/* ------------------------------------------------------- organisation */

export async function saveLocation(input: { id?: string; name: string; parentId?: string | null; notes?: string | null }): Promise<Result<{ id: string }>> {
  const { supabase } = await ctx();
  const name = text(input.name, 80);
  if (!name) return fail("Name the place.");
  const row = { name, parent_id: isUuid(input.parentId) ? input.parentId : null, notes: text(input.notes, 1000) };
  const res = isUuid(input.id)
    ? await supabase.from("stash_locations").update(row).eq("id", input.id).select("id").single()
    : await supabase.from("stash_locations").insert(row).select("id").single();
  const e = dbError(res.error, "Couldn't save that place.");
  if (e) return res.error?.code === "23505" ? fail("There's already a place with that name there.") : e;
  refresh();
  return { ok: true, id: res.data!.id };
}

export async function deleteLocation(id: string): Promise<Result> {
  const { supabase } = await ctx();
  if (!isUuid(id)) return fail("Invalid place.");
  // Children and stock move up to the parent; nothing is lost.
  const { data } = await supabase.from("stash_locations").select("parent_id").eq("id", id).maybeSingle();
  await supabase.from("stash_locations").update({ parent_id: data?.parent_id ?? null }).eq("parent_id", id);
  await supabase.from("stash_lots").update({ location_id: data?.parent_id ?? null }).eq("location_id", id);
  await supabase.from("stash_kits").update({ location_id: data?.parent_id ?? null }).eq("location_id", id);
  const { error } = await supabase.from("stash_locations").delete().eq("id", id);
  if (error) return fail("Couldn't delete that place.");
  refresh();
  return { ok: true };
}

export async function saveCollection(input: { id?: string; name: string; parentId?: string | null; color?: string | null }): Promise<Result<{ id: string }>> {
  const { supabase } = await ctx();
  const name = text(input.name, 80);
  if (!name) return fail("Name the collection.");
  const row = { name, parent_id: isUuid(input.parentId) ? input.parentId : null, color: input.color && COLORS.includes(input.color) ? input.color : null };
  const res = isUuid(input.id)
    ? await supabase.from("stash_collections").update(row).eq("id", input.id).select("id").single()
    : await supabase.from("stash_collections").insert(row).select("id").single();
  if (res.error) return res.error.code === "23505" ? fail("There's already a collection with that name there.") : (dbError(res.error, "Couldn't save that collection.") ?? fail("Couldn't save."));
  refresh();
  return { ok: true, id: res.data.id };
}

export async function deleteCollection(id: string): Promise<Result> {
  const { supabase } = await ctx();
  if (!isUuid(id)) return fail("Invalid collection.");
  const { data } = await supabase.from("stash_collections").select("parent_id").eq("id", id).maybeSingle();
  await supabase.from("stash_collections").update({ parent_id: data?.parent_id ?? null }).eq("parent_id", id);
  await supabase.from("stash_items").update({ collection_id: data?.parent_id ?? null }).eq("collection_id", id);
  const { error } = await supabase.from("stash_collections").delete().eq("id", id);
  if (error) return fail("Couldn't delete that collection.");
  refresh();
  return { ok: true };
}

export async function addCategory(family: string, name: string): Promise<Result> {
  const { supabase } = await ctx();
  const n = text(name, 60);
  if (!FAMILY_VALUES.includes(family) || !n) return fail("Name the category.");
  const { error } = await supabase.from("stash_categories").insert({ family, name: n });
  if (error && error.code !== "23505") return fail("Couldn't add that category.");
  return { ok: true };
}

/* ------------------------------------------------------------ projects */

export async function addAllocation(input: {
  projectId: string;
  itemId: string;
  holdingId?: string | null;
  plannedQuantity?: number | null;
  requirementId?: string | null;
  note?: string | null;
}): Promise<Result<{ id: string }>> {
  const { supabase } = await ctx();
  if (!isUuid(input.projectId) || !isUuid(input.itemId)) return fail("Invalid supply.");
  const { data: item } = await supabase.from("stash_items").select("kind").eq("id", input.itemId).maybeSingle();
  if (!item) return fail("Supply not found.");
  const holdingId = item.kind === "material" && isUuid(input.holdingId) ? input.holdingId : null;
  let measure: string | null = null;
  if (holdingId) {
    const { data: h } = await supabase.from("stash_holdings").select("measure").eq("id", holdingId).maybeSingle();
    measure = h?.measure ?? null;
  }
  const { data, error } = await supabase
    .from("stash_allocations")
    .insert({
      project_id: input.projectId,
      item_id: input.itemId,
      holding_id: holdingId,
      kind: item.kind,
      measure,
      planned_quantity: int(input.plannedQuantity, 0, 2_000_000_000),
      requirement_id: isUuid(input.requirementId) ? input.requirementId : null,
      note: text(input.note, 1000),
    })
    .select("id")
    .single();
  const e = dbError(error, "Couldn't add that to the project.");
  if (e) return e;
  refresh();
  return { ok: true, id: data!.id };
}

export async function reserveSupply(input: { opId: string; allocationId: string; delta: number }): Promise<Result<{ available: number }>> {
  const { supabase } = await ctx();
  if (!isUuid(input.opId) || !isUuid(input.allocationId)) return fail("Invalid change.");
  const delta = int(input.delta, -2_000_000_000, 2_000_000_000);
  if (!delta) return fail("Enter an amount.");
  const { data, error } = await supabase.rpc("stash_reserve", { p_id: input.opId, p_allocation: input.allocationId, p_delta: delta });
  const e = dbError(error, "Couldn't reserve that.");
  if (e) return e;
  refresh();
  return { ok: true, available: data?.[0]?.r_available ?? 0 };
}

export async function recordSupplyUse(input: { opId: string; allocationId: string; amount: number; note?: string | null }): Promise<Result> {
  const { supabase } = await ctx();
  if (!isUuid(input.opId) || !isUuid(input.allocationId)) return fail("Invalid change.");
  const amount = int(input.amount, 1, 2_000_000_000);
  if (!amount) return fail("Enter an amount.");
  const { error } = await supabase.rpc("stash_use", { p_id: input.opId, p_allocation: input.allocationId, p_amount: amount, p_note: text(input.note, 1000) ?? undefined });
  const e = dbError(error, "Couldn't record that.");
  if (e) return e;
  refresh();
  return { ok: true };
}

export async function returnLeftover(input: { opId: string; allocationId: string; measure: Measure; amount: number; amountKnown: boolean; note?: string | null }): Promise<Result> {
  const { supabase } = await ctx();
  if (!isUuid(input.opId) || !isUuid(input.allocationId)) return fail("Invalid change.");
  if (!["count", "mass", "length"].includes(input.measure)) return fail("Choose how to measure the leftover.");
  const amount = int(input.amount, 1, 2_000_000_000);
  if (!amount) return fail("Enter an amount.");
  const { error } = await supabase.rpc("stash_return_leftover", {
    p_id: input.opId,
    p_allocation: input.allocationId,
    p_measure: input.measure,
    p_amount: amount,
    p_amount_known: input.amountKnown,
    p_note: text(input.note, 1000) ?? undefined,
  });
  const e = dbError(error, "Couldn't return that.");
  if (e) return e;
  refresh();
  return { ok: true };
}

export async function updateAllocation(id: string, patch: { status?: string; plannedQuantity?: number | null; note?: string | null }): Promise<Result> {
  const { supabase } = await ctx();
  if (!isUuid(id)) return fail("Invalid supply.");
  const row: Record<string, unknown> = {};
  if (patch.status && ["planned", "active", "done", "returned"].includes(patch.status)) row.status = patch.status;
  if ("plannedQuantity" in patch) row.planned_quantity = int(patch.plannedQuantity, 0, 2_000_000_000);
  if ("note" in patch) row.note = text(patch.note, 1000);
  const { error } = await supabase.from("stash_allocations").update(row as never).eq("id", id);
  if (error) return fail("Couldn't update that supply.");
  refresh();
  return { ok: true };
}

/** Removing releases any reservation (history of use stays in the log). */
export async function removeAllocation(id: string): Promise<Result> {
  const { supabase } = await ctx();
  if (!isUuid(id)) return fail("Invalid supply.");
  const { data } = await supabase.from("stash_allocations").select("used_quantity").eq("id", id).maybeSingle();
  if (data && data.used_quantity > 0) {
    // Keep the record of what was used; just mark it finished.
    const { data: a } = await supabase.from("stash_allocations").select("reserved_quantity").eq("id", id).single();
    if (a && a.reserved_quantity > 0) await supabase.rpc("stash_reserve", { p_id: crypto.randomUUID(), p_allocation: id, p_delta: -a.reserved_quantity });
    await supabase.from("stash_allocations").update({ status: "done" }).eq("id", id);
  } else {
    const { error } = await supabase.from("stash_allocations").delete().eq("id", id);
    if (error) return fail("Couldn't remove that supply.");
  }
  refresh();
  return { ok: true };
}

export async function saveRequirement(input: { id?: string; patternId: string; kind: "material" | "tool"; family: string; description: string; quantityText?: string | null; notes?: string | null; position?: number }): Promise<Result<{ id: string }>> {
  const { supabase } = await ctx();
  if (!isUuid(input.patternId)) return fail("Invalid pattern.");
  const description = text(input.description, 300);
  if (!description) return fail("Describe the material.");
  const row = {
    pattern_id: input.patternId,
    kind: input.kind === "tool" ? "tool" : "material",
    family: FAMILY_VALUES.includes(input.family) ? input.family : "other",
    description,
    quantity_text: text(input.quantityText, 120),
    notes: text(input.notes, 1000),
    position: int(input.position, 0, 10_000) ?? 0,
  };
  const res = isUuid(input.id)
    ? await supabase.from("pattern_materials").update(row).eq("id", input.id).select("id").single()
    : await supabase.from("pattern_materials").insert(row).select("id").single();
  if (res.error) return fail("Couldn't save that material.");
  refresh();
  return { ok: true, id: res.data.id };
}

export async function deleteRequirement(id: string): Promise<Result> {
  const { supabase } = await ctx();
  if (!isUuid(id)) return fail("Invalid material.");
  await supabase.from("pattern_materials").delete().eq("id", id);
  refresh();
  return { ok: true };
}

/* ---------------------------------------------------------------- kits */

export async function saveKit(input: { id?: string; name: string; projectId?: string | null; locationId?: string | null; color?: string | null; notes?: string | null }): Promise<Result<{ id: string }>> {
  const { supabase } = await ctx();
  const name = text(input.name, 120);
  if (!name) return fail("Name the kit.");
  const row = {
    name,
    project_id: isUuid(input.projectId) ? input.projectId : null,
    location_id: isUuid(input.locationId) ? input.locationId : null,
    color: input.color && COLORS.includes(input.color) ? input.color : null,
    notes: text(input.notes, 2000),
  };
  const res = isUuid(input.id)
    ? await supabase.from("stash_kits").update(row).eq("id", input.id).select("id").single()
    : await supabase.from("stash_kits").insert(row).select("id").single();
  const e = dbError(res.error, "Couldn't save that kit.");
  if (e) return e;
  refresh();
  return { ok: true, id: res.data!.id };
}

export async function deleteKit(id: string): Promise<Result> {
  const { supabase } = await ctx();
  if (!isUuid(id)) return fail("Invalid kit.");
  await supabase.from("stash_kits").delete().eq("id", id);
  refresh();
  return { ok: true };
}

export async function addToKit(input: { kitId: string; itemId: string; holdingId?: string | null; quantity?: number | null; note?: string | null }): Promise<Result> {
  const { supabase } = await ctx();
  if (!isUuid(input.kitId) || !isUuid(input.itemId)) return fail("Invalid kit item.");
  const { error } = await supabase.from("stash_kit_items").insert({
    kit_id: input.kitId,
    item_id: input.itemId,
    holding_id: isUuid(input.holdingId) ? input.holdingId : null,
    quantity: int(input.quantity, 1, 2_000_000_000),
    note: text(input.note, 300),
  });
  if (error?.code === "23505") return fail("That's already in this kit.");
  const e = dbError(error, "Couldn't add that to the kit.");
  if (e) return e;
  refresh();
  return { ok: true };
}

export async function removeFromKit(kitItemId: string): Promise<Result> {
  const { supabase } = await ctx();
  if (!isUuid(kitItemId)) return fail("Invalid kit item.");
  await supabase.from("stash_kit_items").delete().eq("id", kitItemId);
  refresh();
  return { ok: true };
}

/* ------------------------------------------------- wishlist & shopping */

export type WantInput = {
  id?: string;
  list: "wishlist" | "shopping";
  family: string;
  name: string;
  brand?: string | null;
  color?: string | null;
  size?: string | null;
  neededQuantity?: number | null;
  unitLabel?: string | null;
  priceCents?: number | null;
  currency?: string | null;
  merchant?: string | null;
  url?: string | null;
  priority?: number;
  projectId?: string | null;
  itemId?: string | null;
  notes?: string | null;
};

export async function saveWant(input: WantInput): Promise<Result<{ id: string }>> {
  const { supabase } = await ctx();
  const name = text(input.name, 200);
  if (!name) return fail("What do you need?");
  const url = text(input.url, 2000);
  const row = {
    list: input.list === "wishlist" ? "wishlist" : "shopping",
    family: FAMILY_VALUES.includes(input.family) ? input.family : "other",
    name,
    brand: text(input.brand, 120),
    color: text(input.color, 120),
    size: text(input.size, 80),
    needed_quantity: int(input.neededQuantity, 1, 1_000_000),
    unit_label: text(input.unitLabel, 30),
    price_cents: int(input.priceCents, 0, 100_000_000),
    currency: typeof input.currency === "string" && /^[A-Z]{3}$/.test(input.currency) ? input.currency : null,
    merchant: text(input.merchant, 120),
    url: url && /^https?:\/\//i.test(url) ? url : null,
    priority: int(input.priority, 1, 3) ?? 2,
    project_id: isUuid(input.projectId) ? input.projectId : null,
    item_id: isUuid(input.itemId) ? input.itemId : null,
    notes: text(input.notes, 2000),
  };
  const res = isUuid(input.id)
    ? await supabase.from("stash_wants").update(row).eq("id", input.id).select("id").single()
    : await supabase.from("stash_wants").insert(row).select("id").single();
  const e = dbError(res.error, "Couldn't save that.");
  if (e) return e;
  refresh();
  return { ok: true, id: res.data!.id };
}

export async function setWantStatus(id: string, status: "open" | "dropped"): Promise<Result> {
  const { supabase } = await ctx();
  if (!isUuid(id)) return fail("Invalid item.");
  await supabase.from("stash_wants").update({ status }).eq("id", id);
  refresh();
  return { ok: true };
}

/**
 * Received a purchase: add it to the stash with minimal re-entry. Partial
 * deliveries keep the rest on the list. The lot id makes retries safe.
 */
export async function receiveWant(input: {
  wantId: string;
  lotId: string;
  quantity: number;
  measure: Measure;
  entryUnit: EntryUnit;
  locationId?: string | null;
  dyeLot?: string | null;
  priceCents?: number | null;
}): Promise<Result<{ itemId: string }>> {
  const { supabase } = await ctx();
  if (!isUuid(input.wantId) || !isUuid(input.lotId)) return fail("Invalid purchase.");
  const { data: want } = await supabase.from("stash_wants").select("*").eq("id", input.wantId).maybeSingle();
  if (!want) return fail("That list item is gone.");
  const { data: existingLot } = await supabase.from("stash_lots").select("item_id").eq("id", input.lotId).maybeSingle();
  if (existingLot) return { ok: true, itemId: existingLot.item_id };
  const amount = int(input.quantity, 1, 2_000_000_000);
  if (!amount) return fail("Enter how much arrived.");

  let itemId = want.item_id;
  if (!itemId) {
    itemId = crypto.randomUUID();
    const r = await saveItem({
      id: itemId,
      isNew: true,
      family: want.family,
      category: CATEGORIES[want.family as keyof typeof CATEGORIES]?.[0] ?? "Other supplies",
      name: want.name,
      brand: want.brand,
      colorName: want.color,
      specs: want.size ? { size: want.size } : {},
      unitLabel: want.unit_label ?? undefined,
      lot: null,
    });
    if (!r.ok) return r;
    // saveItem created an empty starter lot; remove it so the purchase lot is the only one.
    await supabase.from("stash_lots").delete().eq("item_id", itemId);
  }
  const lot = await addLotInternal(supabase, itemId, {
    id: input.lotId,
    dyeLot: input.dyeLot,
    locationId: input.locationId,
    purchasedOn: new Date().toISOString().slice(0, 10),
    source: want.merchant,
    priceCents: input.priceCents ?? want.price_cents,
    currency: want.currency,
    holdings: [{ measure: input.measure, quantity: amount, condition: "full", amountKnown: true, entryUnit: input.entryUnit }],
  });
  if (!lot.ok) return lot;
  const received = want.received_quantity + (input.measure === "count" ? amount : 1);
  const done = !want.needed_quantity || received >= want.needed_quantity;
  await supabase.from("stash_wants").update({ received_quantity: received, status: done ? "received" : "partial", item_id: itemId }).eq("id", want.id);
  refresh();
  return { ok: true, itemId };
}
