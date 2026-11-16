"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { NumberedHeading } from "@/components/editorial/foil";
import { Sheet } from "@/components/ui/sheet";
import { addProjectPhoto, removeProjectPhoto, updateProject } from "@/lib/library/actions";
import { uploadFile } from "@/lib/library/client-files";
import { IMAGE_TYPES, PROJECT_STATUSES, statusLabel, todayLocal, validateUpload } from "@/lib/library/constants";
import { syncWorkspace } from "@/lib/workspace/actions";
import { computeProgress, PROGRESS_METHODS, type Op, type Snapshot } from "@/lib/workspace/model";

const op = (o: Record<string, unknown>) => ({ ...o, opId: crypto.randomUUID(), at: new Date().toISOString() }) as unknown as Op;
const ErrorLine = ({ text }: { text: string | null }) =>
  text ? (
    <p role="alert" className="mt-3 text-sm font-semibold text-[#a3123f]">
      {text}
    </p>
  ) : null;

const STATUS_TONE: Record<string, string> = {
  in_progress: "bg-neon text-midnight",
  finished: "bg-[#dff7c4] text-[#2b4a00]",
  paused: "bg-[#fff1c9] text-[#5c4000]",
  planned: "bg-white/90 text-midnight",
  abandoned: "bg-white/60 text-midnight",
};

/** Status chip in the hero; tap to change. */
export function StatusMenu({ projectId, status, finishedOn }: { projectId: string; status: string; finishedOn: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`press inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ${STATUS_TONE[status] ?? "bg-white text-midnight"}`}
        aria-label={`Status: ${statusLabel(status)}. Change status`}
        data-testid="status-menu"
      >
        {status === "in_progress" && <span className="size-1.5 rounded-full bg-midnight motion-safe:animate-pulse" aria-hidden="true" />}
        {statusLabel(status)} <span aria-hidden="true">▾</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Project status">
        <div className="grid gap-2" role="radiogroup" aria-label="Status">
          {PROJECT_STATUSES.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={status === s.value}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await updateProject({ id: projectId, status: s.value, finishedOn: s.value === "finished" ? (finishedOn ?? todayLocal()) : undefined });
                  if (!r.ok) return setError(r.error);
                  setOpen(false);
                  router.refresh();
                })
              }
              className="press flex min-h-12 items-center justify-between rounded-tile border border-line bg-white px-4 text-left font-semibold text-strong aria-checked:border-midnight aria-checked:bg-selected"
            >
              {s.label}
              {status === s.value && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
        <ErrorLine text={error} />
      </Sheet>
    </>
  );
}

type ProjectFields = {
  id: string;
  name: string;
  status: string;
  size_colorway: string | null;
  started_on: string | null;
  finished_on: string | null;
  notes: string | null;
};

/** All editable project fields live here, not on the page. */
export function EditProject({ project, trigger = "button" }: { project: ProjectFields; trigger?: "button" | "notes" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    name: project.name,
    sizeColorway: project.size_colorway ?? "",
    startedOn: project.started_on ?? "",
    finishedOn: project.finished_on ?? "",
    notes: project.notes ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const r = await updateProject({
        id: project.id,
        name: f.name,
        sizeColorway: f.sizeColorway,
        startedOn: f.startedOn || null,
        finishedOn: project.status === "finished" ? f.finishedOn || null : null,
        notes: f.notes,
      });
      if (!r.ok) return setError(r.error);
      setOpen(false);
      router.refresh();
    });
  return (
    <>
      {trigger === "notes" ? (
        <button type="button" onClick={() => setOpen(true)} className="press text-sm font-semibold text-accent hover:underline" data-testid="edit-notes">
          Edit
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="btn btn-secondary press" data-testid="edit-project">
          Edit project
        </button>
      )}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Edit project"
        footer={
          <button type="button" className="btn btn-ink w-full" disabled={pending || !f.name.trim()} onClick={save}>
            {pending ? "Saving…" : "Save changes"}
          </button>
        }
      >
        <div className="space-y-5">
          <label className="block">
            <span className="eyebrow">Name</span>
            <input className="field mt-2" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={200} required />
          </label>
          <label className="block">
            <span className="eyebrow">Size / colourway</span>
            <input className="field mt-2" value={f.sizeColorway} onChange={(e) => setF({ ...f, sizeColorway: e.target.value })} maxLength={200} placeholder="Size M · grey heather" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="eyebrow">Started</span>
              <input type="date" className="field mt-2" value={f.startedOn} onChange={(e) => setF({ ...f, startedOn: e.target.value })} />
            </label>
            {project.status === "finished" && (
              <label className="block">
                <span className="eyebrow">Finished</span>
                <input type="date" className="field mt-2" value={f.finishedOn} onChange={(e) => setF({ ...f, finishedOn: e.target.value })} />
              </label>
            )}
          </div>
          <label className="block">
            <span className="eyebrow">Notes &amp; modifications</span>
            <textarea className="field mt-2 min-h-36" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={10000} data-testid="edit-notes-field" />
          </label>
          <p className="text-xs text-muted">Categorised notes (substitutions, gauge, mistakes…) are added in Work Mode → Notes.</p>
          <ErrorLine text={error} />
        </div>
      </Sheet>
    </>
  );
}

/** Progress, presented — with a quick editor that keeps progress history. */
export function ProgressCard({ snapshot }: { snapshot: Snapshot }) {
  const router = useRouter();
  const summary = computeProgress(snapshot);
  const p = snapshot.project;
  const method = PROGRESS_METHODS.find((m) => m.value === p.progress_method)?.label ?? "Percentage";
  const done = snapshot.milestones.filter((m) => m.done_at);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(summary.percent);
  const [doneUnits, setDoneUnits] = useState(String(p.progress_done));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const manualUnits = (p.progress_method === "units" || p.progress_method === "rows") && !p.progress_counter_id;
  const editable = p.progress_method === "manual" || manualUnits;

  const save = () =>
    start(async () => {
      const patch: Record<string, unknown> = {};
      let next = summary;
      if (p.progress_method === "manual") {
        patch.progress = value;
        next = { ...summary, percent: value };
      } else {
        const n = Math.max(0, Number.parseInt(doneUnits, 10) || 0);
        next = computeProgress({ ...snapshot, project: { ...p, progress_done: n } });
        patch.progress_done = n;
        patch.progress = next.percent;
      }
      const r = await syncWorkspace(p.id, [
        op({ type: "project.update", patch }),
        op({ type: "progress.record", event: { id: crypto.randomUUID(), session_id: null, recorded_at: new Date().toISOString(), method: p.progress_method, percent: next.percent, done: next.done, target: next.target, note: null } }),
      ]);
      if (!r.ok) return setError(r.error);
      setOpen(false);
      router.refresh();
    });

  return (
    <section aria-labelledby="progress-title" className="card-plain rounded-card p-5 sm:p-6" data-testid="progress-card">
      <div className="flex items-start justify-between gap-3">
        <h2 id="progress-title" className="font-semibold text-strong">
          Progress <span className="font-normal text-muted">· {method.toLowerCase()}</span>
        </h2>
        {editable ? (
          <button type="button" className="press text-sm font-semibold text-accent hover:underline" onClick={() => setOpen(true)} data-testid="edit-progress">
            Update
          </button>
        ) : (
          <Link href={`/projects/${p.id}/work`} className="text-sm font-semibold text-accent hover:underline">
            Update in Work Mode
          </Link>
        )}
      </div>
      <p className="mt-3 text-strong">
        {summary.target !== null && summary.done !== null ? (
          <>
            <span className="iridescent-text font-display-tight text-[2.4rem] leading-none">{summary.done}</span>
            <span className="text-muted">
              {" "}
              / {summary.target} {summary.label}
            </span>
          </>
        ) : (
          <span className="iridescent-text font-display-tight text-[2.4rem] leading-none">{summary.percent}%</span>
        )}
      </p>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-midnight/[0.08]" role="progressbar" aria-valuenow={summary.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
        <div className="h-full rounded-full bg-gradient-to-r from-cobalt to-[#7a5cff]" style={{ width: `${summary.percent}%` }} />
      </div>
      <p className="mt-1.5 text-sm text-muted">
        {summary.percent}% complete{summary.remaining !== null ? ` · ${summary.remaining} to go` : ""}
      </p>
      {snapshot.milestones.length > 0 && (
        <ul className="mt-5 flex flex-wrap gap-1.5" aria-label="Milestones">
          {snapshot.milestones.map((m) => (
            <li key={m.id} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${m.done_at ? "bg-[#e6ffb3] text-[#2b4a00]" : "bg-selected text-muted"}`}>
              {m.done_at ? "★ " : ""}
              {m.title}
            </li>
          ))}
          <li className="px-1 py-1 text-xs text-muted">
            {done.length}/{snapshot.milestones.length} milestones
          </li>
        </ul>
      )}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Update progress"
        footer={
          <button type="button" className="btn btn-ink w-full" disabled={pending} onClick={save}>
            {pending ? "Saving…" : "Save progress"}
          </button>
        }
      >
        {p.progress_method === "manual" ? (
          <label className="block">
            <span className="flex justify-between">
              <span className="eyebrow">Percent complete</span>
              <span className="font-mono text-lg font-semibold text-strong">{value}%</span>
            </span>
            <input type="range" min={0} max={100} value={value} onChange={(e) => setValue(Number(e.target.value))} className="mt-3 h-10 w-full accent-[#081638]" aria-label="Percent complete" />
          </label>
        ) : (
          <label className="block">
            <span className="eyebrow">Completed {summary.label}</span>
            <div className="mt-2 flex items-center gap-2">
              <input type="number" inputMode="numeric" min={0} className="field w-28" value={doneUnits} onChange={(e) => setDoneUnits(e.target.value)} />
              {summary.target && <span className="text-muted">of {summary.target}</span>}
            </div>
          </label>
        )}
        <p className="mt-4 text-xs text-muted">Every update is kept in your progress history. Change the tracking method in Work Mode → Progress.</p>
        <ErrorLine text={error} />
      </Sheet>
    </section>
  );
}

type GalleryPhoto = { id: string; url: string | null; storage_path: string; file_name: string | null; session_id: string | null; created_at: string };

/** Editorial gallery: a lead image and a filmstrip. Hidden until there are photos. */
export function PhotoGallery({ projectId, coverPath, photos, n }: { projectId: string; coverPath: string | null; photos: GalleryPhoto[]; n?: number }) {
  const router = useRouter();
  const [viewing, setViewing] = useState<GalleryPhoto | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const sorted = [...photos].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const lead = sorted.find((p) => p.storage_path === coverPath) ?? sorted[0];
  const rest = sorted.filter((p) => p !== lead);

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
        const path = await uploadFile(file, { scope: "projects", parentId: projectId, kind: "image", fileName: file.name }, (f) => setBusy(`Uploading ${file.name}… ${Math.round(f * 100)}%`));
        const r = await addProjectPhoto({ projectId, path, fileName: file.name, mimeType: file.type, size: file.size });
        if (!r.ok) setError(r.error);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed.");
      }
    }
    setBusy(null);
    router.refresh();
  };

  const picker = (label: string, className: string) => (
    <label className={`${className} cursor-pointer`}>
      {label}
      <input type="file" accept={IMAGE_TYPES.join(",")} multiple className="sr-only" onChange={(e) => (e.target.files?.length && void upload(e.target.files), (e.target.value = ""))} data-testid="project-photo-input" />
    </label>
  );

  if (!photos.length) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border-2 border-dashed border-line px-5 py-4">
        <p className="text-sm text-body">
          <strong className="text-strong">No photos yet.</strong> Progress shots and the finished piece live here, private to you.
        </p>
        {picker("📷 Add photos", "btn btn-secondary press !min-h-10")}
        {busy && <p className="w-full text-sm text-body" role="status">{busy}</p>}
        <ErrorLine text={error} />
      </div>
    );
  }

  return (
    <section aria-labelledby="photos-title" data-testid="photo-gallery">
      <div className="flex items-end justify-between gap-3">
        <NumberedHeading n={n ?? 1} id="photos-title" size="sm">
          Photos <span className="font-mono text-base font-normal text-muted">{photos.length}</span>
        </NumberedHeading>
        {picker("＋ Add", "btn btn-secondary press !min-h-10")}
      </div>
      {busy && <p className="mt-2 text-sm text-body" role="status">{busy}</p>}
      <ErrorLine text={error} />
      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {lead && (
          <button type="button" onClick={() => setViewing(lead)} className="press relative aspect-[4/3] overflow-hidden rounded-card bg-selected" aria-label="View photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {lead.url && <img src={lead.url} alt={lead.file_name ?? "Project photo"} className="size-full object-cover" />}
            {lead.storage_path === coverPath && <span className="absolute top-3 left-3 rounded-full bg-midnight/85 px-2.5 py-1 text-xs font-semibold text-neon">Cover</span>}
          </button>
        )}
        {rest.length > 0 && (
          <ul className="grid grid-cols-3 gap-2 self-start sm:grid-cols-2">
            {rest.slice(0, 6).map((ph) => (
              <li key={ph.id}>
                <button type="button" onClick={() => setViewing(ph)} className="press block aspect-square w-full overflow-hidden rounded-tile bg-selected" aria-label="View photo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {ph.url && <img src={ph.url} alt={ph.file_name ?? "Project photo"} loading="lazy" className="size-full object-cover" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Sheet open={Boolean(viewing)} onClose={() => setViewing(null)} title="Photo">
        {viewing && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {viewing.url && <img src={viewing.url} alt="" className="w-full rounded-tile" />}
            <div className="mt-4 flex flex-wrap gap-3">
              {viewing.storage_path !== coverPath && (
                <button
                  type="button"
                  className="btn btn-secondary press"
                  disabled={pending}
                  onClick={() => start(async () => (await updateProject({ id: projectId, coverPath: viewing.storage_path }), setViewing(null), router.refresh()))}
                >
                  Use as project cover
                </button>
              )}
              <button
                type="button"
                className="min-h-11 text-sm font-semibold text-[#a3123f]"
                disabled={pending}
                onClick={() => window.confirm("Delete this photo?") && start(async () => (await removeProjectPhoto(viewing.id), setViewing(null), router.refresh()))}
              >
                Delete photo
              </button>
            </div>
          </>
        )}
      </Sheet>
    </section>
  );
}

/** Phone: a compact way back into Work Mode, shown only once the hero is out of view. */
export function FloatingWorkButton({ href, label, targetId }: { href: string; label: string; targetId: string }) {
  const [visible, setVisible] = useState(false);
  const observe = (node: HTMLAnchorElement | null) => {
    const hero = document.getElementById(targetId);
    if (!node || !hero) return;
    const io = new IntersectionObserver(([e]) => setVisible(!e.isIntersecting), { threshold: 0 });
    io.observe(hero);
    return () => io.disconnect();
  };
  return (
    <div
      className={`fixed inset-x-0 bottom-[calc(var(--tabbar-height)+env(safe-area-inset-bottom)+0.5rem)] z-30 flex justify-center px-4 md:hidden motion-safe:transition-all motion-safe:duration-300 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      }`}
    >
      <Link ref={observe} href={href} className="btn btn-primary press shadow-[0_12px_30px_-10px_rgb(8_22_56/0.6)]" data-testid="mobile-work-mode" tabIndex={visible ? 0 : -1}>
        {label}
      </Link>
    </div>
  );
}
