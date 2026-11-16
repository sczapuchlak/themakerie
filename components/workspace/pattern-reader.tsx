"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { CoverAura } from "@/components/library/cover-palette";
import { StartProject } from "@/components/library/pattern-actions";
import { defaultGuide, type Bookmark, type ReaderState, type Source } from "@/lib/workspace/model";
import { Reader, type ReaderDoc } from "./reader";

const key = (patternId: string, docId: string) => `makerie-read:${patternId}:${docId}`;
const load = <T,>(k: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const save = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

/**
 * Read a pattern in the app without starting a project. Your place is kept
 * on this device; once you start a project, Work Mode keeps it per project.
 */
export function PatternReader({
  pattern,
  coverUrl,
  sources,
  active,
}: {
  pattern: { id: string; title: string; coverPath: string | null };
  coverUrl: string | null;
  sources: Source[];
  active: { id: string; name: string }[];
}) {
  const router = useRouter();
  // Saved places live in localStorage: render the reader only in the browser.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const docs = useMemo<ReaderDoc[]>(() => {
    const pdfs = sources.filter((s) => s.kind === "pdf").map((s): ReaderDoc => ({ id: s.id, kind: "pdf", title: s.title || s.file_name || "Pattern PDF", sources: [s] }));
    const images = sources.filter((s) => s.kind === "image");
    return images.length ? [...pdfs, { id: images[0].id, kind: "images", title: images.length > 1 ? "Images" : "Image", sources: images }] : pdfs;
  }, [sources]);
  const [docId, setDocId] = useState(docs[0]?.id ?? "");
  const doc = docs.find((d) => d.id === docId);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => (typeof window === "undefined" ? [] : load(`${key(pattern.id, "bookmarks")}`, [])));
  const initial = useMemo<ReaderState | null>(
    () =>
      doc
        ? (typeof window === "undefined" ? null : load<ReaderState | null>(key(pattern.id, doc.id), null)) ?? {
            source_id: doc.id,
            page: 1,
            zoom: 1,
            fit: "width",
            scroll_left: 0,
            scroll_top: 0,
            guides: [defaultGuide()],
          }
        : null,
    [doc, pattern.id],
  );
  const onState = useCallback((s: ReaderState) => doc && save(key(pattern.id, doc.id), s), [doc, pattern.id]);
  const setMarks = (next: Bookmark[]) => {
    setBookmarks(next);
    save(key(pattern.id, "bookmarks"), next);
  };
  const refresh = useCallback(async () => router.refresh(), [router]);

  return (
    <div className="tone-midnight fixed inset-0 isolate flex flex-col bg-midnight" data-testid="pattern-reader">
      <header className="relative isolate flex items-center gap-2 overflow-hidden border-b border-white/10 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <CoverAura src={coverUrl} cacheKey={pattern.coverPath} className="opacity-60" />
        <Link href={`/patterns/${pattern.id}`} aria-label="Back to pattern" className="grid size-11 shrink-0 place-items-center rounded-full text-xl text-white hover:bg-white/10">
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] font-semibold tracking-[0.16em] text-white/60 uppercase">Reading</p>
          <h1 className="truncate font-display-tight text-[1.15rem] leading-tight text-white">{pattern.title}</h1>
        </div>
        {active.length > 0 ? (
          <Link href={`/projects/${active[0].id}/work`} className="btn btn-primary !min-h-10 !px-4">
            Work on {active.length > 1 ? "a project" : active[0].name}
          </Link>
        ) : (
          <StartProject patternId={pattern.id} patternTitle={pattern.title} className="btn btn-primary !min-h-10 !px-4" label="＋ Start project" />
        )}
      </header>
      {docs.length > 1 && (
        <nav aria-label="Files" className="flex gap-1 overflow-x-auto border-b border-white/10 px-2 py-1.5 no-scrollbar">
          {docs.map((d) => (
            <button key={d.id} type="button" aria-pressed={d.id === docId} onClick={() => setDocId(d.id)} className="min-h-9 shrink-0 rounded-full px-3 text-sm font-semibold text-white/75 aria-pressed:bg-white aria-pressed:text-midnight">
              {d.title}
            </button>
          ))}
        </nav>
      )}
      <main className="relative min-h-0 flex-1" id="main">
        {!mounted ? null : doc && initial ? (
          <Reader
            key={doc.id}
            doc={doc}
            state={initial}
            onState={onState}
            bookmarks={bookmarks}
            onBookmark={(b) => setMarks([...bookmarks, { ...b, id: crypto.randomUUID() }])}
            onDeleteBookmark={(id) => setMarks(bookmarks.filter((b) => b.id !== id))}
            rowDirection="down"
            nudge={{ seq: 0, rows: 0 }}
            onNeedFreshUrls={refresh}
          />
        ) : (
          <p className="p-6 text-white/70">This pattern has no PDF or images to read.</p>
        )}
      </main>
    </div>
  );
}
