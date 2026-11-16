"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/sheet";
import { syncWorkspace } from "@/lib/workspace/actions";
import { computeInsights, computeProgress, formatDuration, NOTE_KINDS, sessionSeconds, type Op, type Session, type Snapshot } from "@/lib/workspace/model";

const op = <T extends Omit<Op, "opId" | "at">>(o: T) => ({ ...o, opId: crypto.randomUUID(), at: new Date().toISOString() }) as unknown as Op;

/** Project journal: one entry per work session, newest first. */
export function Journal({ snapshot }: { snapshot: Snapshot }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Session | null>(null);
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const sessions = snapshot.sessions.filter((s) => s.status === "finished");
  const open = snapshot.sessions.find((s) => s.status !== "finished");

  return (
    <section aria-labelledby="journal" className="surface-panel rounded-card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id="journal" className="eyebrow">
          Journal
        </h2>
        <button type="button" className="btn btn-secondary !min-h-10" onClick={() => setAdding(true)}>
          ＋ Past session
        </button>
      </div>
      {open && (
        <p className="mt-3 rounded-tile bg-selected px-3 py-2 text-sm">
          A session is {open.status === "active" ? "running" : "paused"} — finish it in Work Mode to add it here.
        </p>
      )}
      {sessions.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Each work session lands here with its time, progress, notes and photos.</p>
      ) : (
        <ol className="relative mt-4 space-y-5 border-l-2 border-line pl-5" data-testid="journal-list">
          {sessions.map((s) => {
            const photos = snapshot.photos.filter((p) => p.session_id === s.id);
            const notes = snapshot.notes.filter((n) => n.session_id === s.id);
            const milestones = snapshot.milestones.filter((m) => m.session_id === s.id);
            const seconds = sessionSeconds(s);
            return (
              <li key={s.id} className="relative">
                <span aria-hidden="true" className="absolute top-1.5 -left-[1.6rem] size-3 rounded-full border-2 border-paper bg-cobalt" />
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="font-semibold text-strong">
                    {new Date(s.started_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                  </h3>
                  <span className="font-mono text-sm text-strong" data-testid="journal-duration">
                    {formatDuration(seconds)}
                  </span>
                  {s.adjusted_seconds !== null && <span className="text-xs text-muted">(corrected from {formatDuration(s.active_seconds)})</span>}
                  {s.progress_before !== null && s.progress_after !== null && s.progress_after !== s.progress_before && (
                    <span className="rounded-full bg-[#e6ffb3] px-2 py-0.5 text-xs font-semibold text-[#2b4a00]">
                      {s.progress_before}% → {s.progress_after}%
                    </span>
                  )}
                  <button type="button" className="ml-auto min-h-9 text-sm font-semibold text-accent" onClick={() => setEditing(s)}>
                    Edit
                  </button>
                </div>
                {s.accomplished && <p className="mt-1 text-sm whitespace-pre-wrap text-body">{s.accomplished}</p>}
                {s.note && <p className="mt-1 text-sm text-muted">{s.note}</p>}
                {milestones.map((m) => (
                  <p key={m.id} className="mt-1 text-sm font-semibold text-strong">
                    ★ {m.title}
                  </p>
                ))}
                {notes.map((n) => (
                  <p key={n.id} className="mt-1 text-sm text-body">
                    <span className="mr-1 rounded-full bg-selected px-2 py-0.5 text-xs font-semibold">{NOTE_KINDS.find((k) => k.value === n.kind)?.label}</span>
                    {n.body}
                  </p>
                ))}
                {photos.length > 0 && (
                  <ul className="mt-2 flex gap-2 overflow-x-auto no-scrollbar">
                    {photos.map((p) =>
                      p.url ? (
                        <li key={p.id} className="shrink-0">
                          <button type="button" onClick={() => setViewing(p.url)} className="block size-20 overflow-hidden rounded-tile" aria-label="View photo">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.url} alt={p.file_name ?? "Session photo"} className="size-full object-cover" loading="lazy" />
                          </button>
                        </li>
                      ) : null,
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {editing && (
        <SessionEditor
          projectId={snapshot.project.id}
          session={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
      {adding && (
        <SessionEditor
          projectId={snapshot.project.id}
          session={null}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            router.refresh();
          }}
        />
      )}
      <Sheet open={Boolean(viewing)} onClose={() => setViewing(null)} title="Photo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {viewing && <img src={viewing} alt="" className="w-full rounded-tile" />}
      </Sheet>
    </section>
  );
}

function SessionEditor({ projectId, session, onClose, onSaved }: { projectId: string; session: Session | null; onClose: () => void; onSaved: () => void }) {
  const seconds = session ? sessionSeconds(session) : 3600;
  const [date, setDate] = useState(() => {
    const d = session ? new Date(session.started_at) : new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [hours, setHours] = useState(String(Math.floor(seconds / 3600)));
  const [minutes, setMinutes] = useState(String(Math.floor((seconds % 3600) / 60)));
  const [accomplished, setAccomplished] = useState(session?.accomplished ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();

  const send = (ops: Op[]) =>
    start(async () => {
      const r = await syncWorkspace(projectId, ops);
      if (!r.ok) return setError(r.error);
      const bad = r.results.find((x) => x.status === "rejected" || x.status === "retry");
      if (bad) return setError(bad.message ?? "Couldn't save the session.");
      onSaved();
    });

  const save = () => {
    const total = Math.max(60, Math.min(604_800, (Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60));
    const now = new Date().toISOString();
    if (session) {
      // Keep the original start time-of-day when only the date changes.
      const original = new Date(session.started_at);
      const [y, m, d] = date.split("-").map(Number);
      const started = new Date(original);
      started.setFullYear(y, m - 1, d);
      const ended = new Date(started.getTime() + (new Date(session.ended_at ?? session.started_at).getTime() - original.getTime()));
      send([
        op({
          type: "session.upsert",
          session: {
            ...session,
            started_at: started.toISOString(),
            ended_at: ended.toISOString(),
            // A correction replaces tracked time (never added on top of it).
            adjusted_seconds: total === session.active_seconds ? null : total,
            accomplished: accomplished.trim() || null,
            client_updated_at: now,
          },
        }),
      ]);
    } else {
      const started = new Date(`${date}T12:00:00`);
      send([
        op({
          type: "session.upsert",
          session: {
            id: crypto.randomUUID(),
            started_at: started.toISOString(),
            ended_at: new Date(started.getTime() + total * 1000).toISOString(),
            resumed_at: null,
            active_seconds: total,
            adjusted_seconds: null,
            status: "finished",
            note: null,
            accomplished: accomplished.trim() || null,
            progress_before: null,
            progress_after: null,
            units_before: null,
            units_after: null,
            client_updated_at: now,
          },
        }),
      ]);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={session ? "Edit session" : "Add a past session"}
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-ink" disabled={pending} onClick={save}>
            {pending ? "Saving…" : "Save"}
          </button>
          {session &&
            (confirmDelete ? (
              <button type="button" className="btn btn-danger" disabled={pending} onClick={() => send([op({ type: "session.delete", id: session.id })])}>
                Delete session
              </button>
            ) : (
              <button type="button" className="ml-auto text-sm font-semibold text-[#a3123f]" onClick={() => setConfirmDelete(true)}>
                Delete…
              </button>
            ))}
        </div>
      }
    >
      <div className="space-y-5">
        <label className="block">
          <span className="eyebrow">Date</span>
          <input type="date" className="field mt-2" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <fieldset>
          <legend className="eyebrow">Time spent</legend>
          <div className="mt-2 flex items-center gap-2">
            <input type="number" inputMode="numeric" min={0} aria-label="Hours" className="field w-20" value={hours} onChange={(e) => setHours(e.target.value)} />
            <span>h</span>
            <input type="number" inputMode="numeric" min={0} max={59} aria-label="Minutes" className="field w-20" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            <span>m</span>
          </div>
          {session && <p className="mt-1 text-xs text-muted">Timer recorded {formatDuration(session.active_seconds)}. Your figure replaces it in totals — it&rsquo;s never counted twice.</p>}
        </fieldset>
        <label className="block">
          <span className="eyebrow">What you got done</span>
          <textarea className="field mt-2 min-h-20" value={accomplished} onChange={(e) => setAccomplished(e.target.value)} maxLength={4000} />
        </label>
        {error && (
          <p role="alert" className="text-sm font-semibold text-[#a3123f]">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}

/** Insights card for the project page (server data, no live timer). */
export function ProjectInsights({ snapshot }: { snapshot: Snapshot }) {
  const summary = computeProgress(snapshot);
  const i = computeInsights(snapshot, summary);
  const facts: [string, string][] = [
    ["Active crafting time", formatDuration(i.totalSeconds)],
    ["Sessions", String(i.sessionCount)],
    ["Average session", i.averageSeconds ? formatDuration(i.averageSeconds) : "—"],
    ["Progress", `${summary.percent}%${summary.target ? ` · ${summary.done}/${summary.target} ${summary.label}` : ""}`],
    ["Started", snapshot.project.started_on ?? "—"],
    ["Finished", snapshot.project.finished_on ?? "—"],
  ];
  return (
    <section aria-labelledby="insights" className="surface-panel rounded-card p-5 sm:p-6">
      <h2 id="insights" className="eyebrow">
        Insights
      </h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="font-semibold text-strong" data-testid={`insight-${k}`}>
              {v}
            </dd>
          </div>
        ))}
      </dl>
      {i.estimateRemainingSeconds !== null && (
        <p className="mt-3 text-sm">
          <strong>Estimate:</strong> about {formatDuration(i.estimateRemainingSeconds)} left at your recorded pace — a guess, not a promise.
        </p>
      )}
      <p className="mt-3 text-xs text-muted">Tracked sessions only; untimed work isn&rsquo;t included.</p>
    </section>
  );
}
