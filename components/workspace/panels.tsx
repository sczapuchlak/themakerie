"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LocalTime } from "@/components/ui/local-time";
import { idb } from "@/lib/workspace/idb";
import {
  computeInsights,
  computeProgress,
  formatDuration,
  NOTE_KINDS,
  PROGRESS_METHODS,
  type Note,
  type NoteKind,
  type ProgressMethod,
} from "@/lib/workspace/model";
import { makeAvailableOffline, offlineStatus, removeOffline, type OfflineStatus } from "@/lib/workspace/offline";
import { pdfWorkerSrc } from "@/lib/library/client-files";
import { formatBytes } from "@/lib/library/constants";
import type { Workspace } from "@/lib/workspace/use-workspace";
import { capturePhotos } from "./session";

const uuid = () => crypto.randomUUID();

/* -------------------------------------------------------------------- steps */

export function StepsPanel({ ws }: { ws: Workspace }) {
  const s = ws.state;
  const done = new Set(s.completedSteps);
  const total = s.sections.reduce((n, x) => n + x.steps.length, 0);
  if (!s.sections.length) {
    return (
      <p className="text-sm text-muted">
        No structured steps for this pattern yet.{" "}
        {s.pattern && (
          <Link href={`/patterns/${s.pattern.id}/instructions`} className="font-semibold text-accent underline">
            Add sections and steps
          </Link>
        )}{" "}
        to tick them off here — each project keeps its own ticks.
      </p>
    );
  }
  return (
    <div>
      <p className="font-mono text-sm text-muted">
        {s.completedSteps.filter((id) => s.sections.some((x) => x.steps.some((st) => st.id === id))).length}/{total} steps done for this project
      </p>
      {s.sections.map((sec) => {
        const counters = s.counters.filter((c) => c.section_id === sec.id);
        return (
          <section key={sec.id} className="mt-4">
            <h3 className="font-semibold text-strong">{sec.title}</h3>
            {sec.notes && <p className="mt-1 text-sm text-muted">{sec.notes}</p>}
            {counters.length > 0 && (
              <p className="mt-1 text-xs text-muted">
                {counters.map((c) => `${c.name}: ${c.value}${c.target ? `/${c.target}` : ""}`).join(" · ")}
              </p>
            )}
            <ul className="mt-2 space-y-0.5">
              {sec.steps.map((st) => (
                <li key={st.id}>
                  <label className="flex min-h-11 items-start gap-3 rounded-tile px-2 py-2 hover:bg-selected">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-5 shrink-0 accent-[#081638]"
                      checked={done.has(st.id)}
                      onChange={(e) => ws.dispatch({ type: "step.set", stepId: st.id, done: e.target.checked })}
                    />
                    <span className={`text-sm ${done.has(st.id) ? "text-muted line-through" : "text-body"}`}>
                      {st.row_start && (
                        <span className="mr-1 font-mono text-xs">
                          {st.row_end && st.row_end !== st.row_start ? `Rows ${st.row_start}–${st.row_end}` : `Row ${st.row_start}`}
                          {st.repeat_count ? ` ×${st.repeat_count}` : ""}:
                        </span>
                      )}
                      {st.body}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------- notes */

export function NotesPanel({ ws }: { ws: Workspace }) {
  const s = ws.state;
  const [general, setGeneral] = useState(s.project.notes ?? "");
  const lastSent = useRef(s.project.notes ?? null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [kind, setKind] = useState<NoteKind>("modification");
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState<NoteKind | "all">("all");
  const [editing, setEditing] = useState<string | null>(null);

  const saveGeneral = (value: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const next = value.trim() ? value : null;
      if (next === lastSent.current) return;
      ws.dispatch({ type: "project.update", patch: { notes: next }, baseNotes: lastSent.current });
      lastSent.current = next;
    }, 800);
  };
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const notes = [...s.notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at));
  const shown = filter === "all" ? notes : notes.filter((n) => n.kind === filter);

  return (
    <div className="space-y-5">
      <label className="block">
        <span className="eyebrow">Project notes</span>
        <textarea
          className="field mt-2 min-h-24"
          value={general}
          onChange={(e) => {
            setGeneral(e.target.value);
            saveGeneral(e.target.value);
          }}
          onBlur={(e) => saveGeneral(e.target.value)}
          maxLength={10000}
          placeholder="Anything about this make — saved as you type, offline too."
          data-testid="project-notes"
        />
      </label>

      <form
        className="rounded-card border border-line bg-white p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          const now = new Date().toISOString();
          ws.dispatch({ type: "note.upsert", note: { id: uuid(), kind, body: draft.trim(), session_id: null, pinned: false, created_at: now, updated_at: now }, baseUpdatedAt: null });
          setDraft("");
        }}
      >
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Note type">
          {NOTE_KINDS.map((k) => (
            <button key={k.value} type="button" className="chip !min-h-9 !text-xs" aria-pressed={kind === k.value} onClick={() => setKind(k.value)}>
              {k.label}
            </button>
          ))}
        </div>
        <textarea className="field mt-2 min-h-16" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={10000} aria-label="New note" placeholder="Swapped to 4.5 mm hook for the border" />
        <button type="submit" className="btn btn-ink mt-2 !min-h-10" disabled={!draft.trim()}>
          Add {NOTE_KINDS.find((k) => k.value === kind)?.label.toLowerCase()}
        </button>
      </form>

      {notes.length > 0 && (
        <div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className="chip !min-h-9 !text-xs" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
              All ({notes.length})
            </button>
            {NOTE_KINDS.filter((k) => notes.some((n) => n.kind === k.value)).map((k) => (
              <button key={k.value} type="button" className="chip !min-h-9 !text-xs" aria-pressed={filter === k.value} onClick={() => setFilter(k.value)}>
                {k.label}
              </button>
            ))}
          </div>
          <ul className="mt-3 space-y-2">
            {shown.map((n) => (
              <NoteItem key={n.id} note={n} ws={ws} editing={editing === n.id} onEdit={(on) => setEditing(on ? n.id : null)} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function NoteItem({ note, ws, editing, onEdit }: { note: Note; ws: Workspace; editing: boolean; onEdit: (on: boolean) => void }) {
  const [body, setBody] = useState(note.body);
  const label = NOTE_KINDS.find((k) => k.value === note.kind)?.label ?? "Note";
  const save = (patch: Partial<Note>) =>
    ws.dispatch({ type: "note.upsert", note: { ...note, ...patch, updated_at: new Date().toISOString() }, baseUpdatedAt: note.updated_at });
  return (
    <li className="rounded-tile border border-line bg-white p-3">
      <div className="flex items-center gap-2 text-xs">
        <span className="rounded-full bg-selected px-2 py-0.5 font-semibold text-strong">{label}</span>
        {note.pinned && <span aria-label="Pinned">📌</span>}
        <LocalTime iso={note.created_at} format={(d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} className="text-muted" />
        <span className="ml-auto flex gap-1">
          <button type="button" className="min-h-9 rounded-full px-2 text-muted hover:bg-selected" onClick={() => save({ pinned: !note.pinned })}>
            {note.pinned ? "Unpin" : "Pin"}
          </button>
          <button type="button" className="min-h-9 rounded-full px-2 text-muted hover:bg-selected" onClick={() => onEdit(!editing)}>
            {editing ? "Cancel" : "Edit"}
          </button>
          <button type="button" className="min-h-9 rounded-full px-2 text-[#a3123f] hover:bg-selected" onClick={() => window.confirm("Delete this note?") && ws.dispatch({ type: "note.delete", id: note.id })}>
            Delete
          </button>
        </span>
      </div>
      {editing ? (
        <div className="mt-2">
          <textarea className="field min-h-16" value={body} onChange={(e) => setBody(e.target.value)} maxLength={10000} aria-label="Edit note" />
          <button
            type="button"
            className="btn btn-ink mt-2 !min-h-10"
            disabled={!body.trim()}
            onClick={() => {
              save({ body: body.trim() });
              onEdit(false);
            }}
          >
            Save
          </button>
        </div>
      ) : (
        <p className="mt-2 text-sm whitespace-pre-wrap text-body">{note.body}</p>
      )}
    </li>
  );
}

/* ----------------------------------------------------------------- progress */

export function ProgressPanel({ ws }: { ws: Workspace }) {
  const s = ws.state;
  const p = s.project;
  const summary = computeProgress(s);
  const insights = computeInsights(s, summary);
  const [milestone, setMilestone] = useState("");

  const record = (patch: Record<string, unknown>) => {
    const next = computeProgress({ ...s, project: { ...p, ...patch } });
    ws.dispatch({ type: "project.update", patch: { ...patch, progress: next.percent } });
    ws.dispatch({
      type: "progress.record",
      event: { id: uuid(), session_id: null, recorded_at: new Date().toISOString(), method: (patch.progress_method as ProgressMethod) ?? p.progress_method, percent: next.percent, done: next.done, target: next.target, note: null },
    });
  };

  return (
    <div className="space-y-6">
      <section aria-label="Progress summary" className="rounded-card bg-midnight p-4 text-white">
        <div className="flex items-end justify-between">
          <p className="font-mono text-4xl font-semibold text-neon" data-testid="progress-percent">
            {summary.percent}%
          </p>
          {summary.target !== null && summary.done !== null && (
            <p className="text-right text-sm text-white/80">
              {summary.done} of {summary.target} {summary.label}
              <br />
              <span className="text-white/60">{summary.remaining} to go</span>
            </p>
          )}
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-neon" style={{ width: `${summary.percent}%` }} />
        </div>
        {insights.trajectory.length > 1 && <Sparkline points={insights.trajectory} />}
      </section>

      <fieldset>
        <legend className="eyebrow">Track progress by</legend>
        <div className="mt-2 grid gap-2">
          {PROGRESS_METHODS.map((m) => (
            <label key={m.value} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-tile border px-3 ${p.progress_method === m.value ? "border-midnight bg-white" : "border-line bg-white/60"}`}>
              <input
                type="radio"
                name="progress-method"
                className="size-5 accent-[#081638]"
                checked={p.progress_method === m.value}
                onChange={() => {
                  const patch: Record<string, unknown> = { progress_method: m.value };
                  if (m.value === "rows" && !p.progress_counter_id) patch.progress_counter_id = s.counters.find((c) => c.is_main)?.id ?? null;
                  if (m.value === "manual" || m.value === "steps" || m.value === "milestones") patch.progress_counter_id = null;
                  record(patch);
                }}
              />
              <span>
                <span className="font-semibold text-strong">{m.label}</span>
                <span className="block text-xs text-muted">{m.hint}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">Switching keeps your progress history. Counters only drive progress when you connect one below.</p>
      </fieldset>

      {p.progress_method === "manual" && (
        <label className="block">
          <span className="eyebrow">Percent complete</span>
          <input
            type="range"
            min={0}
            max={100}
            defaultValue={p.progress ?? 0}
            key={p.progress ?? 0}
            onPointerUp={(e) => record({ progress: Number(e.currentTarget.value) })}
            onKeyUp={(e) => record({ progress: Number(e.currentTarget.value) })}
            className="mt-2 h-10 w-full accent-[#081638]"
            aria-label="Percent complete"
          />
        </label>
      )}

      {(p.progress_method === "units" || p.progress_method === "rows") && (
        <div className="grid gap-3">
          {p.progress_method === "units" && (
            <label className="block">
              <span className="eyebrow">What are you counting?</span>
              <input className="field mt-2" defaultValue={p.unit_label ?? ""} placeholder="granny squares" maxLength={60} onBlur={(e) => e.target.value !== (p.unit_label ?? "") && record({ unit_label: e.target.value || null })} />
            </label>
          )}
          <label className="block">
            <span className="eyebrow">{p.progress_method === "rows" ? "Planned rows" : "Target"}</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              className="field mt-2"
              defaultValue={p.progress_target ?? ""}
              key={`t${p.progress_target}`}
              onBlur={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                const next = n > 0 ? n : null;
                if (next !== p.progress_target) record({ progress_target: next });
              }}
              data-testid="progress-target"
            />
          </label>
          <label className="block">
            <span className="eyebrow">Count from</span>
            <select className="field mt-2" value={p.progress_counter_id ?? ""} onChange={(e) => record({ progress_counter_id: e.target.value || null })} data-testid="progress-counter">
              <option value="">Enter completed amount myself</option>
              {s.counters.map((c) => (
                <option key={c.id} value={c.id}>
                  The {c.name} counter ({c.value})
                </option>
              ))}
            </select>
          </label>
          {!p.progress_counter_id && (
            <label className="block">
              <span className="eyebrow">Completed so far</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                className="field mt-2"
                defaultValue={p.progress_done}
                key={`d${p.progress_done}`}
                onBlur={(e) => {
                  const n = Math.max(0, Number.parseInt(e.target.value, 10) || 0);
                  if (n !== p.progress_done) record({ progress_done: n });
                }}
              />
            </label>
          )}
        </div>
      )}

      {p.progress_method === "steps" && (
        <p className="text-sm text-body">Tick steps in the Steps tab — {summary.done} of {summary.target} done.</p>
      )}

      <section>
        <h3 className="eyebrow">Milestones{p.progress_method === "milestones" ? " — these drive progress" : ""}</h3>
        <ul className="mt-2 space-y-1">
          {s.milestones.map((m) => (
            <li key={m.id} className="flex items-center gap-2">
              <label className="flex min-h-11 flex-1 items-center gap-3 rounded-tile px-2 hover:bg-selected">
                <input
                  type="checkbox"
                  className="size-5 accent-[#081638]"
                  checked={Boolean(m.done_at)}
                  onChange={(e) => {
                    ws.dispatch({ type: "milestone.upsert", milestone: { ...m, done_at: e.target.checked ? new Date().toISOString() : null } });
                    if (p.progress_method === "milestones") {
                      const next = computeProgress({ ...s, milestones: s.milestones.map((x) => (x.id === m.id ? { ...x, done_at: e.target.checked ? "x" : null } : x)) });
                      ws.dispatch({ type: "project.update", patch: { progress: next.percent } });
                    }
                  }}
                />
                <span className={m.done_at ? "text-muted line-through" : "text-strong"}>{m.title}</span>
              </label>
              <button type="button" aria-label={`Delete milestone ${m.title}`} className="grid size-10 place-items-center rounded-full text-muted hover:bg-selected" onClick={() => ws.dispatch({ type: "milestone.delete", id: m.id })}>
                ×
              </button>
            </li>
          ))}
        </ul>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!milestone.trim()) return;
            ws.dispatch({ type: "milestone.upsert", milestone: { id: uuid(), title: milestone.trim(), position: s.milestones.length, done_at: null, session_id: null } });
            setMilestone("");
          }}
        >
          <input className="field flex-1" value={milestone} onChange={(e) => setMilestone(e.target.value)} placeholder="Back panel, sleeves, border…" maxLength={200} aria-label="New milestone" />
          <button type="submit" className="btn btn-secondary" disabled={!milestone.trim()}>
            Add
          </button>
        </form>
      </section>

      <InsightsGrid ws={ws} />
    </div>
  );
}

export function InsightsGrid({ ws }: { ws: Workspace }) {
  const s = ws.state;
  const summary = computeProgress(s);
  const i = computeInsights(s, summary);
  const since = i.lastWorkedAt ? <LocalTime iso={i.lastWorkedAt} format={(d) => relative(d.toISOString())} /> : "—";
  return (
    <section aria-label="Insights">
      <h3 className="eyebrow">Insights · tracked time</h3>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <Fact label="Active crafting time" value={formatDuration(i.totalSeconds)} />
        <Fact label="Sessions" value={String(i.sessionCount)} />
        <Fact label="Average session" value={i.averageSeconds ? formatDuration(i.averageSeconds) : "—"} />
        <Fact label="Last session" value={since} />
        <Fact label="Started" value={s.project.started_on ?? "—"} />
        <Fact label="Finished" value={s.project.finished_on ?? "—"} />
      </dl>
      {i.estimateRemainingSeconds !== null ? (
        <p className="mt-3 rounded-tile bg-selected px-3 py-2 text-sm" data-testid="estimate">
          <strong>Estimate:</strong> about {formatDuration(i.estimateRemainingSeconds)} of work left at your recorded pace. It&rsquo;s a guess from tracked sessions, not a promise.
        </p>
      ) : (
        <p className="mt-3 text-xs text-muted">An estimate appears after a few sessions that record progress.</p>
      )}
      <p className="mt-2 text-xs text-muted">Only recorded sessions are counted — work you didn&rsquo;t time isn&rsquo;t included.</p>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-tile bg-white px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-semibold text-strong">{value}</dd>
    </div>
  );
}

function relative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "within the hour";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

function Sparkline({ points }: { points: { at: string; percent: number }[] }) {
  const t0 = new Date(points[0].at).getTime();
  const t1 = Math.max(t0 + 1, new Date(points.at(-1)!.at).getTime());
  const d = points.map((p, i) => `${i ? "L" : "M"}${(((new Date(p.at).getTime() - t0) / (t1 - t0)) * 100).toFixed(1)},${(30 - (p.percent / 100) * 28).toFixed(1)}`).join(" ");
  return (
    <svg viewBox="0 0 100 31" preserveAspectRatio="none" className="mt-3 h-10 w-full" role="img" aria-label={`Progress over time, ${points.length} records`}>
      <path d={d} fill="none" stroke="#B6FF00" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ------------------------------------------------------------------- photos */

export function PhotosPanel({ ws, openSessionId }: { ws: Workspace; openSessionId: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const photos = [...ws.state.photos].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <div>
      <label className="btn btn-primary w-full cursor-pointer">
        📷 Take or add photos
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="sr-only"
          onChange={async (e) => {
            if (!e.target.files?.length) return;
            setError(await capturePhotos(ws, e.target.files, openSessionId));
            e.target.value = "";
          }}
          data-testid="photo-input"
        />
      </label>
      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-[#a3123f]">
          {error}
        </p>
      )}
      <p className="mt-2 text-xs text-muted">Project photos are private. Photos taken during a session are linked to it in the journal.</p>
      <ul className="mt-3 grid grid-cols-3 gap-2">
        {photos.map((ph) => (
          <li key={ph.id} className="relative aspect-square overflow-hidden rounded-tile bg-selected">
            <PhotoImage url={ph.url} localKey={ph.localKey} alt={ph.file_name ?? "Project photo"} />
            {!ph.url && <span className="absolute top-1 left-1 rounded-full bg-midnight/85 px-2 py-0.5 text-[0.6rem] font-semibold text-white">Waiting to sync</span>}
            <button
              type="button"
              aria-label="Delete photo"
              className="absolute right-1 bottom-1 rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold text-[#a3123f]"
              onClick={() => window.confirm("Delete this photo?") && ws.dispatch({ type: "photo.delete", id: ph.id })}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PhotoImage({ url, localKey, alt }: { url: string | null; localKey?: string; alt: string }) {
  const [local, setLocal] = useState<string | null>(null);
  useEffect(() => {
    if (url || !localKey) return;
    let objectUrl: string | null = null;
    void idb.getFile(localKey).then((f) => {
      if (f) {
        objectUrl = URL.createObjectURL(f.blob);
        setLocal(objectUrl);
      }
    });
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, localKey]);
  const src = url ?? local;
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt={alt} loading="lazy" className="size-full object-cover" /> : null;
}

/* ------------------------------------------------------------ offline & sync */

export function OfflinePanel({ ws }: { ws: Workspace }) {
  const [status, setStatus] = useState<OfflineStatus>({ state: "none" });
  const [usage, setUsage] = useState<string | null>(null);
  const snap = ws.state;

  useEffect(() => {
    let cancelled = false;
    void offlineStatus(snap).then((st) => !cancelled && setStatus(st));
    void navigator.storage?.estimate?.().then((e) => {
      if (!cancelled && e.usage !== undefined && e.quota) setUsage(`${formatBytes(e.usage)} used of ${formatBytes(e.quota)} available to The Makerie`);
    });
    return () => {
      cancelled = true;
    };
  }, [snap]);

  const download = async () => {
    setStatus({ state: "downloading", progress: 0, label: "Preparing…" });
    const res = await makeAvailableOffline(snap.project.id, (progress, label) => setStatus({ state: "downloading", progress, label }), [pdfWorkerSrc()]);
    setStatus(res.ok ? await offlineStatus(snap) : { state: "failed", error: res.error });
  };

  const sync = ws.sync;
  const links = snap.sources.filter((x) => x.kind === "website" || x.kind === "video");

  return (
    <div className="space-y-6">
      <section className="rounded-card border border-line bg-white p-4" data-testid="offline-panel">
        <h3 className="font-semibold text-strong">Available offline</h3>
        {status.state === "none" && (
          <p className="mt-1 text-sm text-body">Download this project&rsquo;s pattern files, counters, notes and instructions so you can work with no connection — on a flight, say.</p>
        )}
        {status.state === "downloading" && (
          <div className="mt-2" role="status">
            <p className="text-sm">{status.label}</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-selected">
              <div className="h-full bg-cobalt transition-all" style={{ width: `${Math.round(status.progress * 100)}%` }} />
            </div>
          </div>
        )}
        {status.state === "ready" && (
          <p className="mt-1 text-sm text-body" data-testid="offline-ready">
            ✓ Ready offline · {formatBytes(status.bytes) || "small"} · saved {new Date(status.savedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            {status.stale && <strong className="mt-1 block text-[#8a5a00]">The pattern&rsquo;s files changed since — update the offline copy.</strong>}
          </p>
        )}
        {status.state === "failed" && (
          <p role="alert" className="mt-1 text-sm font-semibold text-[#a3123f]">
            {status.error}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {status.state !== "downloading" && (
            <button type="button" className="btn btn-ink !min-h-10" onClick={() => void download()} disabled={!sync.online} data-testid="make-offline">
              {status.state === "ready" ? (status.stale ? "Update offline copy" : "Refresh offline copy") : status.state === "failed" ? "Try again" : "Make available offline"}
            </button>
          )}
          {(status.state === "ready" || status.state === "failed") && (
            <button type="button" className="btn btn-secondary !min-h-10" onClick={async () => (await removeOffline(snap.project.id), setStatus({ state: "none" }))}>
              Remove offline copy
            </button>
          )}
        </div>
        {usage && <p className="mt-2 text-xs text-muted">{usage}</p>}
      </section>

      <section className="rounded-card border border-line bg-white p-4">
        <h3 className="font-semibold text-strong">Sync</h3>
        <p className="mt-1 text-sm text-body" data-testid="sync-status">
          {!sync.online ? "Offline — changes are saved on this device and will sync when you reconnect." : sync.pending ? `${sync.pending} change${sync.pending === 1 ? "" : "s"} waiting to sync…` : "Everything is synced."}
          {sync.lastSyncedAt && ` Last synced ${new Date(sync.lastSyncedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}.`}
        </p>
        {sync.storage === "memory" && <p className="mt-1 text-sm font-semibold text-[#8a5a00]">This browser blocks offline storage, so unsynced changes are lost if you close the app.</p>}
        <button type="button" className="btn btn-secondary mt-3 !min-h-10" onClick={() => void ws.flush()} disabled={!sync.pending}>
          Sync now
        </button>
      </section>

      {links.length > 0 && (
        <section>
          <h3 className="eyebrow">Links (need a connection)</h3>
          <ul className="mt-2 space-y-1">
            {links.map((l) => (
              <li key={l.id}>
                <a href={l.url ?? "#"} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent underline">
                  {l.title ?? l.url} ↗
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
