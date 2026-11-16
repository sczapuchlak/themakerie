"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/sheet";
import { archivePattern, createProject, deletePattern, movePattern, setFavorite } from "@/lib/library/actions";
import { PROJECT_STATUSES, statusLabel, todayLocal } from "@/lib/library/constants";
import { folderLabel, type FolderOption } from "./folder-dialog";

const ErrorText = ({ children }: { children: React.ReactNode }) => (
  <p role="alert" className="mt-3 text-sm font-semibold text-[#a3123f]">
    {children}
  </p>
);

export function FavoriteToggle({ id, favorite }: { id: string; favorite: boolean }) {
  const [on, setOn] = useState(favorite);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={pending}
      onClick={() =>
        start(async () => {
          setOn(!on);
          const r = await setFavorite(id, !on);
          if (!r.ok) setOn(on);
        })
      }
      className="btn btn-secondary"
    >
      <span aria-hidden="true" className={on ? "text-[#6a8f00]" : ""}>
        {on ? "★" : "☆"}
      </span>
      {on ? "Favorite" : "Add to favorites"}
    </button>
  );
}

export function MovePattern({ id, folderId, folders }: { id: string; folderId: string | null; folders: FolderOption[] }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(folderId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        Move…
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Move to folder"
        footer={
          <button
            type="button"
            className="btn btn-ink w-full"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await movePattern(id, target || null);
                if (!r.ok) return setError(r.error);
                setOpen(false);
              })
            }
          >
            Move
          </button>
        }
      >
        <div className="space-y-2" role="radiogroup" aria-label="Folder">
          {[{ id: "", label: "Unsorted" }, ...folders.map((f) => ({ id: f.id, label: folderLabel(folders, f.id) })).sort((a, b) => a.label.localeCompare(b.label))].map(
            (option) => (
              <label key={option.id || "unsorted"} className="flex min-h-11 items-center gap-3 rounded-tile px-3 hover:bg-selected">
                <input type="radio" name="folder" className="size-5 accent-[#081638]" checked={target === option.id} onChange={() => setTarget(option.id)} />
                <span className="text-strong">{option.label}</span>
              </label>
            ),
          )}
        </div>
        {error && <ErrorText>{error}</ErrorText>}
      </Sheet>
    </>
  );
}

export function ArchivePattern({ id, archived }: { id: string; archived: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => start(async () => void (await archivePattern(id, !archived)))}>
      {archived ? "Restore from archive" : "Archive"}
    </button>
  );
}

export function DeletePattern({ id, title, projectCount }: { id: string; title: string; projectCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmProjects, setConfirmProjects] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const canDelete = projectCount === 0 || confirmProjects;
  return (
    <>
      <button type="button" className="min-h-11 px-2 text-sm font-semibold text-[#a3123f]" onClick={() => setOpen(true)}>
        Delete…
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Delete pattern?"
        footer={
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn btn-danger"
              disabled={pending || !canDelete}
              onClick={() =>
                start(async () => {
                  const r = await deletePattern(id, { deleteProjects: confirmProjects });
                  if (!r.ok) return setError(r.error);
                  router.push("/patterns/all");
                })
              }
            >
              {pending ? "Deleting…" : "Delete permanently"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        }
      >
        <p className="text-body">
          <strong className="text-strong">{title}</strong> and its files will be removed. This can&rsquo;t be undone.
        </p>
        {projectCount > 0 && (
          <div className="mt-4 rounded-tile border border-[#a3123f]/30 bg-[#fde7f1] p-4 text-sm text-[#5c0a26]">
            <p>
              It has <strong>{projectCount} project{projectCount === 1 ? "" : "s"}</strong>, including any finished ones and their photos.
              To keep that history, <strong>archive</strong> the pattern instead.
            </p>
            <label className="mt-3 flex min-h-11 items-center gap-3 font-semibold">
              <input type="checkbox" className="size-5" checked={confirmProjects} onChange={(e) => setConfirmProjects(e.target.checked)} />
              Also delete {projectCount === 1 ? "its project" : `all ${projectCount} projects`}
            </label>
          </div>
        )}
        {error && <ErrorText>{error}</ErrorText>}
      </Sheet>
    </>
  );
}

export function StartProject({ patternId, patternTitle, primary = false }: { patternId: string; patternTitle: string; primary?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(patternTitle);
  const [sizeColorway, setSizeColorway] = useState("");
  const [status, setStatus] = useState("in_progress");
  const [startedOn, setStartedOn] = useState(() => todayLocal());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <button type="button" className={primary ? "btn btn-primary" : "btn btn-ink"} onClick={() => setOpen(true)}>
        ＋ Start new project
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Start a project"
        footer={
          <button
            type="button"
            className="btn btn-ink w-full"
            disabled={pending || !name.trim()}
            onClick={() =>
              start(async () => {
                const r = await createProject({ patternId, name, sizeColorway, status, startedOn: status === "planned" ? null : startedOn, notes });
                if (!r.ok) return setError(r.error);
                router.push(`/projects/${r.id}`);
              })
            }
          >
            {pending ? "Starting…" : "Start project"}
          </button>
        }
      >
        <div className="space-y-5">
          <label className="block">
            <span className="eyebrow">Project name</span>
            <input className="field mt-2" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
          </label>
          <label className="block">
            <span className="eyebrow">Size / colourway</span>
            <input className="field mt-2" value={sizeColorway} onChange={(e) => setSizeColorway(e.target.value)} placeholder="Size M · grey heather" maxLength={200} />
          </label>
          <fieldset>
            <legend className="eyebrow">Status</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {PROJECT_STATUSES.filter((s) => s.value !== "abandoned").map((s) => (
                <button key={s.value} type="button" className="chip" aria-pressed={status === s.value} onClick={() => setStatus(s.value)}>
                  {s.label}
                </button>
              ))}
            </div>
          </fieldset>
          {status !== "planned" && (
            <label className="block">
              <span className="eyebrow">Start date</span>
              <input type="date" className="field mt-2" value={startedOn} onChange={(e) => setStartedOn(e.target.value)} />
            </label>
          )}
          <label className="block">
            <span className="eyebrow">Notes</span>
            <textarea className="field mt-2 min-h-24" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={10000} />
          </label>
          {error && <ErrorText>{error}</ErrorText>}
        </div>
      </Sheet>
    </>
  );
}

/** With several active projects, Continue asks which one — never guesses. */
export function ContinueChooser({ projects }: { projects: { id: string; name: string; progress: number | null; status: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        Continue… ({projects.length})
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Which project?">
        <ul className="space-y-2">
          {projects.map((p) => (
            <li key={p.id}>
              <Link href={`/projects/${p.id}`} className="flex min-h-14 items-center justify-between gap-4 rounded-tile border border-line bg-white px-4">
                <span className="font-semibold text-strong">{p.name}</span>
                <span className="text-sm text-muted">
                  {statusLabel(p.status)}
                  {p.progress !== null ? ` · ${p.progress}%` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
