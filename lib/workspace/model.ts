/**
 * Crafting Workspace model. Pure and shared by server and client.
 *
 * The workspace state is a server snapshot plus an ordered list of local
 * operations (the outbox). The same reducer applies an op optimistically,
 * replays unsynced ops after a reload, and mirrors the database rules
 * (counter rollover, session states), so offline and online agree.
 */

export const PROGRESS_METHODS = [
  { value: "manual", label: "Percentage", hint: "Set the percentage yourself" },
  { value: "units", label: "Units", hint: "e.g. 16 of 40 granny squares" },
  { value: "rows", label: "Rows", hint: "Completed rows out of planned rows" },
  { value: "steps", label: "Steps", hint: "Instruction steps ticked off" },
  { value: "milestones", label: "Milestones", hint: "Sections or milestones reached" },
] as const;
export type ProgressMethod = (typeof PROGRESS_METHODS)[number]["value"];

export const NOTE_KINDS = [
  { value: "note", label: "Note" },
  { value: "modification", label: "Modification" },
  { value: "substitution", label: "Substitution" },
  { value: "gauge", label: "Gauge" },
  { value: "size", label: "Size" },
  { value: "mistake", label: "Mistake & fix" },
  { value: "reminder", label: "Reminder" },
  { value: "materials", label: "Threads & colours" },
] as const;
export type NoteKind = (typeof NOTE_KINDS)[number]["value"];

export type Counter = {
  id: string;
  name: string;
  value: number;
  step: number;
  target: number | null;
  rollover: boolean;
  rollover_counter_id: string | null;
  section_id: string | null;
  is_main: boolean;
  position: number;
};
export type CounterMeta = Omit<Counter, "value">;

export type SessionStatus = "active" | "paused" | "finished";
export type Session = {
  id: string;
  started_at: string;
  ended_at: string | null;
  resumed_at: string | null;
  active_seconds: number;
  adjusted_seconds: number | null;
  status: SessionStatus;
  note: string | null;
  accomplished: string | null;
  progress_before: number | null;
  progress_after: number | null;
  units_before: number | null;
  units_after: number | null;
  client_updated_at: string;
};

export type Note = { id: string; kind: NoteKind; body: string; session_id: string | null; pinned: boolean; created_at: string; updated_at: string };
export type Milestone = { id: string; title: string; position: number; done_at: string | null; session_id: string | null };
export type ProgressEvent = {
  id: string;
  session_id: string | null;
  recorded_at: string;
  method: ProgressMethod;
  percent: number;
  done: number | null;
  target: number | null;
  note: string | null;
};
export type Guide = {
  id: string;
  orientation: "row" | "column";
  /** Position and thickness as fractions of the page (0–1). */
  pos: number;
  size: number;
  color: string;
  opacity: number;
  /** Dim the page outside this guide (focus on dense charts). */
  shade?: boolean;
};
export type ReaderState = {
  source_id: string;
  page: number;
  zoom: number;
  fit: "width" | "page" | "custom";
  scroll_left: number;
  scroll_top: number;
  guides: Guide[];
};
export type Bookmark = { id: string; source_id: string; page: number; y: number; label: string };
export type Photo = {
  id: string;
  storage_path: string | null;
  url: string | null;
  session_id: string | null;
  caption: string | null;
  file_name: string | null;
  created_at: string;
  /** Set while an offline-captured photo waits to upload. */
  localKey?: string;
};
export type Source = {
  id: string;
  kind: "pdf" | "image" | "website" | "video";
  title: string | null;
  url: string | null;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  page_count: number | null;
  sha256: string | null;
  fileUrl: string | null;
};
export type Step = { id: string; body: string; row_start: number | null; row_end: number | null; repeat_count: number | null; position: number };
export type Section = { id: string; title: string; notes: string | null; position: number; steps: Step[] };

export type ProjectState = {
  id: string;
  name: string;
  status: string;
  progress: number | null;
  progress_method: ProgressMethod;
  progress_target: number | null;
  progress_done: number;
  unit_label: string | null;
  progress_counter_id: string | null;
  notes: string | null;
  size_colorway: string | null;
  started_on: string | null;
  finished_on: string | null;
  last_worked_at: string | null;
  workspace: {
    sourceId?: string | null;
    panel?: string | null;
    /** Move the row guide when the main counter changes. */
    followCounter?: boolean;
    /** Charts are often read bottom-up. */
    rowDirection?: "down" | "up";
  };
  pattern_id: string | null;
};

export type Snapshot = {
  /** Server time the snapshot was built; newer snapshots win. */
  loadedAt: string;
  project: ProjectState;
  pattern: { id: string; title: string; designer: string | null; craft: string; cover_path: string | null; coverUrl: string | null } | null;
  sources: Source[];
  sections: Section[];
  completedSteps: string[];
  counters: Counter[];
  sessions: Session[];
  photos: Photo[];
  notes: Note[];
  milestones: Milestone[];
  progressEvents: ProgressEvent[];
  readerStates: ReaderState[];
  bookmarks: Bookmark[];
};

export type ProjectPatch = Partial<
  Pick<
    ProjectState,
    | "name"
    | "status"
    | "progress"
    | "progress_method"
    | "progress_target"
    | "progress_done"
    | "unit_label"
    | "progress_counter_id"
    | "notes"
    | "size_colorway"
    | "started_on"
    | "finished_on"
    | "workspace"
  >
>;

type Base = { opId: string; at: string };
export type Op = Base &
  (
    | { type: "counter.event"; counterId: string; kind: "add" | "set"; amount: number; sessionId: string | null }
    | { type: "counter.upsert"; counter: CounterMeta }
    | { type: "counter.delete"; id: string }
    | { type: "session.upsert"; session: Session }
    | { type: "session.delete"; id: string }
    /** baseNotes: the notes text this edit started from (for conflict checks). */
    | { type: "project.update"; patch: ProjectPatch; baseNotes?: string | null }
    | { type: "progress.record"; event: ProgressEvent }
    | { type: "step.set"; stepId: string; done: boolean }
    | { type: "note.upsert"; note: Note; baseUpdatedAt: string | null }
    | { type: "note.delete"; id: string }
    | { type: "milestone.upsert"; milestone: Milestone }
    | { type: "milestone.delete"; id: string }
    | { type: "reader.save"; state: ReaderState }
    | { type: "bookmark.upsert"; bookmark: Bookmark }
    | { type: "bookmark.delete"; id: string }
    | {
        type: "photo.add";
        photo: { id: string; fileName: string; mimeType: string; size: number; sessionId: string | null; caption: string | null };
        /** Local blob key until uploaded; then the storage path. */
        localKey: string;
        path?: string;
      }
    | { type: "photo.delete"; id: string }
  );
export type OpInput = Op extends infer O ? (O extends Op ? Omit<O, "opId" | "at"> : never) : never;

/* ------------------------------------------------------------- counters */

/** Mirrors public.apply_counter_event(). Returns the new counters and rollovers. */
export function applyCounterChange(
  counters: Counter[],
  counterId: string,
  kind: "add" | "set",
  amount: number,
  depth = 0,
): { counters: Counter[]; rolls: number } {
  const c = counters.find((x) => x.id === counterId);
  if (!c) return { counters, rolls: 0 };
  let next = kind === "set" ? Math.max(amount, 0) : Math.max(c.value + amount, 0);
  let rolls = 0;
  if (kind === "add" && amount > 0 && c.rollover && c.target && next >= c.target) {
    rolls = Math.floor(next / c.target);
    next = next % c.target;
  }
  let out = counters.map((x) => (x.id === c.id ? { ...x, value: next } : x));
  if (rolls > 0 && c.rollover_counter_id && depth < 5) {
    for (let i = 0; i < Math.min(rolls, 1000); i++) out = applyCounterChange(out, c.rollover_counter_id, "add", 1, depth + 1).counters;
  }
  return { counters: out, rolls };
}

/* ---------------------------------------------------------------- timer */

const ms = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : NaN);

/** Active seconds so far: accumulated time plus the running stretch. */
export function activeSeconds(s: Pick<Session, "active_seconds" | "resumed_at" | "status">, now = Date.now()) {
  const running = s.status === "active" && s.resumed_at ? Math.max(0, (now - ms(s.resumed_at)) / 1000) : 0;
  return Math.floor(s.active_seconds + running);
}
/** Seconds that count toward totals (manual correction wins). */
export function sessionSeconds(s: Session, now = Date.now()) {
  return s.adjusted_seconds ?? activeSeconds(s, now);
}

export function openSession(sessions: Session[]) {
  return sessions.find((s) => s.status !== "finished") ?? null;
}

export function startSession(id: string, now: Date, progress: number | null, units: number | null): Session {
  const at = now.toISOString();
  return {
    id,
    started_at: at,
    ended_at: null,
    resumed_at: at,
    active_seconds: 0,
    adjusted_seconds: null,
    status: "active",
    note: null,
    accomplished: null,
    progress_before: progress,
    progress_after: null,
    units_before: units,
    units_after: null,
    client_updated_at: at,
  };
}

export function pauseSession(s: Session, now: Date): Session {
  if (s.status !== "active") return s;
  return { ...s, active_seconds: activeSeconds(s, now.getTime()), resumed_at: null, status: "paused", client_updated_at: now.toISOString() };
}

export function resumeSession(s: Session, now: Date): Session {
  if (s.status !== "paused") return s;
  return { ...s, resumed_at: now.toISOString(), status: "active", client_updated_at: now.toISOString() };
}

/** Ends a session. `endAt` lets an interrupted session end at the last activity. */
export function finishSession(s: Session, now: Date, endAt?: Date): Session {
  const end = endAt && endAt < now ? endAt : now;
  const seconds = s.status === "active" ? activeSeconds(s, end.getTime()) : s.active_seconds;
  const ended = new Date(Math.max(end.getTime(), ms(s.started_at)));
  return { ...s, active_seconds: seconds, resumed_at: null, status: "finished", ended_at: ended.toISOString(), client_updated_at: now.toISOString() };
}

/** Ends the running stretch at `at` (e.g. last activity) and stays paused. */
export function pauseAt(s: Session, at: Date, now: Date): Session {
  if (s.status !== "active") return s;
  return { ...s, active_seconds: activeSeconds(s, Math.min(at.getTime(), now.getTime())), resumed_at: null, status: "paused", client_updated_at: now.toISOString() };
}

export function formatDuration(seconds: number, withSeconds = false) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (withSeconds) {
    const sec = String(s % 60).padStart(2, "0");
    return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
  }
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/* ------------------------------------------------------------- progress */

export type ProgressSummary = {
  percent: number;
  done: number | null;
  target: number | null;
  remaining: number | null;
  label: string;
};

const pct = (done: number, target: number | null) => (target && target > 0 ? Math.max(0, Math.min(100, Math.round((done / target) * 100))) : 0);

export function computeProgress(s: Pick<Snapshot, "project" | "counters" | "sections" | "completedSteps" | "milestones">): ProgressSummary {
  const p = s.project;
  const counterValue = p.progress_counter_id ? s.counters.find((c) => c.id === p.progress_counter_id)?.value : undefined;
  switch (p.progress_method) {
    case "units": {
      const done = counterValue ?? p.progress_done;
      return { percent: pct(done, p.progress_target), done, target: p.progress_target, remaining: p.progress_target ? Math.max(0, p.progress_target - done) : null, label: p.unit_label || "units" };
    }
    case "rows": {
      const done = counterValue ?? p.progress_done;
      return { percent: pct(done, p.progress_target), done, target: p.progress_target, remaining: p.progress_target ? Math.max(0, p.progress_target - done) : null, label: "rows" };
    }
    case "steps": {
      const ids = new Set(s.sections.flatMap((sec) => sec.steps.map((st) => st.id)));
      const done = s.completedSteps.filter((id) => ids.has(id)).length;
      return { percent: pct(done, ids.size || null), done, target: ids.size, remaining: ids.size - done, label: "steps" };
    }
    case "milestones": {
      const done = s.milestones.filter((m) => m.done_at).length;
      const total = s.milestones.length;
      return { percent: pct(done, total || null), done, target: total, remaining: total - done, label: "milestones" };
    }
    default:
      return { percent: p.progress ?? 0, done: null, target: null, remaining: null, label: "%" };
  }
}

/* ------------------------------------------------------------- insights */

export type Insights = {
  totalSeconds: number;
  sessionCount: number;
  averageSeconds: number | null;
  lastWorkedAt: string | null;
  firstSessionAt: string | null;
  trajectory: { at: string; percent: number }[];
  /** Hours of tracked work per percent of progress, when enough data. */
  estimateRemainingSeconds: number | null;
};

export function computeInsights(s: Pick<Snapshot, "sessions" | "progressEvents">, current: ProgressSummary, now = Date.now()): Insights {
  const sessions = s.sessions;
  const finished = sessions.filter((x) => x.status === "finished");
  const totalSeconds = sessions.reduce((n, x) => n + sessionSeconds(x, now), 0);
  const ends = sessions.map((x) => x.ended_at ?? (x.status === "active" ? new Date(now).toISOString() : x.started_at)).sort();
  const starts = sessions.map((x) => x.started_at).sort();

  // Pace from sessions that recorded progress before and after.
  let gained = 0;
  let paced = 0;
  for (const x of finished) {
    if (x.progress_before != null && x.progress_after != null && x.progress_after > x.progress_before) {
      gained += x.progress_after - x.progress_before;
      paced += sessionSeconds(x, now);
    }
  }
  const estimate = gained >= 5 && paced >= 1800 && current.percent < 100 ? Math.round(((100 - current.percent) * paced) / gained) : null;

  return {
    totalSeconds,
    sessionCount: finished.length,
    averageSeconds: finished.length ? Math.round(finished.reduce((n, x) => n + sessionSeconds(x, now), 0) / finished.length) : null,
    lastWorkedAt: ends.at(-1) ?? null,
    firstSessionAt: starts[0] ?? null,
    trajectory: [...s.progressEvents].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at)).map((e) => ({ at: e.recorded_at, percent: e.percent })),
    estimateRemainingSeconds: estimate,
  };
}

/** Compares projects of one pattern on tracked time. Only finished ones with tracked time compare. */
export function compareProjects(projects: { id: string; name: string; status: string; trackedSeconds: number; sessions: number }[]) {
  const comparable = projects.filter((p) => p.status === "finished" && p.trackedSeconds > 0 && p.sessions > 0);
  if (comparable.length < 2) return { comparable, fastest: null, slowest: null, difference: null };
  const sorted = [...comparable].sort((a, b) => a.trackedSeconds - b.trackedSeconds);
  return { comparable, fastest: sorted[0], slowest: sorted.at(-1)!, difference: sorted.at(-1)!.trackedSeconds - sorted[0].trackedSeconds };
}

/* -------------------------------------------------------------- reducer */

const upsert = <T extends { id: string }>(list: T[], item: T) =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];

export function applyOp(s: Snapshot, op: Op): Snapshot {
  switch (op.type) {
    case "counter.event":
      return { ...s, counters: applyCounterChange(s.counters, op.counterId, op.kind, op.amount).counters };
    case "counter.upsert": {
      const existing = s.counters.find((c) => c.id === op.counter.id);
      const merged = { ...op.counter, value: existing?.value ?? 0 };
      return { ...s, counters: upsert(s.counters, merged).sort((a, b) => a.position - b.position) };
    }
    case "counter.delete":
      return {
        ...s,
        counters: s.counters
          .filter((c) => c.id !== op.id || c.is_main)
          .map((c) => (c.rollover_counter_id === op.id ? { ...c, rollover_counter_id: null } : c)),
        project: s.project.progress_counter_id === op.id ? { ...s.project, progress_counter_id: null } : s.project,
      };
    case "session.upsert":
      return { ...s, sessions: upsert(s.sessions, op.session).sort((a, b) => b.started_at.localeCompare(a.started_at)) };
    case "session.delete":
      return { ...s, sessions: s.sessions.filter((x) => x.id !== op.id) };
    case "project.update":
      return { ...s, project: { ...s.project, ...op.patch } };
    case "progress.record":
      return { ...s, progressEvents: upsert(s.progressEvents, op.event) };
    case "step.set": {
      const set = new Set(s.completedSteps);
      if (op.done) set.add(op.stepId);
      else set.delete(op.stepId);
      return { ...s, completedSteps: [...set] };
    }
    case "note.upsert":
      return { ...s, notes: upsert(s.notes, op.note).sort((a, b) => b.created_at.localeCompare(a.created_at)) };
    case "note.delete":
      return { ...s, notes: s.notes.filter((n) => n.id !== op.id) };
    case "milestone.upsert":
      return { ...s, milestones: upsert(s.milestones, op.milestone).sort((a, b) => a.position - b.position) };
    case "milestone.delete":
      return { ...s, milestones: s.milestones.filter((m) => m.id !== op.id) };
    case "reader.save":
      return {
        ...s,
        readerStates: [...s.readerStates.filter((r) => r.source_id !== op.state.source_id), op.state],
      };
    case "bookmark.upsert":
      return { ...s, bookmarks: upsert(s.bookmarks, op.bookmark) };
    case "bookmark.delete":
      return { ...s, bookmarks: s.bookmarks.filter((b) => b.id !== op.id) };
    case "photo.add":
      if (s.photos.some((p) => p.id === op.photo.id)) return s;
      return {
        ...s,
        photos: [
          ...s.photos,
          {
            id: op.photo.id,
            storage_path: op.path ?? null,
            url: null,
            session_id: op.photo.sessionId,
            caption: op.photo.caption,
            file_name: op.photo.fileName,
            created_at: op.at,
            localKey: op.localKey,
          },
        ],
      };
    case "photo.delete":
      return { ...s, photos: s.photos.filter((p) => p.id !== op.id) };
  }
}

export const replay = (base: Snapshot, ops: Op[]) => ops.reduce(applyOp, base);

/**
 * Shrinks the outbox without changing its effect: consecutive reader saves
 * for the same source and project updates collapse. Counter events never
 * collapse — each is an idempotent, individually undoable change.
 */
export function compact(ops: Op[]): Op[] {
  const out: Op[] = [];
  for (const op of ops) {
    const prev = out.at(-1);
    if (prev && op.type === "reader.save" && prev.type === "reader.save" && prev.state.source_id === op.state.source_id) {
      out[out.length - 1] = op;
    } else if (prev && op.type === "project.update" && prev.type === "project.update" && !("notes" in op.patch && "notes" in prev.patch)) {
      out[out.length - 1] = { ...op, patch: { ...prev.patch, ...op.patch }, baseNotes: prev.baseNotes ?? op.baseNotes };
    } else if (prev && op.type === "session.upsert" && prev.type === "session.upsert" && prev.session.id === op.session.id) {
      out[out.length - 1] = op;
    } else {
      out.push(op);
    }
  }
  return out;
}

export const PAGE_FIT = ["width", "page"] as const;
export const GUIDE_COLORS = ["#B6FF00", "#F477D3", "#48D7F5", "#FFBC91", "#AE8AFF", "#494AF4"];

export function defaultGuide(orientation: Guide["orientation"] = "row", pos = 0.3): Guide {
  return { id: `g${Math.random().toString(36).slice(2, 9)}`, orientation, pos, size: 0.03, color: GUIDE_COLORS[0], opacity: 0.35 };
}

export function readerStateFor(s: Snapshot, sourceId: string): ReaderState {
  return (
    s.readerStates.find((r) => r.source_id === sourceId) ?? {
      source_id: sourceId,
      page: 1,
      zoom: 1,
      fit: "width",
      scroll_left: 0,
      scroll_top: 0,
      guides: [defaultGuide()],
    }
  );
}
