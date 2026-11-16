"use client";

import { useEffect, useState } from "react";
import { FoilStrip } from "@/components/editorial/foil";
import { Sheet } from "@/components/ui/sheet";
import { toCoverJpeg, uploadFile } from "@/lib/library/client-files";
import { validateUpload } from "@/lib/library/constants";
import { idb } from "@/lib/workspace/idb";
import {
  activeSeconds,
  computeProgress,
  finishSession,
  formatDuration,
  NOTE_KINDS,
  pauseAt,
  pauseSession,
  resumeSession,
  sessionSeconds,
  startSession,
  type NoteKind,
  type ProgressSummary,
  type Session,
} from "@/lib/workspace/model";
import type { Workspace } from "@/lib/workspace/use-workspace";

/** Re-renders every `ms` while enabled. Time itself always comes from timestamps. */
export function useNow(enabled: boolean, ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, ms);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [enabled, ms]);
  return now;
}

export function startWork(ws: Workspace) {
  const s = ws.state;
  if (s.sessions.some((x) => x.status !== "finished")) return; // never two at once
  const p = computeProgress(s);
  ws.dispatch({ type: "session.upsert", session: startSession(crypto.randomUUID(), new Date(), p.percent, p.done) });
  if (s.project.status === "planned" || s.project.status === "paused") {
    ws.dispatch({ type: "project.update", patch: { status: "in_progress", started_on: s.project.started_on ?? localDate() } });
  }
}

const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Timer for the top bar. Each state looks different at a glance:
 * idle → lime Start; running → live lime time + Pause; paused → amber
 * "Paused" + Resume; Finish is always the white button.
 */
export function TimerControl({ ws, open, onFinish }: { ws: Workspace; open: Session | null; onFinish: () => void }) {
  const now = useNow(open?.status === "active");
  if (!open) {
    return (
      <button type="button" onClick={() => startWork(ws)} className="btn btn-primary press !min-h-10 !px-4" data-testid="timer-start">
        <span aria-hidden="true">▶</span> Start session
      </button>
    );
  }
  const seconds = activeSeconds(open, now);
  const running = open.status === "active";
  return (
    <div
      className={`flex items-center gap-1 rounded-full p-1 ring-1 ${running ? "bg-neon/10 ring-neon/40" : "bg-peach/15 ring-peach/50"}`}
      data-testid="timer"
    >
      <span className="flex items-center gap-1.5 pr-1 pl-2.5">
        <span className={`size-2 rounded-full ${running ? "bg-neon motion-safe:animate-pulse" : "bg-peach"}`} aria-hidden="true" />
        <span className="sr-only">{running ? "Session running" : "Session paused"}</span>
        <span className={`font-mono text-base font-semibold tabular-nums ${running ? "text-neon" : "text-peach"}`} aria-live="off" data-testid="timer-value" suppressHydrationWarning>
          {formatDuration(seconds, true)}
        </span>
        {!running && <span className="hidden text-xs font-semibold text-peach sm:inline">Paused</span>}
      </span>
      {running ? (
        <button
          type="button"
          onClick={() => ws.dispatch({ type: "session.upsert", session: pauseSession(open, new Date()) })}
          className="press flex min-h-10 items-center gap-1.5 rounded-full bg-white/10 px-3 text-sm font-semibold text-white hover:bg-white/20"
          aria-label="Pause session"
        >
          <span aria-hidden="true">❚❚</span>
          <span className="hidden sm:inline">Pause</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => ws.dispatch({ type: "session.upsert", session: resumeSession(open, new Date()) })}
          className="press flex min-h-10 items-center gap-1.5 rounded-full bg-neon px-3 text-sm font-semibold text-midnight"
          aria-label="Resume session"
        >
          <span aria-hidden="true">▶</span>
          <span className="hidden sm:inline">Resume</span>
        </button>
      )}
      <button type="button" onClick={onFinish} className="press min-h-10 rounded-full bg-white px-3 text-sm font-semibold text-midnight" data-testid="timer-finish">
        Finish
      </button>
    </div>
  );
}

/** The timer kept running while the app was closed or the phone was locked. */
export function RecoverSession({ ws, open, lastActivity, onClose, onFinishAt }: { ws: Workspace; open: Session; lastActivity: Date; onClose: () => void; onFinishAt: (at: Date) => void }) {
  const now = new Date();
  const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const day = (d: Date) => (d.toDateString() === now.toDateString() ? time(d) : `${d.toLocaleDateString(undefined, { weekday: "short" })} ${time(d)}`);
  return (
    <Sheet open onClose={onClose} title="Your timer kept running">
      <p className="text-body">
        This session started at <strong className="text-strong">{day(new Date(open.started_at))}</strong>. The last thing you did here was at{" "}
        <strong className="text-strong">{day(lastActivity)}</strong> — the timer now shows {formatDuration(activeSeconds(open, now.getTime()))}.
      </p>
      <div className="mt-5 grid gap-2">
        <button type="button" className="btn btn-ink" onClick={() => (ws.dispatch({ type: "session.upsert", session: pauseAt(open, lastActivity, now) }), onClose())}>
          Pause it at {time(lastActivity)}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => (onFinishAt(lastActivity), onClose())}>
          Finish it at {time(lastActivity)}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          I was working the whole time — keep it running
        </button>
      </div>
    </Sheet>
  );
}

/** Store a photo for upload; works offline (kept in IndexedDB until synced). */
export async function capturePhotos(ws: Workspace, files: FileList | File[], sessionId: string | null): Promise<string | null> {
  const projectId = ws.state.project.id;
  for (const original of Array.from(files)) {
    const problem = validateUpload("image", original.type || "image/jpeg", original.size);
    if (problem) return `${original.name}: ${problem}`;
    let blob: Blob = original;
    try {
      // Phone photos are large; a 2400px JPEG keeps detail and saves storage.
      if (original.size > 1_500_000) blob = await toCoverJpeg(original, 2400);
    } catch {
      blob = original;
    }
    const id = crypto.randomUUID();
    const localKey = `photo:${id}`;
    const fileName = blob === original ? original.name : original.name.replace(/\.\w+$/, "") + ".jpg";
    const mimeType = blob.type || original.type || "image/jpeg";
    await idb.putFile({ key: localKey, projectId, blob, size: blob.size, savedAt: new Date().toISOString() });
    let path: string | undefined;
    if (!(await idb.getFile(localKey))) {
      // No offline storage in this browser: upload right away instead.
      try {
        path = await uploadFile(blob, { scope: "projects", parentId: projectId, kind: "image", fileName });
      } catch {
        return "This browser can't keep photos offline. Try again when connected.";
      }
    }
    ws.dispatch({ type: "photo.add", photo: { id, fileName, mimeType, size: blob.size, sessionId, caption: null }, localKey, ...(path ? { path } : {}) });
  }
  return null;
}

export function FinishSession({
  ws,
  session,
  endAt,
  onClose,
}: {
  ws: Workspace;
  session: Session;
  /** When the work stopped (Finish tapped, or last activity when recovering). */
  endAt: Date;
  onClose: () => void;
}) {
  const s = ws.state;
  // Frozen when the sheet opens: typing a summary isn't crafting time.
  const [before] = useState<ProgressSummary>(() => computeProgress(s));
  const [tracked] = useState(() => activeSeconds(session, Math.min(endAt.getTime(), Date.now())));
  const otherTotal = s.sessions.filter((x) => x.id !== session.id).reduce((n, x) => n + sessionSeconds(x), 0);
  const method = s.project.progress_method;
  const connected = s.project.progress_counter_id ? s.counters.find((c) => c.id === s.project.progress_counter_id) : null;

  const [hours, setHours] = useState(String(Math.floor(tracked / 3600)));
  const [minutes, setMinutes] = useState(String(Math.floor((tracked % 3600) / 60)));
  const [accomplished, setAccomplished] = useState("");
  const [percent, setPercent] = useState(before.percent);
  const [done, setDone] = useState(String(before.done ?? s.project.progress_done ?? 0));
  const [milestone, setMilestone] = useState("");
  const [doneMilestones, setDoneMilestones] = useState<string[]>([]);
  const [noteKind, setNoteKind] = useState<NoteKind>("modification");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const adjusted = Number(hours || 0) * 3600 + Number(minutes || 0) * 60;
  const roundedTracked = Math.floor(tracked / 60) * 60;
  const adjustedSeconds = Math.abs(adjusted - roundedTracked) >= 60 ? Math.max(0, Math.min(adjusted, 604_800)) : null;
  const effective = adjustedSeconds ?? tracked;

  const finish = async (withDetails: boolean) => {
    setSaving(true);
    setError(null);
    const now = new Date();
    const sid = session.id;
    let after = before;
    const patch: Record<string, unknown> = {};
    if (withDetails) {
      if (method === "manual" && percent !== before.percent) patch.progress = percent;
      if ((method === "units" || method === "rows") && !connected) {
        const n = Math.max(0, Number.parseInt(done, 10) || 0);
        if (n !== s.project.progress_done) patch.progress_done = n;
      }
      after = computeProgress({
        ...s,
        project: { ...s.project, ...patch },
        milestones: s.milestones.map((m) => (doneMilestones.includes(m.id) ? { ...m, done_at: now.toISOString() } : m)).concat(
          milestone.trim() && method === "milestones" ? [{ id: "new", title: milestone, position: 0, done_at: now.toISOString(), session_id: sid }] : [],
        ),
      });
      if (method !== "manual" && after.percent !== s.project.progress) patch.progress = after.percent;
    }

    const finished: Session = {
      ...finishSession(session, now, endAt),
      adjusted_seconds: withDetails ? adjustedSeconds : null,
      accomplished: withDetails ? accomplished.trim() || null : null,
      progress_after: after.percent,
      units_after: after.done,
    };
    ws.dispatch({ type: "session.upsert", session: finished });

    if (withDetails) {
      for (const id of doneMilestones) {
        const m = s.milestones.find((x) => x.id === id);
        if (m) ws.dispatch({ type: "milestone.upsert", milestone: { ...m, done_at: now.toISOString(), session_id: sid } });
      }
      if (milestone.trim()) {
        ws.dispatch({
          type: "milestone.upsert",
          milestone: { id: crypto.randomUUID(), title: milestone.trim().slice(0, 200), position: s.milestones.length, done_at: now.toISOString(), session_id: sid },
        });
      }
      if (note.trim()) {
        ws.dispatch({
          type: "note.upsert",
          note: { id: crypto.randomUUID(), kind: noteKind, body: note.trim(), session_id: sid, pinned: false, created_at: now.toISOString(), updated_at: now.toISOString() },
          baseUpdatedAt: null,
        });
      }
      if (photos.length) {
        const problem = await capturePhotos(ws, photos, sid);
        if (problem) setError(problem);
      }
    }
    if (Object.keys(patch).length) ws.dispatch({ type: "project.update", patch });
    ws.dispatch({
      type: "progress.record",
      event: { id: crypto.randomUUID(), session_id: sid, recorded_at: now.toISOString(), method, percent: after.percent, done: after.done, target: after.target, note: null },
    });
    setSaving(false);
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Finish session"
      footer={
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-ink flex-1" disabled={saving} onClick={() => void finish(true)} data-testid="finish-save">
            {saving ? "Saving…" : "Save & finish"}
          </button>
          <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => void finish(false)} data-testid="finish-skip">
            Skip details
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="tone-midnight relative isolate overflow-hidden rounded-card bg-midnight text-center">
          <FoilStrip left="Session complete" right={new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} sizes="32rem" />
          <div className="p-5">
          <div aria-hidden="true" className="absolute -top-12 left-1/2 -z-10 size-48 -translate-x-1/2 rounded-full bg-neon/25 blur-3xl" />
          <p className="text-xs font-semibold tracking-[0.16em] text-white/60 uppercase">This session</p>
          <p className="chrome-text mt-1 font-display-tight text-[3rem] leading-none" data-testid="finish-duration">
            {formatDuration(effective)}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-left">
            <div className="rounded-tile bg-white/10 px-3 py-2">
              <dt className="text-[0.65rem] font-semibold tracking-[0.12em] text-white/60 uppercase">Project total</dt>
              <dd className="font-mono font-semibold text-white">{formatDuration(otherTotal + effective)}</dd>
            </div>
            <div className="rounded-tile bg-white/10 px-3 py-2">
              <dt className="text-[0.65rem] font-semibold tracking-[0.12em] text-white/60 uppercase">Progress</dt>
              <dd className="font-mono font-semibold text-white">
                {before.percent}%{method === "manual" && percent !== before.percent ? <span className="text-neon"> → {percent}%</span> : null}
              </dd>
            </div>
          </dl>
          </div>
        </div>
        <p className="text-sm text-muted">Everything below is optional — “Skip details” still saves this session.</p>

        <fieldset>
          <legend className="eyebrow">Recorded time</legend>
          <div className="mt-2 flex items-center gap-2">
            <input type="number" inputMode="numeric" min={0} max={168} aria-label="Hours" className="field w-20" value={hours} onChange={(e) => setHours(e.target.value)} />
            <span className="text-sm">h</span>
            <input type="number" inputMode="numeric" min={0} max={59} aria-label="Minutes" className="field w-20" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            <span className="text-sm">m</span>
            {adjustedSeconds !== null && <span className="text-xs text-muted">Timer said {formatDuration(tracked)} — your correction is used instead.</span>}
          </div>
        </fieldset>

        <label className="block">
          <span className="eyebrow">What did you get done? (optional)</span>
          <textarea className="field mt-2 min-h-20" value={accomplished} onChange={(e) => setAccomplished(e.target.value)} maxLength={4000} placeholder="Joined 4 squares, started the border" />
        </label>

        <ProgressUpdate method={method} before={before} percent={percent} setPercent={setPercent} done={done} setDone={setDone} connectedName={connected?.name ?? null} unitLabel={s.project.unit_label} />

        {method === "milestones" && s.milestones.some((m) => !m.done_at) && (
          <fieldset>
            <legend className="eyebrow">Milestones reached</legend>
            {s.milestones
              .filter((m) => !m.done_at)
              .map((m) => (
                <label key={m.id} className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    className="size-5 accent-[#081638]"
                    checked={doneMilestones.includes(m.id)}
                    onChange={(e) => setDoneMilestones((d) => (e.target.checked ? [...d, m.id] : d.filter((x) => x !== m.id)))}
                  />
                  {m.title}
                </label>
              ))}
          </fieldset>
        )}

        <label className="block">
          <span className="eyebrow">Record a milestone (optional)</span>
          <input className="field mt-2" value={milestone} onChange={(e) => setMilestone(e.target.value)} maxLength={200} placeholder="Finished the front panel" />
        </label>

        <div>
          <span className="eyebrow">Add a note or modification (optional)</span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {NOTE_KINDS.map((k) => (
              <button key={k.value} type="button" className="chip !min-h-9 !text-xs" aria-pressed={noteKind === k.value} onClick={() => setNoteKind(k.value)}>
                {k.label}
              </button>
            ))}
          </div>
          <textarea className="field mt-2 min-h-16" value={note} onChange={(e) => setNote(e.target.value)} maxLength={10000} aria-label="Note" />
        </div>

        <div>
          <span className="eyebrow">Progress photos (optional)</span>
          <label className="btn btn-secondary mt-2 w-full cursor-pointer">
            📷 Add photos{photos.length ? ` (${photos.length})` : ""}
            <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => e.target.files && setPhotos([...photos, ...Array.from(e.target.files)])} />
          </label>
        </div>
        {error && (
          <p role="alert" className="text-sm font-semibold text-[#a3123f]">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}

function ProgressUpdate({
  method,
  before,
  percent,
  setPercent,
  done,
  setDone,
  connectedName,
  unitLabel,
}: {
  method: string;
  before: ProgressSummary;
  percent: number;
  setPercent: (n: number) => void;
  done: string;
  setDone: (s: string) => void;
  connectedName: string | null;
  unitLabel: string | null;
}) {
  if (method === "manual") {
    return (
      <label className="block">
        <span className="flex justify-between">
          <span className="eyebrow">Project progress</span>
          <span className="font-mono text-sm">
            {before.percent}% → <strong>{percent}%</strong>
          </span>
        </span>
        <input type="range" min={0} max={100} value={percent} onChange={(e) => setPercent(Number(e.target.value))} className="mt-2 h-10 w-full accent-[#081638]" aria-label="Project progress percent" />
      </label>
    );
  }
  if ((method === "units" || method === "rows") && !connectedName) {
    return (
      <label className="block">
        <span className="eyebrow">Completed {method === "rows" ? "rows" : unitLabel || "units"}</span>
        <div className="mt-2 flex items-center gap-2">
          <input type="number" inputMode="numeric" min={0} className="field w-28" value={done} onChange={(e) => setDone(e.target.value)} />
          {before.target && <span className="text-sm text-muted">of {before.target}</span>}
        </div>
      </label>
    );
  }
  return (
    <p className="rounded-tile bg-selected px-4 py-3 text-sm">
      Progress: <strong className="text-strong">{before.percent}%</strong>
      {before.target ? ` — ${before.done} of ${before.target} ${before.label}` : ""}
      {connectedName ? ` (from the ${connectedName} counter)` : ""}.
    </p>
  );
}
