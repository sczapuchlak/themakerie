import "server-only";
import { requireOwner } from "@/lib/auth/dal";
import { isUuid } from "@/lib/library/constants";
import { signPaths } from "@/lib/library/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Guide, NoteKind, ProgressMethod, Snapshot, Source } from "./model";

export async function workspaceClient() {
  const owner = await requireOwner();
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase is not configured");
  return { owner, supabase };
}
export type WorkspaceClient = Awaited<ReturnType<typeof workspaceClient>>["supabase"];

/** Everything Work Mode needs for one project, with fresh signed file URLs. */
export async function buildSnapshot(supabase: WorkspaceClient, projectId: string): Promise<Snapshot | null> {
  if (!isUuid(projectId)) return null;
  const { data: p, error } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (error) throw error;
  if (!p) return null;

  const patternId = p.pattern_id;
  const [pattern, sources, sections, steps, completions, counters, sessions, photos, notes, milestones, events, reader, bookmarks] =
    await Promise.all([
      patternId ? supabase.from("patterns").select("id, title, designer, craft").eq("id", patternId).maybeSingle() : null,
      patternId ? supabase.from("pattern_sources").select("*").eq("pattern_id", patternId).order("sort_order").order("created_at") : null,
      patternId ? supabase.from("pattern_sections").select("*").eq("pattern_id", patternId).order("position") : null,
      patternId
        ? supabase.from("pattern_steps").select("*, section:pattern_sections!inner(pattern_id)").eq("section.pattern_id", patternId).order("position")
        : null,
      supabase.from("project_step_completions").select("step_id").eq("project_id", projectId),
      supabase.from("project_counters").select("*").eq("project_id", projectId).order("position").order("created_at"),
      supabase.from("project_sessions").select("*").eq("project_id", projectId).order("started_at", { ascending: false }),
      supabase.from("project_photos").select("*").eq("project_id", projectId).order("created_at"),
      supabase.from("project_notes").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
      supabase.from("project_milestones").select("*").eq("project_id", projectId).order("position").order("created_at"),
      supabase.from("project_progress_events").select("*").eq("project_id", projectId).order("recorded_at"),
      supabase.from("project_reader_states").select("*").eq("project_id", projectId),
      supabase.from("project_bookmarks").select("*").eq("project_id", projectId).order("page"),
    ]);

  const sourceRows = sources?.data ?? [];
  const photoRows = photos.data ?? [];
  const urls = await signPaths(supabase, [...sourceRows.map((s) => s.storage_path), ...photoRows.map((ph) => ph.storage_path)], 6 * 3600);

  return {
    loadedAt: new Date().toISOString(),
    project: {
      id: p.id,
      name: p.name,
      status: p.status,
      progress: p.progress,
      progress_method: p.progress_method as ProgressMethod,
      progress_target: p.progress_target,
      progress_done: p.progress_done,
      unit_label: p.unit_label,
      progress_counter_id: p.progress_counter_id,
      notes: p.notes,
      size_colorway: p.size_colorway,
      started_on: p.started_on,
      finished_on: p.finished_on,
      last_worked_at: p.last_worked_at,
      workspace: (p.workspace ?? {}) as Snapshot["project"]["workspace"],
      pattern_id: p.pattern_id,
    },
    pattern: pattern?.data ?? null,
    sources: sourceRows.map(
      (s): Source => ({
        id: s.id,
        kind: s.kind as Source["kind"],
        title: s.title,
        url: s.url,
        storage_path: s.storage_path,
        file_name: s.file_name,
        mime_type: s.mime_type,
        size_bytes: s.size_bytes,
        page_count: s.page_count,
        sha256: s.sha256,
        fileUrl: urls.get(s.storage_path ?? "") ?? null,
      }),
    ),
    sections: (sections?.data ?? []).map((sec) => ({
      id: sec.id,
      title: sec.title,
      notes: sec.notes,
      position: sec.position,
      steps: (steps?.data ?? [])
        .filter((st) => st.section_id === sec.id)
        .map((st) => ({ id: st.id, body: st.body, row_start: st.row_start, row_end: st.row_end, repeat_count: st.repeat_count, position: st.position })),
    })),
    completedSteps: (completions.data ?? []).map((c) => c.step_id),
    counters: (counters.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      value: c.value,
      step: c.step,
      target: c.target,
      rollover: c.rollover,
      rollover_counter_id: c.rollover_counter_id,
      section_id: c.section_id,
      is_main: c.is_main,
      position: c.position,
    })),
    sessions: (sessions.data ?? []).map((s) => ({
      id: s.id,
      started_at: s.started_at,
      ended_at: s.ended_at,
      resumed_at: s.resumed_at,
      active_seconds: s.active_seconds,
      adjusted_seconds: s.adjusted_seconds,
      status: s.status as "active" | "paused" | "finished",
      note: s.note,
      accomplished: s.accomplished,
      progress_before: s.progress_before,
      progress_after: s.progress_after,
      units_before: s.units_before,
      units_after: s.units_after,
      client_updated_at: s.client_updated_at,
    })),
    photos: photoRows.map((ph) => ({
      id: ph.id,
      storage_path: ph.storage_path,
      url: urls.get(ph.storage_path) ?? null,
      session_id: ph.session_id,
      caption: ph.caption,
      file_name: ph.file_name,
      created_at: ph.created_at,
    })),
    notes: (notes.data ?? []).map((n) => ({
      id: n.id,
      kind: n.kind as NoteKind,
      body: n.body,
      session_id: n.session_id,
      pinned: n.pinned,
      created_at: n.created_at,
      updated_at: n.updated_at,
    })),
    milestones: (milestones.data ?? []).map((m) => ({ id: m.id, title: m.title, position: m.position, done_at: m.done_at, session_id: m.session_id })),
    progressEvents: (events.data ?? []).map((e) => ({
      id: e.id,
      session_id: e.session_id,
      recorded_at: e.recorded_at,
      method: e.method as ProgressMethod,
      percent: e.percent,
      done: e.done,
      target: e.target,
      note: e.note,
    })),
    readerStates: (reader.data ?? []).map((r) => ({
      source_id: r.source_id,
      page: r.page,
      zoom: r.zoom,
      fit: r.fit as "width" | "page" | "custom",
      scroll_left: r.scroll_left,
      scroll_top: r.scroll_top,
      guides: (r.guides ?? []) as Guide[],
    })),
    bookmarks: (bookmarks.data ?? []).map((b) => ({ id: b.id, source_id: b.source_id, page: b.page, y: b.y, label: b.label })),
  };
}
