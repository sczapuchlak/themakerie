import "server-only";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { BUCKET, isUuid } from "./constants";
import { escapeLike, PAGE_SIZE, type LibraryQuery } from "./query";

/**
 * Pattern Library data access. Every function verifies the authorized
 * owner first, then queries with the owner's own session so row-level
 * security applies to every read.
 */

type Tables = Database["public"]["Tables"];
type Views = Database["public"]["Views"];
export type PatternRow = Tables["patterns"]["Row"];
export type PatternOverview = Views["pattern_overview"]["Row"];
export type FolderOverview = Views["folder_overview"]["Row"];
export type SourceRow = Tables["pattern_sources"]["Row"];
export type ProjectRow = Tables["projects"]["Row"];
export type SectionRow = Tables["pattern_sections"]["Row"];
export type StepRow = Tables["pattern_steps"]["Row"];

async function session() {
  const owner = await requireOwner();
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase is not configured");
  return { owner, supabase };
}
type Client = Awaited<ReturnType<typeof session>>["supabase"];

/** Short-lived signed URLs for private files (covers, photos, PDFs). */
export async function signPaths(supabase: Client, paths: (string | null | undefined)[], seconds = 3600) {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  const map = new Map<string, string>();
  if (!unique.length) return map;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(unique, seconds);
  for (const item of data ?? []) if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
  return map;
}

/* ------------------------------------------------------------ crafts */

export async function getCrafts() {
  const { supabase } = await session();
  const { data } = await supabase.from("crafts").select("slug, name").order("sort_order");
  return data ?? [];
}

/* ----------------------------------------------------------- folders */

export async function getFolders(): Promise<FolderOverview[]> {
  const { supabase } = await session();
  const { data, error } = await supabase.from("folder_overview").select("*").order("sort_order").order("name");
  if (error) throw error;
  return data ?? [];
}

/** Root → folder chain for breadcrumbs. */
export function folderPath(folders: FolderOverview[], id: string | null) {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const path: FolderOverview[] = [];
  let current = id ? byId.get(id) : undefined;
  while (current && path.length < 20) {
    path.unshift(current);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return path;
}

/* ----------------------------------------------------- library landing */

export type ActiveProject = {
  id: string;
  name: string;
  status: string;
  progress: number | null;
  last_worked_at: string | null;
  coverUrl: string | null;
  /** Finished-session time (corrections replace timer time). */
  trackedSeconds: number;
  sessionCount: number;
  pattern: { id: string; title: string; craft: string } | null;
};

export type RecentPattern = {
  id: string;
  title: string;
  craft: string;
  designer: string | null;
  favorite: boolean;
  project_count: number;
  active_count: number;
  coverUrl: string | null;
};

/** Up to three cover previews per collection, for the folder objects. */
export type CollectionPreviews = { all: string[]; unsorted: string[]; folders: Record<string, string[]> };

export async function getLibraryHome() {
  const { supabase } = await session();
  const [folders, all, unsorted, active, recentRows, coverRows] = await Promise.all([
    supabase.from("folder_overview").select("*").order("sort_order").order("name"),
    supabase.from("patterns").select("id", { count: "exact", head: true }).is("archived_at", null),
    supabase.from("patterns").select("id", { count: "exact", head: true }).is("archived_at", null).is("folder_id", null),
    supabase
      .from("projects")
      .select("id, name, status, progress, last_worked_at, updated_at, cover_path, pattern:patterns(id, title, craft, cover_path)")
      .eq("status", "in_progress")
      .order("last_worked_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .limit(24),
    supabase
      .from("pattern_overview")
      .select("id, title, craft, designer, cover_path, favorite, project_count, active_count")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("patterns").select("folder_id, cover_path").is("archived_at", null).not("cover_path", "is", null).order("created_at", { ascending: false }).limit(300),
  ]);
  if (folders.error) throw folders.error;

  const projects = active.data ?? [];
  const folderRows = folders.data ?? [];

  // Cover previews: newest first, rolled up to each top-level folder.
  const parent = new Map(folderRows.map((f) => [f.id, f.parent_id]));
  const topOf = (id: string) => {
    let cur = id;
    for (let i = 0; i < 50 && parent.get(cur); i++) cur = parent.get(cur)!;
    return cur;
  };
  const previews: { all: string[]; unsorted: string[]; folders: Record<string, string[]> } = { all: [], unsorted: [], folders: {} };
  for (const r of coverRows.data ?? []) {
    if (!r.cover_path) continue;
    if (previews.all.length < 3) previews.all.push(r.cover_path);
    if (!r.folder_id) {
      if (previews.unsorted.length < 3) previews.unsorted.push(r.cover_path);
    } else {
      const top = topOf(r.folder_id);
      const list = (previews.folders[top] ??= []);
      if (list.length < 3) list.push(r.cover_path);
    }
  }

  const [urls, tracked] = await Promise.all([
    signPaths(supabase, [
      ...projects.flatMap((p) => [p.cover_path, p.pattern?.cover_path]),
      ...(recentRows.data ?? []).map((r) => r.cover_path),
      ...previews.all,
      ...previews.unsorted,
      ...Object.values(previews.folders).flat(),
    ]),
    projects.length
      ? supabase.from("project_sessions").select("project_id, duration_seconds").in("project_id", projects.map((p) => p.id)).eq("status", "finished")
      : Promise.resolve({ data: [] as { project_id: string; duration_seconds: number | null }[] }),
  ]);
  const time = new Map<string, { s: number; n: number }>();
  for (const row of tracked.data ?? []) {
    const t = time.get(row.project_id) ?? { s: 0, n: 0 };
    t.s += row.duration_seconds ?? 0;
    t.n++;
    time.set(row.project_id, t);
  }
  const signed = (paths: string[]) => paths.map((p) => urls.get(p)).filter((u): u is string => Boolean(u));

  const inProgress: ActiveProject[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    progress: p.progress,
    last_worked_at: p.last_worked_at,
    coverUrl: urls.get(p.cover_path ?? "") ?? urls.get(p.pattern?.cover_path ?? "") ?? null,
    trackedSeconds: time.get(p.id)?.s ?? 0,
    sessionCount: time.get(p.id)?.n ?? 0,
    pattern: p.pattern ? { id: p.pattern.id, title: p.pattern.title, craft: p.pattern.craft } : null,
  }));

  return {
    folders: folderRows,
    allCount: all.count ?? 0,
    unsortedCount: unsorted.count ?? 0,
    inProgress,
    recent: (recentRows.data ?? []).map(
      (r): RecentPattern => ({
        id: r.id!,
        title: r.title!,
        craft: r.craft!,
        designer: r.designer,
        favorite: Boolean(r.favorite),
        project_count: r.project_count ?? 0,
        active_count: r.active_count ?? 0,
        coverUrl: urls.get(r.cover_path ?? "") ?? null,
      }),
    ),
    previews: {
      all: signed(previews.all),
      unsorted: signed(previews.unsorted),
      folders: Object.fromEntries(Object.entries(previews.folders).map(([k, v]) => [k, signed(v)])),
    } satisfies CollectionPreviews,
  };
}

/* ------------------------------------------------------- collections */

export type Scope = { kind: "all" } | { kind: "unsorted" } | { kind: "folder"; id: string };
export type PatternCard = PatternOverview & { coverUrl: string | null };

export async function getCollection(scope: Scope, q: LibraryQuery) {
  const { supabase } = await session();
  if (scope.kind === "folder" && !isUuid(scope.id)) notFound();

  let query = supabase.from("pattern_overview").select("*", { count: "exact" });
  query = q.archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (scope.kind === "unsorted") query = query.is("folder_id", null);
  if (scope.kind === "folder") query = query.eq("folder_id", scope.id);
  if (q.q) query = query.ilike("search_text", `%${escapeLike(q.q.toLowerCase())}%`);
  if (q.craft) query = query.eq("craft", q.craft);
  if (q.difficulty) query = query.eq("difficulty", q.difficulty);
  if (q.tag) query = query.contains("tags", [q.tag]);
  if (q.favorites) query = query.eq("favorite", true);
  if (q.activity === "active") query = query.gt("active_count", 0);
  if (q.activity === "finished") query = query.gt("finished_count", 0);
  if (q.activity === "none") query = query.eq("project_count", 0);

  switch (q.sort) {
    case "updated":
      query = query.order("updated_at", { ascending: false });
      break;
    case "title":
      query = query.order("title", { ascending: true });
      break;
    case "designer":
      query = query.order("designer", { ascending: true, nullsFirst: false }).order("title", { ascending: true });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }
  // Stable ordering for "show more" pagination.
  query = query.order("id", { ascending: true }).range(0, q.page * PAGE_SIZE - 1);

  const [{ data, count, error }, tagRows] = await Promise.all([
    query,
    supabase.from("patterns").select("tags").is("archived_at", null),
  ]);
  if (error) throw error;

  const rows = data ?? [];
  const urls = await signPaths(supabase, rows.map((r) => r.cover_path));
  const tags = [...new Set((tagRows.data ?? []).flatMap((r) => r.tags))].sort();

  return {
    rows: rows.map((r) => ({ ...r, coverUrl: urls.get(r.cover_path ?? "") ?? null })) as PatternCard[],
    total: count ?? rows.length,
    hasMore: (count ?? 0) > rows.length,
    tags,
  };
}

/* ------------------------------------------------------------ pattern */

export async function getPattern(id: string) {
  const { supabase } = await session();
  if (!isUuid(id)) notFound();

  const [pattern, sources, sections, steps, projects] = await Promise.all([
    supabase.from("patterns").select("*").eq("id", id).maybeSingle(),
    supabase.from("pattern_sources").select("*").eq("pattern_id", id).order("sort_order").order("created_at"),
    supabase.from("pattern_sections").select("*").eq("pattern_id", id).order("position"),
    supabase.from("pattern_steps").select("*, section:pattern_sections!inner(pattern_id)").eq("section.pattern_id", id).order("position"),
    supabase.from("projects").select("*").eq("pattern_id", id).order("created_at", { ascending: false }),
  ]);
  if (pattern.error) throw pattern.error;
  if (!pattern.data) notFound();

  const sourceRows = sources.data ?? [];
  const projectRows = projects.data ?? [];
  // Tracked time per project (finished sessions; corrections replace timer time).
  const tracked = new Map<string, { seconds: number; sessions: number }>();
  if (projectRows.length) {
    const { data: sessionRows } = await supabase
      .from("project_sessions")
      .select("project_id, duration_seconds, status")
      .in("project_id", projectRows.map((p) => p.id))
      .eq("status", "finished");
    for (const row of sessionRows ?? []) {
      const t = tracked.get(row.project_id) ?? { seconds: 0, sessions: 0 };
      t.seconds += row.duration_seconds ?? 0;
      t.sessions += 1;
      tracked.set(row.project_id, t);
    }
  }
  const urls = await signPaths(supabase, [
    pattern.data.cover_path,
    ...sourceRows.map((s) => s.storage_path),
    ...projectRows.map((p) => p.cover_path),
  ]);

  return {
    pattern: pattern.data,
    coverUrl: urls.get(pattern.data.cover_path ?? "") ?? null,
    sources: sourceRows.map((s) => ({ ...s, fileUrl: urls.get(s.storage_path ?? "") ?? null })),
    sections: (sections.data ?? []).map((section) => ({
      ...section,
      steps: (steps.data ?? []).filter((s) => s.section_id === section.id),
    })),
    projects: projectRows.map((p) => ({
      ...p,
      coverUrl: urls.get(p.cover_path ?? "") ?? null,
      trackedSeconds: tracked.get(p.id)?.seconds ?? 0,
      sessionCount: tracked.get(p.id)?.sessions ?? 0,
    })),
  };
}
export type PatternDetail = Awaited<ReturnType<typeof getPattern>>;

/** Likely duplicates by normalized link, file hash or title. */
export async function findDuplicates(input: {
  excludePatternId?: string;
  urlNormalized?: string[];
  sha256?: string[];
  titleNormalized?: string;
}) {
  const { supabase } = await session();
  const hits = new Map<string, { id: string; title: string; reason: string }>();

  const sourceFilters: string[] = [];
  for (const u of input.urlNormalized ?? []) sourceFilters.push(`url_normalized.eq."${u.replace(/"/g, "")}"`);
  for (const h of input.sha256 ?? []) if (/^[0-9a-f]{64}$/.test(h)) sourceFilters.push(`sha256.eq.${h}`);
  if (sourceFilters.length) {
    const { data } = await supabase
      .from("pattern_sources")
      .select("pattern_id, kind, pattern:patterns(id, title)")
      .or(sourceFilters.join(","));
    for (const row of data ?? []) {
      if (row.pattern && row.pattern.id !== input.excludePatternId)
        hits.set(row.pattern.id, {
          id: row.pattern.id,
          title: row.pattern.title,
          reason: row.kind === "pdf" || row.kind === "image" ? "same file" : "same link",
        });
    }
  }
  if (input.titleNormalized && input.titleNormalized.length >= 3) {
    const { data } = await supabase.from("patterns").select("id, title").ilike("title", `%${escapeLike(input.titleNormalized.split(" ")[0])}%`).limit(50);
    const { normalizeTitle } = await import("./url");
    for (const row of data ?? []) {
      if (row.id !== input.excludePatternId && normalizeTitle(row.title) === input.titleNormalized && !hits.has(row.id))
        hits.set(row.id, { id: row.id, title: row.title, reason: "same title" });
    }
  }
  return [...hits.values()];
}

/* ------------------------------------------------------------ project */

export async function getProject(id: string) {
  const { supabase } = await session();
  if (!isUuid(id)) notFound();

  const project = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (project.error) throw project.error;
  if (!project.data) notFound();
  const p = project.data;

  const [pattern, photos, sessions, sections, steps, completions, siblings] = await Promise.all([
    p.pattern_id ? supabase.from("patterns").select("id, title, craft, designer, cover_path").eq("id", p.pattern_id).maybeSingle() : null,
    supabase.from("project_photos").select("*").eq("project_id", id).order("created_at"),
    supabase.from("project_sessions").select("*").eq("project_id", id).order("started_at", { ascending: false }).limit(50),
    p.pattern_id ? supabase.from("pattern_sections").select("*").eq("pattern_id", p.pattern_id).order("position") : null,
    p.pattern_id
      ? supabase.from("pattern_steps").select("*, section:pattern_sections!inner(pattern_id)").eq("section.pattern_id", p.pattern_id).order("position")
      : null,
    supabase.from("project_step_completions").select("step_id").eq("project_id", id),
    p.pattern_id
      ? supabase.from("pattern_sources").select("id, kind, title, url, storage_path, file_name").eq("pattern_id", p.pattern_id).order("sort_order")
      : null,
  ]);

  const photoRows = photos.data ?? [];
  const sourceRows = siblings?.data ?? [];
  const urls = await signPaths(supabase, [
    p.cover_path,
    pattern?.data?.cover_path,
    ...photoRows.map((ph) => ph.storage_path),
    ...sourceRows.map((s) => s.storage_path),
  ]);
  const done = new Set((completions.data ?? []).map((c) => c.step_id));

  return {
    project: p,
    coverUrl: urls.get(p.cover_path ?? "") ?? urls.get(pattern?.data?.cover_path ?? "") ?? null,
    pattern: pattern?.data ?? null,
    photos: photoRows.map((ph) => ({ ...ph, url: urls.get(ph.storage_path) ?? null })),
    sessions: sessions.data ?? [],
    sources: sourceRows.map((s) => ({ ...s, fileUrl: urls.get(s.storage_path ?? "") ?? null })),
    sections: (sections?.data ?? []).map((section) => ({
      ...section,
      steps: (steps?.data ?? []).filter((s) => s.section_id === section.id).map((s) => ({ ...s, done: done.has(s.id) })),
    })),
  };
}
export type ProjectDetail = Awaited<ReturnType<typeof getProject>>;

/* --------------------------------------------------------------- home */

export type HomeFeatured = ActiveProject & {
  row: number;
  rowLabel: string;
  session: { status: string; active_seconds: number; resumed_at: string | null } | null;
};

/** Home: the library data plus the live state of the most recent project. */
export async function getHome() {
  const lib = await getLibraryHome();
  const { supabase } = await session();
  const top = lib.inProgress[0] ?? null;
  let featured: HomeFeatured | null = null;
  if (top) {
    const [counter, open] = await Promise.all([
      supabase.from("project_counters").select("value, name").eq("project_id", top.id).eq("is_main", true).maybeSingle(),
      supabase.from("project_sessions").select("status, active_seconds, resumed_at").eq("project_id", top.id).neq("status", "finished").maybeSingle(),
    ]);
    featured = { ...top, row: counter.data?.value ?? 0, rowLabel: counter.data?.name ?? "Rows", session: open.data ?? null };
  }
  return { ...lib, featured };
}
