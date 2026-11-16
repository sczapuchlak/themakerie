"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  checkDuplicates,
  discardUploads,
  fetchLinkPreview,
  importCoverFromUrl,
  savePattern,
  type LinkPreview,
  type SourceInput,
} from "@/lib/library/actions";
import { formatBytes, inspectPdf, sha256Hex, toCoverJpeg, uploadFile } from "@/lib/library/client-files";
import { CRAFT_FIELDS, DIFFICULTY, IMAGE_TYPES, SOURCE_LABEL, validateUpload, type SourceKind } from "@/lib/library/constants";
import { CoverArt } from "./cover-art";
import { folderLabel, type FolderOption } from "./folder-dialog";

/* ----------------------------------------------------------------- types */

type DraftSource = SourceInput & {
  key: string;
  previewUrl?: string | null;
  status: "ready" | "uploading" | "error";
  progress?: number;
  error?: string;
};

export type EditorInitial = {
  id: string;
  isNew: boolean;
  title: string;
  craft: string;
  folderId: string | null;
  designer: string;
  sourceName: string;
  description: string;
  category: string;
  difficulty: number | null;
  techniques: string;
  materials: string;
  tools: string;
  sizes: string;
  dimensions: string;
  craftDetails: Record<string, string>;
  tags: string;
  notes: string;
  favorite: boolean;
  coverPath: string | null;
  coverUrl: string | null;
  sources: (SourceInput & { id: string; previewUrl?: string | null })[];
};

type Duplicate = { id: string; title: string; reason: string };

const key = () => Math.random().toString(36).slice(2);
const splitList = (value: string) => value.split(",").map((v) => v.trim()).filter(Boolean);

/* --------------------------------------------------------------- editor */

export function PatternEditor({
  initial,
  folders,
  crafts,
  startWith,
}: {
  initial: EditorInitial;
  folders: FolderOption[];
  crafts: { slug: string; name: string }[];
  startWith?: SourceKind | "manual" | null;
}) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [sources, setSources] = useState<DraftSource[]>(() =>
    initial.sources.map((s) => ({ ...s, key: s.id, status: "ready" as const })),
  );
  const [removed, setRemoved] = useState<string[]>([]);
  const [coverPath, setCoverPathState] = useState(initial.coverPath);
  // Always-current cover, for async upload callbacks.
  const coverRef = useRef(initial.coverPath);
  const setCoverPath = (path: string | null) => {
    coverRef.current = path;
    setCoverPathState(path);
  };
  const [coverUrl, setCoverUrl] = useState(initial.coverUrl);
  const [coverBusy, setCoverBusy] = useState(false);
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, startSave] = useTransition();
  const uploaded = useRef<string[]>([]);
  const savedRef = useRef(false);

  const set = <K extends keyof EditorInitial>(k: K, v: EditorInitial[K]) => {
    setF((prev) => ({ ...prev, [k]: v }));
    setDirty(true);
  };

  // Guard against losing unsaved work.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty && !savedRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const uploading = sources.some((s) => s.status === "uploading") || coverBusy;
  const craftFields = CRAFT_FIELDS[f.craft] ?? [];

  const addDuplicates = (found: Duplicate[]) =>
    setDuplicates((prev) => {
      const map = new Map(prev.map((d) => [d.id, d]));
      for (const d of found) map.set(d.id, d);
      return [...map.values()];
    });

  /* ---------------------------------------------------------- cover */

  const setCoverFrom = async (blob: Blob | HTMLCanvasElement) => {
    setCoverBusy(true);
    try {
      const jpeg = await toCoverJpeg(blob);
      const path = await uploadFile(jpeg, { scope: "patterns", parentId: f.id, kind: "cover", fileName: "cover.jpg" });
      uploaded.current.push(path);
      setCoverPath(path);
      setCoverUrl(URL.createObjectURL(jpeg));
      setDirty(true);
    } catch (e) {
      if (coverRef.current === "pending") coverRef.current = null;
      setError(e instanceof Error ? e.message : "Couldn't set the cover.");
    } finally {
      setCoverBusy(false);
    }
  };

  /* ------------------------------------------------------- files */

  const addFiles = async (files: FileList | File[], kind: "pdf" | "image") => {
    setError(null);
    for (const file of Array.from(files)) {
      const type = file.type || (kind === "pdf" ? "application/pdf" : "");
      const problem = validateUpload(kind, type, file.size);
      const k = key();
      if (problem) {
        setSources((prev) => [...prev, { key: k, kind, fileName: file.name, status: "error", error: problem }]);
        continue;
      }
      setSources((prev) => [
        ...prev,
        { key: k, kind, fileName: file.name, mimeType: type, sizeBytes: file.size, status: "uploading", progress: 0 },
      ]);
      setDirty(true);
      const patch = (p: Partial<DraftSource>) => setSources((prev) => prev.map((s) => (s.key === k ? { ...s, ...p } : s)));
      try {
        const sha = await sha256Hex(file);
        void checkDuplicates({ patternId: f.isNew ? undefined : f.id, sha256: [sha] }).then(addDuplicates);
        const [path, info] = await Promise.all([
          uploadFile(file, { scope: "patterns", parentId: f.id, kind, fileName: file.name }, (progress) => patch({ progress })),
          kind === "pdf" ? inspectPdf(file) : Promise.resolve({ pageCount: null, firstPage: null }),
        ]);
        uploaded.current.push(path);
        patch({
          status: "ready",
          storagePath: path,
          sha256: sha,
          pageCount: info.pageCount,
          previewUrl: kind === "image" ? URL.createObjectURL(file) : null,
          title: file.name.replace(/\.[^.]+$/, ""),
        });
        const suggested = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
        setF((prev) => (prev.title.trim() ? prev : { ...prev, title: suggested }));
        if (!coverRef.current) {
          coverRef.current = "pending";
          if (info.firstPage) await setCoverFrom(info.firstPage);
          else if (kind === "image") await setCoverFrom(file).catch(() => undefined);
          if (coverRef.current === "pending") coverRef.current = null;
        }
      } catch (e) {
        patch({ status: "error", error: e instanceof Error ? e.message : "Upload failed." });
      }
    }
  };

  /* ------------------------------------------------------- links */

  const addLink = async (url: string, kind: "website" | "video"): Promise<string | null> => {
    const result = await fetchLinkPreview({ url, kind, patternId: f.isNew ? undefined : f.id });
    if (!result.ok) return result.error;
    const p: LinkPreview = result.preview;
    if (sources.some((s) => s.url === p.url)) return "That link is already attached.";
    setSources((prev) => [
      ...prev,
      {
        key: key(),
        kind: p.kind,
        url: p.url,
        title: p.metadata.title,
        metadata: { ...p.metadata, fetched: p.fetched },
        previewUrl: p.metadata.imageUrl,
        status: "ready",
      },
    ]);
    addDuplicates(p.duplicates);
    // Prefill only what's empty; everything stays editable.
    setF((prev) => ({
      ...prev,
      title: prev.title || p.metadata.title || "",
      description: prev.description || p.metadata.description || "",
      designer: prev.designer || p.metadata.author || "",
      sourceName: prev.sourceName || p.metadata.siteName || "",
    }));
    setDirty(true);
    if (!coverRef.current && p.metadata.imageUrl && p.kind === "website") {
      coverRef.current = "pending";
      setCoverBusy(true);
      const cover = await importCoverFromUrl({ imageUrl: p.metadata.imageUrl, patternId: f.id });
      setCoverBusy(false);
      if (cover.ok) {
        uploaded.current.push(cover.path);
        setCoverPath(cover.path);
        setCoverUrl(p.metadata.imageUrl);
      } else {
        coverRef.current = null;
      }
    }
    return p.fetched ? null : "Couldn't read that page — the link is saved; fill in the details yourself.";
  };

  const removeSource = (s: DraftSource) => {
    setSources((prev) => prev.filter((x) => x.key !== s.key));
    if (s.id) setRemoved((prev) => [...prev, s.id!]);
    setDirty(true);
  };

  /* -------------------------------------------------------- save */

  const save = () =>
    startSave(async () => {
      setError(null);
      if (!f.title.trim()) return setError("Give the pattern a title.");
      if (!f.craft) return setError("Choose a craft.");
      const result = await savePattern({
        id: f.id,
        isNew: f.isNew,
        title: f.title,
        craft: f.craft,
        folderId: f.folderId,
        designer: f.designer,
        sourceName: f.sourceName,
        description: f.description,
        category: f.category,
        difficulty: f.difficulty,
        techniques: splitList(f.techniques),
        materials: f.materials,
        tools: f.tools,
        sizes: f.sizes,
        dimensions: f.dimensions,
        craftDetails: f.craftDetails,
        tags: splitList(f.tags),
        notes: f.notes,
        favorite: f.favorite,
        coverPath,
        sources: sources
          .filter((s) => s.status === "ready")
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          .map(({ key: _k, previewUrl: _p, status: _s, progress: _pr, error: _e, ...rest }) => rest),
        removedSourceIds: removed,
      });
      if (!result.ok) return setError(result.error);
      savedRef.current = true;
      // Drop uploads that were replaced or removed before saving.
      const kept = new Set([coverPath, ...sources.map((s) => s.storagePath)]);
      const stray = uploaded.current.filter((p) => !kept.has(p));
      if (stray.length) void discardUploads(stray);
      router.push(`/patterns/${result.id}`);
    });

  const cancel = async () => {
    if (dirty && !window.confirm("Discard your changes?")) return;
    savedRef.current = true;
    if (uploaded.current.length) await discardUploads(uploaded.current);
    router.push(f.isNew ? "/patterns" : `/patterns/${f.id}`);
  };

  /* -------------------------------------------------------- render */

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="pb-28"
      noValidate
    >
      {/* Essentials */}
      <section className="surface-panel mt-6 rounded-panel p-5 sm:p-7" aria-labelledby="essentials">
        <h2 id="essentials" className="eyebrow">
          Essentials
        </h2>
        <div className="mt-4 grid gap-6 md:grid-cols-[11rem_1fr]">
          <CoverPicker
            url={coverUrl}
            title={f.title || "New pattern"}
            craft={f.craft}
            busy={coverBusy}
            onFile={(file) => void setCoverFrom(file)}
            onClear={() => {
              setCoverPath(null);
              setCoverUrl(null);
              setDirty(true);
            }}
          />
          <div className="space-y-5">
            <Field label="Title" required>
              <input
                className="field"
                value={f.title}
                onChange={(e) => set("title", e.target.value)}
                onBlur={() => f.title.trim().length >= 3 && void checkDuplicates({ patternId: f.isNew ? undefined : f.id, title: f.title }).then(addDuplicates)}
                maxLength={200}
                placeholder="My Comfiest Cardigan"
              />
            </Field>
            <fieldset>
              <legend className="eyebrow">
                Craft <span className="text-[#a3123f]">*</span>
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {crafts.map((c) => (
                  <button key={c.slug} type="button" className="chip" aria-pressed={f.craft === c.slug} onClick={() => set("craft", c.slug)}>
                    {c.name}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Designer">
                <input className="field" value={f.designer} onChange={(e) => set("designer", e.target.value)} maxLength={200} />
              </Field>
              <Field label="Source / publication">
                <input className="field" value={f.sourceName} onChange={(e) => set("sourceName", e.target.value)} maxLength={200} placeholder="Ravelry, a book, a magazine…" />
              </Field>
            </div>
            <Field label="Folder">
              <select className="field" value={f.folderId ?? ""} onChange={(e) => set("folderId", e.target.value || null)}>
                <option value="">Unsorted</option>
                {folders
                  .map((fo) => ({ id: fo.id, label: folderLabel(folders, fo.id) }))
                  .sort((a, b) => a.label.localeCompare(b.label))
                  .map((fo) => (
                    <option key={fo.id} value={fo.id}>
                      {fo.label}
                    </option>
                  ))}
              </select>
            </Field>
          </div>
        </div>
      </section>

      {duplicates.length > 0 && (
        <div role="status" className="mt-4 rounded-card border border-[#c98a00]/40 bg-[#fff6dc] px-5 py-4 text-sm text-[#5c4000]">
          <p className="font-semibold">You might already have this pattern:</p>
          <ul className="mt-1 list-disc pl-5">
            {duplicates.map((d) => (
              <li key={d.id}>
                <Link href={`/patterns/${d.id}`} target="_blank" className="font-semibold underline">
                  {d.title}
                </Link>{" "}
                ({d.reason})
              </li>
            ))}
          </ul>
          <p className="mt-1">You can still save this one — nothing is merged automatically.</p>
        </div>
      )}

      {/* Sources */}
      <section className="surface-panel mt-4 rounded-panel p-5 sm:p-7" aria-labelledby="sources">
        <h2 id="sources" className="eyebrow">
          Sources
        </h2>
        <p className="mt-1 text-sm text-muted">The original pattern — kept exactly as you add it. Add as many as you like.</p>
        {sources.length > 0 && (
          <ul className="mt-4 space-y-2">
            {sources.map((s) => (
              <SourceRow
                key={s.key}
                source={s}
                onRemove={() => removeSource(s)}
                onTitle={(title) => {
                  setSources((prev) => prev.map((x) => (x.key === s.key ? { ...x, title } : x)));
                  setDirty(true);
                }}
              />
            ))}
          </ul>
        )}
        <SourceAdder startWith={startWith} onFiles={addFiles} onLink={addLink} />
      </section>

      {/* Details */}
      <Disclosure title="Details" hint="Description, difficulty, materials, sizes" defaultOpen={!f.isNew}>
        <Field label="Description">
          <textarea className="field min-h-28" value={f.description} onChange={(e) => set("description", e.target.value)} maxLength={5000} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Item type">
            <input className="field" value={f.category} onChange={(e) => set("category", e.target.value)} placeholder="Cardigan, hat, sampler…" maxLength={100} />
          </Field>
          <Field label="Difficulty">
            <select className="field" value={f.difficulty ?? ""} onChange={(e) => set("difficulty", e.target.value ? Number(e.target.value) : null)}>
              <option value="">Not set</option>
              {DIFFICULTY.map((d, i) => (
                <option key={d} value={i + 1}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sizes">
            <input className="field" value={f.sizes} onChange={(e) => set("sizes", e.target.value)} placeholder="XS–3XL" maxLength={1000} />
          </Field>
          <Field label="Finished dimensions">
            <input className="field" value={f.dimensions} onChange={(e) => set("dimensions", e.target.value)} maxLength={1000} />
          </Field>
        </div>
        <Field label="Techniques" hint="Separate with commas">
          <input className="field" value={f.techniques} onChange={(e) => set("techniques", e.target.value)} placeholder="Raglan, short rows, colourwork" />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Materials">
            <textarea className="field min-h-24" value={f.materials} onChange={(e) => set("materials", e.target.value)} maxLength={3000} />
          </Field>
          <Field label="Tools">
            <textarea className="field min-h-24" value={f.tools} onChange={(e) => set("tools", e.target.value)} maxLength={3000} />
          </Field>
        </div>
        {craftFields.length > 0 && (
          <div className="grid gap-5 border-t border-line pt-5 sm:grid-cols-2">
            {craftFields.map((cf) => (
              <Field key={cf.key} label={cf.label}>
                <input
                  className="field"
                  value={f.craftDetails[cf.key] ?? ""}
                  placeholder={cf.placeholder}
                  onChange={(e) => set("craftDetails", { ...f.craftDetails, [cf.key]: e.target.value })}
                  maxLength={300}
                />
              </Field>
            ))}
          </div>
        )}
      </Disclosure>

      {/* Organize */}
      <Disclosure title="Organize & notes" hint="Tags, favorite, personal notes" defaultOpen={!f.isNew && Boolean(f.notes || f.tags)}>
        <Field label="Tags" hint="Separate with commas">
          <input className="field" value={f.tags} onChange={(e) => set("tags", e.target.value)} placeholder="gift, cozy, winter" />
        </Field>
        <label className="flex min-h-11 items-center gap-3 font-semibold text-strong">
          <input type="checkbox" className="size-5 accent-[#081638]" checked={f.favorite} onChange={(e) => set("favorite", e.target.checked)} />
          Favorite
        </label>
        <Field label="Personal notes">
          <textarea className="field min-h-28" value={f.notes} onChange={(e) => set("notes", e.target.value)} maxLength={10000} />
        </Field>
      </Disclosure>

      {/* Sticky save bar, within thumb reach on iPhone */}
      <div className="fixed inset-x-0 bottom-[calc(var(--tabbar-height)+env(safe-area-inset-bottom))] z-30 border-t border-line bg-paper/95 px-[max(var(--gutter),env(safe-area-inset-left))] py-3 backdrop-blur md:bottom-0 md:left-(--sidebar-w)">
        <div className="mx-auto flex max-w-[80rem] flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-ink" disabled={saving || uploading}>
            {saving ? "Saving…" : uploading ? "Uploading…" : f.isNew ? "Save pattern" : "Save changes"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => void cancel()}>
            Cancel
          </button>
          {error && (
            <p role="alert" className="text-sm font-semibold text-[#a3123f]">
              {error}
            </p>
          )}
        </div>
      </div>
    </form>
  );
}

/* ----------------------------------------------------------- pieces */

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="eyebrow">
        {label} {required && <span className="text-[#a3123f]">*</span>}
      </span>
      <span className="mt-2 block">{children}</span>
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

function Disclosure({ title, hint, defaultOpen, children }: { title: string; hint: string; defaultOpen?: boolean; children: React.ReactNode }) {
  return (
    <details className="surface-panel group mt-4 rounded-panel" open={defaultOpen}>
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-5 sm:px-7">
        <span>
          <span className="block font-display-tight text-[1.3rem] text-strong">{title}</span>
          <span className="text-xs text-muted">{hint}</span>
        </span>
        <span aria-hidden="true" className="text-xl text-muted transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="space-y-5 px-5 pb-6 sm:px-7">{children}</div>
    </details>
  );
}

function CoverPicker({
  url,
  title,
  craft,
  busy,
  onFile,
  onClear,
}: {
  url: string | null;
  title: string;
  craft: string;
  busy: boolean;
  onFile: (file: File) => void;
  onClear: () => void;
}) {
  return (
    <div>
      <span className="eyebrow">Cover</span>
      <div className="relative mt-2 aspect-[4/5] w-36 overflow-hidden rounded-card md:w-full">
        <CoverArt url={url} title={title} craft={craft} />
        {busy && <div className="absolute inset-0 grid place-items-center bg-midnight/60 text-sm font-semibold text-white">Working…</div>}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3">
        <label className="min-h-10 cursor-pointer text-sm font-semibold text-accent underline underline-offset-4">
          {url ? "Change" : "Upload cover"}
          <input
            type="file"
            accept={IMAGE_TYPES.join(",")}
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
              e.target.value = "";
            }}
          />
        </label>
        {url && (
          <button type="button" className="min-h-10 text-sm font-semibold text-muted" onClick={onClear}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

function SourceRow({ source, onRemove, onTitle }: { source: DraftSource; onRemove: () => void; onTitle: (t: string) => void }) {
  const isFile = source.kind === "pdf" || source.kind === "image";
  return (
    <li className="flex items-center gap-3 rounded-tile border border-line bg-white px-3 py-2.5">
      <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-midnight font-mono text-[0.6rem] font-bold text-white uppercase">
        {source.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={source.previewUrl} alt="" className="size-full object-cover" />
        ) : (
          SOURCE_LABEL[source.kind].slice(0, 4)
        )}
      </span>
      <div className="min-w-0 flex-1">
        {source.status === "ready" ? (
          <input
            aria-label="Source title"
            className="w-full truncate bg-transparent text-sm font-semibold text-strong outline-none focus:underline"
            value={source.title ?? ""}
            placeholder={source.fileName ?? source.url ?? ""}
            onChange={(e) => onTitle(e.target.value)}
          />
        ) : (
          <p className="truncate text-sm font-semibold text-strong">{source.fileName}</p>
        )}
        <p className="truncate text-xs text-muted">
          {source.status === "uploading" && `Uploading… ${Math.round((source.progress ?? 0) * 100)}%`}
          {source.status === "error" && <span className="text-[#a3123f]">{source.error}</span>}
          {source.status === "ready" &&
            (isFile
              ? [source.fileName, formatBytes(source.sizeBytes), source.pageCount ? `${source.pageCount} pages` : null].filter(Boolean).join(" · ")
              : source.url)}
        </p>
        {source.status === "uploading" && (
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-midnight/10">
            <div className="h-full bg-midnight transition-[width]" style={{ width: `${Math.round((source.progress ?? 0) * 100)}%` }} />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={source.status === "uploading"}
        aria-label={`Remove ${source.title ?? source.fileName ?? "source"}`}
        className="grid size-10 shrink-0 place-items-center rounded-full text-lg text-muted hover:bg-selected"
      >
        ×
      </button>
    </li>
  );
}

function SourceAdder({
  startWith,
  onFiles,
  onLink,
}: {
  startWith?: SourceKind | "manual" | null;
  onFiles: (files: FileList, kind: "pdf" | "image") => void;
  onLink: (url: string, kind: "website" | "video") => Promise<string | null>;
}) {
  const [linkKind, setLinkKind] = useState<"website" | "video" | null>(
    startWith === "website" || startWith === "video" ? startWith : null,
  );
  const [url, setUrl] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pdfInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const opened = useRef(false);

  // Open the chosen picker straight away when arriving from "Add pattern".
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    if (startWith === "pdf") pdfInput.current?.click();
    if (startWith === "image") imageInput.current?.click();
  }, [startWith]);

  const submitLink = async () => {
    if (!linkKind) return;
    setBusy(true);
    setNote(null);
    const message = await onLink(url, linkKind);
    setBusy(false);
    setNote(message);
    if (!message || message.startsWith("Couldn't read")) setUrl("");
  };

  const accept = useMemo(() => IMAGE_TYPES.join(","), []);

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="chip" onClick={() => pdfInput.current?.click()}>
          ＋ PDF
        </button>
        <button type="button" className="chip" onClick={() => imageInput.current?.click()}>
          ＋ Images
        </button>
        <button type="button" className="chip" aria-pressed={linkKind === "website"} onClick={() => setLinkKind(linkKind === "website" ? null : "website")}>
          ＋ Website
        </button>
        <button type="button" className="chip" aria-pressed={linkKind === "video"} onClick={() => setLinkKind(linkKind === "video" ? null : "video")}>
          ＋ Video
        </button>
      </div>
      <input
        ref={pdfInput}
        type="file"
        accept="application/pdf"
        multiple
        className="sr-only"
        aria-label="Choose PDF files"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files, "pdf");
          e.target.value = "";
        }}
      />
      <input
        ref={imageInput}
        type="file"
        accept={accept}
        multiple
        className="sr-only"
        aria-label="Choose images"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files, "image");
          e.target.value = "";
        }}
      />
      {linkKind && (
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="source-url">
            {linkKind === "video" ? "Video link" : "Pattern web page"}
          </label>
          <input
            id="source-url"
            type="url"
            inputMode="url"
            autoFocus
            className="field min-w-0 flex-1 basis-60"
            placeholder={linkKind === "video" ? "https://youtube.com/watch?v=…" : "https://…"}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submitLink();
              }
            }}
          />
          <button type="button" className="btn btn-secondary" disabled={busy || !url.trim()} onClick={() => void submitLink()}>
            {busy ? "Reading…" : "Add link"}
          </button>
        </div>
      )}
      {note && <p className="mt-2 text-sm text-body">{note}</p>}
      <p className="mt-3 text-xs text-muted">
        PDFs up to 100 MB · images up to 25 MB (JPEG, PNG, WebP, HEIC). Links keep their original address; page details are read when the site allows it.
      </p>
    </div>
  );
}
