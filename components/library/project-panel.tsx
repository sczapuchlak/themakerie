"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/sheet";
import { addProjectPhoto, deleteProject, deleteSession, logSession, removeProjectPhoto, setStepDone, updateProject } from "@/lib/library/actions";
import { uploadFile } from "@/lib/library/client-files";
import { IMAGE_TYPES, PROJECT_STATUSES, todayLocal, validateUpload } from "@/lib/library/constants";
import type { ProjectDetail } from "@/lib/library/data";

type P = ProjectDetail["project"];

function useSaver() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okText = "Saved") =>
    start(async () => {
      const r = await fn();
      setMessage(r.ok ? { ok: true, text: okText } : { ok: false, text: r.error ?? "Something went wrong." });
    });
  return { pending, message, run };
}

const Note = ({ m }: { m: { ok: boolean; text: string } | null }) =>
  m ? (
    <p role={m.ok ? "status" : "alert"} className={`text-sm font-semibold ${m.ok ? "text-[#2b6a00]" : "text-[#a3123f]"}`}>
      {m.text}
    </p>
  ) : null;

/* --------------------------------------------------------- status & progress */

export function ProjectTracker({ project }: { project: P }) {
  const [status, setStatus] = useState(project.status);
  const [progress, setProgress] = useState(project.progress ?? 0);
  const { pending, message, run } = useSaver();
  return (
    <section aria-labelledby="tracker" className="surface-panel rounded-card p-5 sm:p-6">
      <h2 id="tracker" className="eyebrow">
        Status &amp; progress
      </h2>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Status">
        {PROJECT_STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            className="chip"
            aria-pressed={status === s.value}
            disabled={pending}
            onClick={() => {
              setStatus(s.value);
              if (s.value === "finished") setProgress(100);
              const finishedOn = s.value === "finished" ? (project.finished_on ?? todayLocal()) : undefined;
              run(() => updateProject({ id: project.id, status: s.value, finishedOn }), `Marked ${s.label.toLowerCase()}`);
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
      {project.progress_method === "manual" ? (
        <label className="mt-6 block">
          <span className="flex items-baseline justify-between">
            <span className="eyebrow">Progress</span>
            <span className="font-mono text-lg font-semibold text-strong">{progress}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            onPointerUp={() => run(() => updateProject({ id: project.id, progress }))}
            onKeyUp={(e) => ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key) && run(() => updateProject({ id: project.id, progress }))}
            className="mt-3 h-10 w-full accent-[#081638]"
          />
        </label>
      ) : (
        <p className="mt-6 text-sm text-body">
          Progress <strong className="font-mono text-strong">{project.progress ?? 0}%</strong>, tracked by {project.progress_method}. Change how it&rsquo;s measured in{" "}
          <a href={`/projects/${project.id}/work`} className="font-semibold text-accent underline">
            Work Mode → Progress
          </a>
          .
        </p>
      )}
      <div className="mt-2 min-h-5">
        <Note m={message} />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ details */

export function ProjectDetails({ project }: { project: P }) {
  const [name, setName] = useState(project.name);
  const [sizeColorway, setSizeColorway] = useState(project.size_colorway ?? "");
  const [startedOn, setStartedOn] = useState(project.started_on ?? "");
  const [finishedOn, setFinishedOn] = useState(project.finished_on ?? "");
  const [notes, setNotes] = useState(project.notes ?? "");
  const { pending, message, run } = useSaver();
  return (
    <form
      className="surface-panel space-y-5 rounded-card p-5 sm:p-6"
      aria-labelledby="details"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateProject({ id: project.id, name, sizeColorway, startedOn: startedOn || null, finishedOn: finishedOn || null, notes }));
      }}
    >
      <h2 id="details" className="eyebrow">
        Project details
      </h2>
      <label className="block">
        <span className="eyebrow">Name</span>
        <input className="field mt-2" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} required />
      </label>
      <label className="block">
        <span className="eyebrow">Size / colourway</span>
        <input className="field mt-2" value={sizeColorway} onChange={(e) => setSizeColorway(e.target.value)} maxLength={200} />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="eyebrow">Started</span>
          <input type="date" className="field mt-2" value={startedOn} onChange={(e) => setStartedOn(e.target.value)} />
        </label>
        <label className="block">
          <span className="eyebrow">Finished</span>
          <input type="date" className="field mt-2" value={finishedOn} onChange={(e) => setFinishedOn(e.target.value)} />
        </label>
      </div>
      <label className="block">
        <span className="eyebrow">Notes &amp; modifications</span>
        <textarea className="field mt-2 min-h-32" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={10000} />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-ink" disabled={pending || !name.trim()}>
          {pending ? "Saving…" : "Save details"}
        </button>
        <Note m={message} />
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------- steps */

export function StepChecklist({ projectId, sections }: { projectId: string; sections: ProjectDetail["sections"] }) {
  const [done, setDone] = useState(() => new Set(sections.flatMap((s) => s.steps.filter((st) => st.done).map((st) => st.id))));
  const [, start] = useTransition();
  const total = sections.reduce((n, s) => n + s.steps.length, 0);
  if (total === 0) return null;
  return (
    <section aria-labelledby="steps" className="surface-panel rounded-card p-5 sm:p-6">
      <div className="flex items-baseline justify-between">
        <h2 id="steps" className="eyebrow">
          Steps for this project
        </h2>
        <span className="font-mono text-sm text-muted">
          {done.size}/{total}
        </span>
      </div>
      {sections.map((s) => (
        <div key={s.id} className="mt-4">
          <h3 className="font-semibold text-strong">{s.title}</h3>
          <ul className="mt-2 space-y-1">
            {s.steps.map((st) => (
              <li key={st.id}>
                <label className="flex min-h-11 items-start gap-3 rounded-tile px-2 py-2 hover:bg-selected">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-5 shrink-0 accent-[#081638]"
                    checked={done.has(st.id)}
                    onChange={(e) => {
                      const next = new Set(done);
                      if (e.target.checked) next.add(st.id);
                      else next.delete(st.id);
                      setDone(next);
                      start(async () => void (await setStepDone({ projectId, stepId: st.id, done: e.target.checked })));
                    }}
                  />
                  <span className={`text-sm ${done.has(st.id) ? "text-muted line-through" : "text-body"}`}>
                    {st.row_start && (
                      <span className="mr-1 font-mono text-xs">
                        {st.row_end && st.row_end !== st.row_start ? `Rows ${st.row_start}–${st.row_end}` : `Row ${st.row_start}`}:
                      </span>
                    )}
                    {st.body}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/* ------------------------------------------------------------------ sessions */

export function Sessions({ projectId, sessions }: { projectId: string; sessions: ProjectDetail["sessions"] }) {
  const [minutes, setMinutes] = useState("30");
  const [date, setDate] = useState(() => todayLocal());
  const [note, setNote] = useState("");
  const { pending, message, run } = useSaver();
  const total = Math.round(sessions.reduce((n, s) => n + (s.duration_seconds ?? 0), 0) / 60);
  return (
    <section aria-labelledby="sessions" className="surface-panel rounded-card p-5 sm:p-6">
      <div className="flex items-baseline justify-between">
        <h2 id="sessions" className="eyebrow">
          Work sessions
        </h2>
        {total > 0 && <span className="font-mono text-sm text-muted">{Math.floor(total / 60)}h {total % 60}m total</span>}
      </div>
      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => logSession({ projectId, minutes: Number(minutes), date, note }), "Session logged");
          setNote("");
        }}
      >
        <label className="w-24">
          <span className="eyebrow">Minutes</span>
          <input type="number" inputMode="numeric" min={1} max={1440} className="field mt-1" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </label>
        <label className="w-40">
          <span className="eyebrow">Date</span>
          <input type="date" className="field mt-1" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="min-w-0 flex-1 basis-40">
          <span className="eyebrow">Note</span>
          <input className="field mt-1" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Finished the yoke" />
        </label>
        <button type="submit" className="btn btn-ink" disabled={pending}>
          Log
        </button>
      </form>
      <div className="mt-2 min-h-5">
        <Note m={message} />
      </div>
      {sessions.length > 0 && (
        <ul className="mt-2 divide-y divide-line">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="w-20 shrink-0 font-mono text-muted">{new Date(s.started_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
              <span className="w-16 shrink-0 font-semibold text-strong">{Math.round((s.duration_seconds ?? 0) / 60)} min</span>
              <span className="min-w-0 flex-1 truncate text-body">{s.note}</span>
              <button type="button" aria-label="Delete session" className="grid size-9 place-items-center rounded-full text-muted hover:bg-selected" onClick={() => run(() => deleteSession(s.id), "Removed")}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------- photos */

export function Photos({ project, photos }: { project: P; photos: ProjectDetail["photos"] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const { message, run } = useSaver();
  const [error, setError] = useState<string | null>(null);

  const upload = async (files: FileList) => {
    setError(null);
    for (const file of Array.from(files)) {
      const problem = validateUpload("image", file.type, file.size);
      if (problem) {
        setError(`${file.name}: ${problem}`);
        continue;
      }
      try {
        setBusy(`Uploading ${file.name}…`);
        const path = await uploadFile(file, { scope: "projects", parentId: project.id, kind: "image", fileName: file.name }, (f) =>
          setBusy(`Uploading ${file.name}… ${Math.round(f * 100)}%`),
        );
        const r = await addProjectPhoto({ projectId: project.id, path, fileName: file.name, mimeType: file.type, size: file.size });
        if (!r.ok) setError(r.error);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed.");
      }
    }
    setBusy(null);
  };

  return (
    <section aria-labelledby="photos" className="surface-panel rounded-card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id="photos" className="eyebrow">
          Photos
        </h2>
        <label className="btn btn-secondary !min-h-10 cursor-pointer">
          ＋ Add photos
          <input
            type="file"
            accept={IMAGE_TYPES.join(",")}
            multiple
            className="sr-only"
            onChange={(e) => {
              if (e.target.files?.length) void upload(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {busy && <p className="mt-2 text-sm text-body" role="status">{busy}</p>}
      {error && <p className="mt-2 text-sm font-semibold text-[#a3123f]" role="alert">{error}</p>}
      <Note m={message} />
      {photos.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Progress shots and the finished piece live here — private to you.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((ph) => (
            <li key={ph.id} className="group relative aspect-square overflow-hidden rounded-tile bg-midnight/10">
              {ph.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ph.url} alt={ph.file_name ?? "Project photo"} loading="lazy" className="size-full object-cover" />
              )}
              {project.cover_path === ph.storage_path && (
                <span className="absolute top-1.5 left-1.5 rounded-full bg-midnight/85 px-2 py-0.5 text-[0.65rem] font-semibold text-neon">Cover</span>
              )}
              <div className="absolute inset-x-1.5 bottom-1.5 flex gap-1">
                {project.cover_path !== ph.storage_path && (
                  <button type="button" className="rounded-full bg-white/90 px-2 py-1 text-[0.7rem] font-semibold text-strong" onClick={() => run(() => updateProject({ id: project.id, coverPath: ph.storage_path }), "Cover updated")}>
                    Cover
                  </button>
                )}
                <button type="button" aria-label="Remove photo" className="ml-auto rounded-full bg-white/90 px-2 py-1 text-[0.7rem] font-semibold text-[#a3123f]" onClick={() => run(() => removeProjectPhoto(ph.id), "Removed")}>
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------- delete */

export function DeleteProject({ project }: { project: P }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <button type="button" className="min-h-11 px-2 text-sm font-semibold text-[#a3123f]" onClick={() => setOpen(true)}>
        Delete project…
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Delete project?"
        footer={
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn btn-danger"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await deleteProject(project.id);
                  if (!r.ok) return setError(r.error);
                  router.push(r.patternId ? `/patterns/${r.patternId}` : "/patterns");
                })
              }
            >
              Delete permanently
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
              Keep it
            </button>
          </div>
        }
      >
        <p className="text-body">
          <strong className="text-strong">{project.name}</strong> — its notes, sessions and photos — will be deleted. The pattern stays.
        </p>
        {error && <p className="mt-3 text-sm font-semibold text-[#a3123f]">{error}</p>}
      </Sheet>
    </>
  );
}
