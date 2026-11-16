"use server";

import { randomUUID } from "node:crypto";
import { BUCKET, isUuid, PROJECT_STATUSES } from "@/lib/library/constants";
import type { Json } from "@/lib/supabase/database.types";
import { NOTE_KINDS, PROGRESS_METHODS, finishSession, type Op, type Session, type Snapshot } from "./model";
import { buildSnapshot, workspaceClient, type WorkspaceClient } from "./server";

/**
 * Applies queued Work Mode changes, in order, exactly once.
 *
 * Each op is idempotent (client UUIDs, event ids, last-write timestamps), so
 * a retry after a dropped connection never double-counts. Results per op:
 *   ok       applied (or already applied)
 *   merged   applied without losing anything, but differently than sent
 *            (e.g. a conflicting note edit was kept as a separate note)
 *   rejected invalid or no longer applicable; reported, never silent
 *   retry    temporary failure; this and later ops stay queued
 */
export type OpResult = { opId: string; status: "ok" | "merged" | "rejected" | "retry"; message?: string };
export type SyncResponse = { ok: true; results: OpResult[]; snapshot: Snapshot } | { ok: false; error: string };

const MAX_OPS = 500;
const STATUS_VALUES: string[] = PROJECT_STATUSES.map((s) => s.value);
const METHOD_VALUES: string[] = PROGRESS_METHODS.map((m) => m.value);
const NOTE_VALUES: string[] = NOTE_KINDS.map((k) => k.value);

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) || null : null);
const int = (v: unknown, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : null);
const iso = (v: unknown) => {
  if (typeof v !== "string") return null;
  const t = Date.parse(v);
  if (!Number.isFinite(t)) return null;
  // Client clocks drift; never accept times far in the future.
  return new Date(Math.min(t, Date.now() + 5 * 60_000)).toISOString();
};
const dateOnly = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const uuidOrNull = (v: unknown) => (isUuid(v) ? v : null);

class Retry extends Error {}

export async function syncWorkspace(projectId: string, ops: Op[]): Promise<SyncResponse> {
  const { owner, supabase } = await workspaceClient();
  if (!isUuid(projectId)) return { ok: false, error: "Project not found." };
  const { data: project } = await supabase.from("projects").select("id, pattern_id").eq("id", projectId).maybeSingle();
  if (!project) return { ok: false, error: "Project not found." };
  if (!Array.isArray(ops) || ops.length > MAX_OPS) return { ok: false, error: "Too many changes at once." };

  const results: OpResult[] = [];
  let halted = false;
  for (const op of ops) {
    const opId = typeof op?.opId === "string" ? op.opId : "";
    if (halted) {
      results.push({ opId, status: "retry" });
      continue;
    }
    try {
      const r = await applyServerOp(supabase, owner.id, projectId, op);
      results.push({ opId, ...r });
    } catch (e) {
      if (e instanceof Retry) {
        halted = true;
        results.push({ opId, status: "retry", message: e.message });
      } else {
        results.push({ opId, status: "rejected", message: "This change couldn't be applied." });
      }
    }
  }

  const snapshot = await buildSnapshot(supabase, projectId);
  if (!snapshot) return { ok: false, error: "Project not found." };
  return { ok: true, results, snapshot };
}

export async function refreshWorkspace(projectId: string): Promise<{ ok: true; snapshot: Snapshot } | { ok: false; error: string }> {
  const { supabase } = await workspaceClient();
  const snapshot = await buildSnapshot(supabase, projectId);
  return snapshot ? { ok: true, snapshot } : { ok: false, error: "Project not found." };
}

type Applied = { status: OpResult["status"]; message?: string };
const OK: Applied = { status: "ok" };
const rejected = (message: string): Applied => ({ status: "rejected", message });

/** Treat connection/timeouts and unknown server errors as retryable. */
function check(error: { code?: string; message?: string } | null, known: Record<string, string> = {}) {
  if (!error) return null;
  if (error.code && known[error.code]) return rejected(known[error.code]);
  if (error.code && /^(23|22|42|P0)/.test(error.code)) return rejected("This change couldn't be applied.");
  throw new Retry(error.message ?? "Temporary problem");
}

async function applyServerOp(supabase: WorkspaceClient, ownerId: string, projectId: string, op: Op): Promise<Applied> {
  if (!op || typeof op !== "object" || !isUuid(op.opId)) return rejected("Malformed change.");
  const at = iso(op.at) ?? new Date().toISOString();

  switch (op.type) {
    case "counter.event": {
      if (!isUuid(op.counterId) || (op.kind !== "add" && op.kind !== "set")) return rejected("Malformed counter change.");
      const amount = int(op.amount, -1_000_000, 1_000_000);
      if (amount === null) return rejected("Malformed counter change.");
      const { error } = await supabase.rpc("apply_counter_event", {
        p_id: op.opId,
        p_counter: op.counterId,
        p_kind: op.kind,
        p_amount: amount,
        p_at: at,
        p_session: uuidOrNull(op.sessionId) ?? undefined,
      });
      return check(error, { P0002: "That counter was deleted, so a change to it was dropped." }) ?? OK;
    }

    case "counter.upsert": {
      const c = op.counter;
      if (!c || !isUuid(c.id)) return rejected("Malformed counter.");
      const name = str(c.name, 60);
      if (!name) return rejected("Counters need a name.");
      const { data: existing } = await supabase.from("project_counters").select("project_id, is_main, client_updated_at").eq("id", c.id).maybeSingle();
      if (existing && existing.project_id !== projectId) return rejected("Counter belongs to another project.");
      if (existing && existing.client_updated_at > at) return OK; // a newer edit already won
      const row = {
        id: c.id,
        project_id: projectId,
        name,
        step: int(c.step, 1, 1000) ?? 1,
        target: int(c.target, 1, 1_000_000),
        rollover: Boolean(c.rollover) && Boolean(c.target),
        rollover_counter_id: uuidOrNull(c.rollover_counter_id),
        section_id: uuidOrNull(c.section_id),
        position: int(c.position, 0, 10_000) ?? 0,
        is_main: existing?.is_main ?? false,
        client_updated_at: at,
      };
      const { error } = await supabase.from("project_counters").upsert(row, { onConflict: "id" });
      return check(error, { "23514": "A counter link pointed outside this project and was ignored." }) ?? OK;
    }

    case "counter.delete": {
      if (!isUuid(op.id)) return rejected("Malformed counter.");
      const { error } = await supabase.from("project_counters").delete().eq("id", op.id).eq("project_id", projectId).eq("is_main", false);
      return check(error) ?? OK;
    }

    case "session.upsert": {
      const s = op.session;
      if (!s || !isUuid(s.id) || !["active", "paused", "finished"].includes(s.status)) return rejected("Malformed session.");
      const startedAt = iso(s.started_at);
      if (!startedAt) return rejected("Malformed session.");
      const clientUpdatedAt = iso(s.client_updated_at) ?? at;
      const { data: existing } = await supabase.from("project_sessions").select("project_id, client_updated_at").eq("id", s.id).maybeSingle();
      if (existing && existing.project_id !== projectId) return rejected("Session belongs to another project.");
      if (existing && existing.client_updated_at > clientUpdatedAt) return OK;

      const row = sessionRow(s, projectId, startedAt, clientUpdatedAt);
      if (!row) return rejected("Malformed session.");
      const { error } = await supabase.from("project_sessions").upsert(row, { onConflict: "id" });
      if (error?.code === "23505") {
        // Another session is already open for this project (e.g. started on
        // another device). Keep this one as a finished session rather than
        // dropping it, and say so.
        const closed = sessionRow(finishSession(s, new Date(clientUpdatedAt)), projectId, startedAt, clientUpdatedAt);
        const retry = await supabase.from("project_sessions").upsert(closed!, { onConflict: "id" });
        return (
          check(retry.error) ?? {
            status: "merged",
            message: "Another session was already running for this project, so this one was saved as a separate finished session.",
          }
        );
      }
      return check(error) ?? OK;
    }

    case "session.delete": {
      if (!isUuid(op.id)) return rejected("Malformed session.");
      const { error } = await supabase.from("project_sessions").delete().eq("id", op.id).eq("project_id", projectId);
      return check(error) ?? OK;
    }

    case "project.update": {
      const patch = op.patch ?? {};
      const row: Record<string, unknown> = { client_updated_at: at };
      let merged: Applied | null = null;
      if ("name" in patch) {
        const name = str(patch.name, 200);
        if (name) row.name = name;
      }
      if ("status" in patch && typeof patch.status === "string" && STATUS_VALUES.includes(patch.status)) row.status = patch.status;
      if ("progress" in patch) row.progress = patch.progress === null ? null : int(patch.progress, 0, 100);
      if ("progress_method" in patch && typeof patch.progress_method === "string" && METHOD_VALUES.includes(patch.progress_method)) row.progress_method = patch.progress_method;
      if ("progress_target" in patch) row.progress_target = int(patch.progress_target, 1, 10_000_000);
      if ("progress_done" in patch) row.progress_done = int(patch.progress_done, 0, 10_000_000) ?? 0;
      if ("unit_label" in patch) row.unit_label = str(patch.unit_label, 60);
      if ("progress_counter_id" in patch) row.progress_counter_id = uuidOrNull(patch.progress_counter_id);
      if ("size_colorway" in patch) row.size_colorway = str(patch.size_colorway, 200);
      if ("started_on" in patch) row.started_on = dateOnly(patch.started_on);
      if ("finished_on" in patch) row.finished_on = dateOnly(patch.finished_on);
      if ("workspace" in patch && patch.workspace && typeof patch.workspace === "object") {
        const w = patch.workspace;
        row.workspace = {
          sourceId: uuidOrNull(w.sourceId),
          panel: str(w.panel, 20),
          followCounter: Boolean(w.followCounter),
          rowDirection: w.rowDirection === "up" ? "up" : "down",
        } as Json;
      }
      if ("notes" in patch) {
        const next = str(patch.notes, 10_000);
        const { data: current } = await supabase.from("projects").select("notes").eq("id", projectId).single();
        const server = current?.notes ?? null;
        const base = op.baseNotes === undefined ? server : (op.baseNotes ?? null);
        if (server === next) {
          // already applied
        } else if (server !== base && next) {
          // Edited in two places: keep the server text, save this edit as a note.
          await supabase.from("project_notes").insert({ id: randomUUID(), project_id: projectId, kind: "note", body: `Edited offline (kept alongside a newer edit):\n\n${next}` });
          merged = { status: "merged", message: "Your notes were changed in two places. Both versions are kept — the offline edit is in Notes." };
        } else {
          row.notes = next;
        }
      }
      const { error } = await supabase.from("projects").update(row as never).eq("id", projectId);
      return check(error, { "23514": "Progress can only follow one of this project's counters." }) ?? merged ?? OK;
    }

    case "progress.record": {
      const e = op.event;
      if (!e || !isUuid(e.id) || !METHOD_VALUES.includes(e.method)) return rejected("Malformed progress.");
      const { error } = await supabase.from("project_progress_events").upsert(
        {
          id: e.id,
          project_id: projectId,
          session_id: uuidOrNull(e.session_id),
          recorded_at: iso(e.recorded_at) ?? at,
          method: e.method,
          percent: int(e.percent, 0, 100) ?? 0,
          done: int(e.done, 0, 10_000_000),
          target: int(e.target, 1, 10_000_000),
          note: str(e.note, 1000),
        },
        { onConflict: "id", ignoreDuplicates: true },
      );
      return check(error) ?? OK;
    }

    case "step.set": {
      if (!isUuid(op.stepId)) return rejected("Malformed step.");
      if (op.done) {
        const { error } = await supabase
          .from("project_step_completions")
          .upsert({ project_id: projectId, step_id: op.stepId, completed_at: at }, { onConflict: "project_id,step_id", ignoreDuplicates: true });
        return check(error, { "23503": "That step was removed from the pattern." }) ?? OK;
      }
      const { error } = await supabase.from("project_step_completions").delete().eq("project_id", projectId).eq("step_id", op.stepId);
      return check(error) ?? OK;
    }

    case "note.upsert": {
      const n = op.note;
      if (!n || !isUuid(n.id)) return rejected("Malformed note.");
      const body = str(n.body, 10_000);
      if (!body) return rejected("Empty notes aren't saved.");
      const kind = NOTE_VALUES.includes(n.kind) ? n.kind : "note";
      const { data: existing } = await supabase.from("project_notes").select("project_id, body, updated_at").eq("id", n.id).maybeSingle();
      if (existing && existing.project_id !== projectId) return rejected("Note belongs to another project.");
      if (existing && existing.body !== body && op.baseUpdatedAt && existing.updated_at > op.baseUpdatedAt) {
        const { error } = await supabase.from("project_notes").insert({ id: randomUUID(), project_id: projectId, kind, body, session_id: uuidOrNull(n.session_id) });
        return check(error) ?? { status: "merged", message: "A note was edited in two places. Both versions are kept." };
      }
      const { error } = await supabase.from("project_notes").upsert(
        { id: n.id, project_id: projectId, kind, body, session_id: uuidOrNull(n.session_id), pinned: Boolean(n.pinned), client_updated_at: at },
        { onConflict: "id" },
      );
      return check(error) ?? OK;
    }

    case "note.delete": {
      if (!isUuid(op.id)) return rejected("Malformed note.");
      const { error } = await supabase.from("project_notes").delete().eq("id", op.id).eq("project_id", projectId);
      return check(error) ?? OK;
    }

    case "milestone.upsert": {
      const m = op.milestone;
      const title = str(m?.title, 200);
      if (!m || !isUuid(m.id) || !title) return rejected("Malformed milestone.");
      const { data: existing } = await supabase.from("project_milestones").select("project_id, client_updated_at").eq("id", m.id).maybeSingle();
      if (existing && existing.project_id !== projectId) return rejected("Milestone belongs to another project.");
      if (existing && existing.client_updated_at > at) return OK;
      const { error } = await supabase.from("project_milestones").upsert(
        { id: m.id, project_id: projectId, title, position: int(m.position, 0, 10_000) ?? 0, done_at: m.done_at ? iso(m.done_at) : null, session_id: uuidOrNull(m.session_id), client_updated_at: at },
        { onConflict: "id" },
      );
      return check(error) ?? OK;
    }

    case "milestone.delete": {
      if (!isUuid(op.id)) return rejected("Malformed milestone.");
      const { error } = await supabase.from("project_milestones").delete().eq("id", op.id).eq("project_id", projectId);
      return check(error) ?? OK;
    }

    case "reader.save": {
      const r = op.state;
      if (!r || !isUuid(r.source_id)) return rejected("Malformed reading position.");
      const guides = Array.isArray(r.guides)
        ? r.guides.slice(0, 6).map((g) => ({
            id: String(g.id).slice(0, 20),
            orientation: g.orientation === "column" ? "column" : "row",
            pos: Math.max(0, Math.min(1, Number(g.pos) || 0)),
            size: Math.max(0.002, Math.min(0.5, Number(g.size) || 0.03)),
            color: /^#[0-9a-f]{6}$/i.test(String(g.color)) ? g.color : "#B6FF00",
            opacity: Math.max(0.05, Math.min(1, Number(g.opacity) || 0.35)),
            shade: Boolean(g.shade),
          }))
        : [];
      const { data: existing } = await supabase.from("project_reader_states").select("client_updated_at").eq("project_id", projectId).eq("source_id", r.source_id).maybeSingle();
      if (existing && existing.client_updated_at > at) return OK;
      const { error } = await supabase.from("project_reader_states").upsert(
        {
          project_id: projectId,
          source_id: r.source_id,
          page: int(r.page, 1, 100_000) ?? 1,
          zoom: Math.max(0.1, Math.min(10, Number(r.zoom) || 1)),
          fit: ["width", "page", "custom"].includes(r.fit) ? r.fit : "width",
          scroll_left: Math.max(0, Math.min(1, Number(r.scroll_left) || 0)),
          scroll_top: Math.max(0, Math.min(1, Number(r.scroll_top) || 0)),
          guides: guides as unknown as Json[],
          client_updated_at: at,
        },
        { onConflict: "project_id,source_id" },
      );
      return check(error, { "23514": "That source isn't part of this project's pattern.", "23503": "That source was removed." }) ?? OK;
    }

    case "bookmark.upsert": {
      const b = op.bookmark;
      const label = str(b?.label, 120);
      if (!b || !isUuid(b.id) || !isUuid(b.source_id) || !label) return rejected("Malformed bookmark.");
      const { error } = await supabase.from("project_bookmarks").upsert(
        { id: b.id, project_id: projectId, source_id: b.source_id, page: int(b.page, 1, 100_000) ?? 1, y: Math.max(0, Math.min(1, Number(b.y) || 0)), label },
        { onConflict: "id" },
      );
      return check(error, { "23514": "That source isn't part of this project's pattern.", "23503": "That source was removed." }) ?? OK;
    }

    case "bookmark.delete": {
      if (!isUuid(op.id)) return rejected("Malformed bookmark.");
      const { error } = await supabase.from("project_bookmarks").delete().eq("id", op.id).eq("project_id", projectId);
      return check(error) ?? OK;
    }

    case "photo.add": {
      const ph = op.photo;
      if (!ph || !isUuid(ph.id) || typeof op.path !== "string") return rejected("Malformed photo.");
      if (!op.path.startsWith(`${ownerId}/projects/${projectId}/`) || op.path.includes("..")) return rejected("Invalid photo.");
      const { error } = await supabase.from("project_photos").upsert(
        {
          id: ph.id,
          project_id: projectId,
          storage_path: op.path,
          file_name: str(ph.fileName, 200),
          mime_type: str(ph.mimeType, 100),
          size_bytes: int(ph.size, 0, 200 * 1024 * 1024),
          session_id: uuidOrNull(ph.sessionId),
          caption: str(ph.caption, 500),
        },
        { onConflict: "id", ignoreDuplicates: true },
      );
      return check(error) ?? OK;
    }

    case "photo.delete": {
      if (!isUuid(op.id)) return rejected("Malformed photo.");
      const { data } = await supabase.from("project_photos").select("storage_path").eq("id", op.id).eq("project_id", projectId).maybeSingle();
      if (!data) return OK;
      const { error } = await supabase.from("project_photos").delete().eq("id", op.id);
      if (!error) {
        await supabase.storage.from(BUCKET).remove([data.storage_path]);
        await supabase.from("projects").update({ cover_path: null }).eq("id", projectId).eq("cover_path", data.storage_path);
      }
      return check(error) ?? OK;
    }

    default:
      return rejected("Unknown change.");
  }
}

function sessionRow(s: Session, projectId: string, startedAt: string, clientUpdatedAt: string) {
  const status = s.status;
  const resumedAt = status === "active" ? iso(s.resumed_at) : null;
  const endedAt = status === "finished" ? iso(s.ended_at) : null;
  if (status === "active" && !resumedAt) return null;
  if (status === "finished" && !endedAt) return null;
  return {
    id: s.id,
    project_id: projectId,
    started_at: startedAt,
    ended_at: endedAt && endedAt < startedAt ? startedAt : endedAt,
    resumed_at: resumedAt,
    active_seconds: int(s.active_seconds, 0, 604_800) ?? 0,
    adjusted_seconds: int(s.adjusted_seconds, 0, 604_800),
    status,
    note: str(s.note, 1000),
    accomplished: str(s.accomplished, 4000),
    progress_before: int(s.progress_before, 0, 100),
    progress_after: int(s.progress_after, 0, 100),
    units_before: int(s.units_before, 0, 10_000_000),
    units_after: int(s.units_after, 0, 10_000_000),
    client_updated_at: clientUpdatedAt,
  };
}
