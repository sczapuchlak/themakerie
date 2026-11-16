"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/sheet";
import { FOLDER_COLOR_HEX, FOLDER_COLORS, type FolderColor } from "@/lib/library/constants";
import { createFolder, deleteFolder, updateFolder } from "@/lib/library/actions";

export type FolderOption = { id: string; name: string; parent_id: string | null; color?: string | null };

/** Path label like "Crochet / Sweaters" for folder pickers. */
export function folderLabel(folders: FolderOption[], id: string) {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const parts: string[] = [];
  let f = byId.get(id);
  while (f && parts.length < 20) {
    parts.unshift(f.name);
    f = f.parent_id ? byId.get(f.parent_id) : undefined;
  }
  return parts.join(" / ");
}

function descendants(folders: FolderOption[], id: string) {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of folders) {
      if (f.parent_id && out.has(f.parent_id) && !out.has(f.id)) {
        out.add(f.id);
        grew = true;
      }
    }
  }
  return out;
}

export function FolderDialog({
  open,
  onClose,
  folders,
  folder,
  defaultParentId = null,
}: {
  open: boolean;
  onClose: () => void;
  folders: FolderOption[];
  folder?: FolderOption & { pattern_count?: number | null };
  defaultParentId?: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(folder?.name ?? "");
  const [parentId, setParentId] = useState<string | null>(folder ? folder.parent_id : defaultParentId);
  const [color, setColor] = useState<string | null>(folder?.color ?? null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();

  const blocked = folder ? descendants(folders, folder.id) : new Set<string>();
  const options = folders.filter((f) => !blocked.has(f.id)).sort((a, b) => folderLabel(folders, a.id).localeCompare(folderLabel(folders, b.id)));
  const parentName = parentId ? folderLabel(folders, parentId) : null;

  const save = () =>
    start(async () => {
      setError(null);
      const result = folder
        ? await updateFolder({ id: folder.id, name, parentId, color })
        : await createFolder({ name, parentId, color });
      if (!result.ok) return setError(result.error);
      onClose();
      if (!folder && "id" in result) router.push(`/patterns/folders/${result.id}`);
    });

  const remove = () =>
    start(async () => {
      if (!folder) return;
      const result = await deleteFolder(folder.id);
      if (!result.ok) return setError(result.error);
      onClose();
      router.push(folder.parent_id ? `/patterns/folders/${folder.parent_id}` : "/patterns");
    });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={folder ? "Edit folder" : "New folder"}
      footer={
        confirmDelete ? (
          <div className="space-y-3">
            <p className="text-sm text-body">
              Delete <strong className="text-strong">{folder?.name}</strong>? Its patterns and sub-folders move to{" "}
              <strong className="text-strong">{folder?.parent_id ? folderLabel(folders, folder.parent_id) : "Unsorted"}</strong>.
              No patterns are deleted.
            </p>
            <div className="flex gap-3">
              <button type="button" className="btn btn-danger" disabled={pending} onClick={remove}>
                Delete folder
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmDelete(false)}>
                Keep it
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-ink" disabled={pending || !name.trim()} onClick={save}>
              {pending ? "Saving…" : folder ? "Save" : "Create folder"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            {folder && (
              <button type="button" className="ml-auto min-h-11 text-sm font-semibold text-[#a3123f]" onClick={() => setConfirmDelete(true)}>
                Delete…
              </button>
            )}
          </div>
        )
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label className="block">
          <span className="eyebrow">Name</span>
          <input className="field mt-2" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus placeholder="Sweaters" />
        </label>
        <label className="block">
          <span className="eyebrow">Inside</span>
          <select className="field mt-2" value={parentId ?? ""} onChange={(e) => setParentId(e.target.value || null)}>
            <option value="">Top level</option>
            {options.map((f) => (
              <option key={f.id} value={f.id}>
                {folderLabel(folders, f.id)}
              </option>
            ))}
          </select>
          {parentName && <span className="mt-1 block text-xs text-muted">Will appear inside {parentName}.</span>}
        </label>
        <fieldset>
          <legend className="eyebrow">Colour</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="chip" aria-pressed={color === null} onClick={() => setColor(null)}>
              None
            </button>
            {FOLDER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className="grid size-10 place-items-center rounded-full ring-midnight ring-offset-2 aria-pressed:ring-2"
                style={{ backgroundColor: FOLDER_COLOR_HEX[c as FolderColor] }}
              />
            ))}
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="text-sm font-medium text-[#a3123f]">
            {error}
          </p>
        )}
      </form>
    </Sheet>
  );
}

export function FolderButton({
  folders,
  folder,
  defaultParentId,
  label,
  className = "btn btn-secondary",
}: {
  folders: FolderOption[];
  folder?: FolderOption & { pattern_count?: number | null };
  defaultParentId?: string | null;
  label: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && (
        <FolderDialog open onClose={() => setOpen(false)} folders={folders} folder={folder} defaultParentId={defaultParentId} />
      )}
    </>
  );
}
