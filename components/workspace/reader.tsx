"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { loadPdfjs } from "@/lib/library/client-files";
import { defaultGuide, GUIDE_COLORS, type Bookmark, type Guide, type ReaderState, type Source } from "@/lib/workspace/model";
import { localFileUrl } from "@/lib/workspace/offline";

/**
 * Pattern reader for PDFs and reference images.
 *
 * Pages render to canvas with PDF.js (the original file is only read, never
 * modified). Pan is native scrolling; pinch / ctrl-wheel zoom; fit-width or
 * fit-page. Guides are movable row/column highlighters stored per project,
 * so two projects on one pattern keep separate places.
 */

export type ReaderDoc = { id: string; kind: "pdf" | "images"; title: string; sources: Source[] };
type PageSize = { w: number; h: number };
type PdfDoc = Awaited<ReturnType<Awaited<ReturnType<typeof loadPdfjs>>["getDocument"]>["promise"]>;

const PAD = 12;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const MAX_CANVAS_PIXELS = 12_000_000; // under iOS Safari's canvas limit

export function Reader({
  doc,
  state,
  onState,
  bookmarks,
  onBookmark,
  onDeleteBookmark,
  rowDirection,
  nudge,
  onNeedFreshUrls,
}: {
  doc: ReaderDoc;
  state: ReaderState;
  onState: (s: ReaderState) => void;
  bookmarks: Bookmark[];
  onBookmark: (b: Omit<Bookmark, "id">) => void;
  onDeleteBookmark: (id: string) => void;
  rowDirection: "down" | "up";
  /** Increments when the main counter moves the guide (seq, rows). */
  nudge: { seq: number; rows: number };
  onNeedFreshUrls: () => Promise<void>;
}) {
  const [view, setView] = useState<ReaderState>(() => ({ ...state, guides: state.guides.length ? state.guides : [defaultGuide()] }));
  const [activeGuide, setActiveGuide] = useState(0);
  const [pdf, setPdf] = useState<PdfDoc | null>(null);
  const [imageUrls, setImageUrls] = useState<(string | null)[]>([]);
  const [pageSize, setPageSize] = useState<PageSize | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pinch, setPinch] = useState<number | null>(null);
  const [pinchOrigin, setPinchOrigin] = useState<string | undefined>(undefined);
  const [toolsOpen, setToolsOpen] = useState(true);
  const [guideSheet, setGuideSheet] = useState(false);
  const [pagesSheet, setPagesSheet] = useState(false);

  const scroller = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const pageBox = useRef<HTMLDivElement>(null);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restored = useRef(false);
  const viewRef = useRef(view);

  const pageCount = doc.kind === "pdf" ? (pdf?.numPages ?? doc.sources[0]?.page_count ?? 1) : doc.sources.length;
  const page = clamp(view.page, 1, Math.max(1, pageCount));

  /* ---------- state: local first, committed (debounced) to the project ---------- */
  const update = useCallback(
    (patch: Partial<ReaderState>, immediate = false) => {
      setView((v) => {
        const next = { ...v, ...patch };
        viewRef.current = next;
        return next;
      });
      if (commitTimer.current) clearTimeout(commitTimer.current);
      commitTimer.current = setTimeout(() => {
        commitTimer.current = null;
        onState(viewRef.current);
      }, immediate ? 0 : 900);
    },
    [onState],
  );
  // Flush a pending save on unmount only (latest callback via ref).
  const onStateRef = useRef(onState);
  useEffect(() => {
    onStateRef.current = onState;
  }, [onState]);
  useEffect(
    () => () => {
      if (commitTimer.current) {
        clearTimeout(commitTimer.current);
        commitTimer.current = null;
        onStateRef.current(viewRef.current);
      }
    },
    [],
  );

  /* ---------- load the document (local copy first, then signed URL) ---------- */
  useEffect(() => {
    let cancelled = false;
    let loadingTask: { destroy: () => Promise<void> } | null = null;
    const objectUrls: string[] = [];
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (doc.kind === "pdf") {
          const src = doc.sources[0];
          const local = await localFileUrl(src);
          if (local) objectUrls.push(local);
          let data: ArrayBuffer;
          try {
            const res = await fetch(local ?? src.fileUrl ?? "");
            if (!res.ok) throw new Error(String(res.status));
            data = await res.arrayBuffer();
          } catch {
            if (!local) await onNeedFreshUrls();
            throw new Error(navigator.onLine ? "Couldn't open the PDF. Try again." : "This PDF isn't saved for offline use yet.");
          }
          const pdfjs = await loadPdfjs();
          const task = pdfjs.getDocument({ data: new Uint8Array(data) });
          loadingTask = task;
          const loaded = await task.promise;
          if (cancelled) return;
          setPdf(loaded);
        } else {
          const urls = await Promise.all(
            doc.sources.map(async (s) => {
              const local = await localFileUrl(s);
              if (local) objectUrls.push(local);
              return local ?? s.fileUrl;
            }),
          );
          if (cancelled) return;
          setImageUrls(urls);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't open this file.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      void loadingTask?.destroy();
      objectUrls.forEach((u) => URL.revokeObjectURL(u));
    };
    // Reload only when the document (or its file version) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id, doc.sources.map((s) => s.storage_path).join("|")]);

  /* ---------- page size ---------- */
  useEffect(() => {
    let cancelled = false;
    if (doc.kind === "pdf" && pdf) {
      void pdf.getPage(page).then((p) => {
        const v = p.getViewport({ scale: 1 });
        if (!cancelled) setPageSize({ w: v.width, h: v.height });
      });
    }
    return () => {
      cancelled = true;
    };
  }, [pdf, page, doc.kind]);

  /* ---------- container size ---------- */
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = useMemo(() => {
    if (!pageSize || !box.w) return view.zoom || 1;
    const fitW = (box.w - PAD * 2) / pageSize.w;
    const fitP = Math.min(fitW, (box.h - PAD * 2) / pageSize.h);
    if (view.fit === "width") return fitW;
    if (view.fit === "page") return fitP;
    return clamp(view.zoom, fitP * 0.5, 8);
  }, [pageSize, box, view.fit, view.zoom]);

  /* ---------- render the PDF page ---------- */
  useEffect(() => {
    if (doc.kind !== "pdf" || !pdf || !pageSize || !canvas.current) return;
    let task: { cancel: () => void; promise: Promise<unknown> } | null = null;
    let cancelled = false;
    const t = setTimeout(async () => {
      const p = await pdf.getPage(page);
      if (cancelled || !canvas.current) return;
      const cssW = pageSize.w * scale;
      const cssH = pageSize.h * scale;
      let dpr = Math.min(window.devicePixelRatio || 1, 3);
      if (cssW * cssH * dpr * dpr > MAX_CANVAS_PIXELS) dpr = Math.sqrt(MAX_CANVAS_PIXELS / (cssW * cssH));
      const viewport = p.getViewport({ scale: scale * dpr });
      const c = canvas.current;
      c.width = Math.floor(viewport.width);
      c.height = Math.floor(viewport.height);
      task = p.render({ canvas: c, viewport });
      await task.promise.catch(() => {});
    }, 60);
    return () => {
      cancelled = true;
      clearTimeout(t);
      task?.cancel();
    };
  }, [pdf, page, scale, pageSize, doc.kind]);

  /* ---------- restore scroll once the first page is laid out ---------- */
  useEffect(() => {
    if (restored.current || !pageSize || !scroller.current) return;
    const el = scroller.current;
    requestAnimationFrame(() => {
      el.scrollLeft = view.scroll_left * Math.max(0, el.scrollWidth - el.clientWidth);
      el.scrollTop = view.scroll_top * Math.max(0, el.scrollHeight - el.clientHeight);
      restored.current = true;
    });
  }, [pageSize, view.scroll_left, view.scroll_top]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el || !restored.current) return;
    const left = el.scrollWidth > el.clientWidth ? el.scrollLeft / (el.scrollWidth - el.clientWidth) : 0;
    const top = el.scrollHeight > el.clientHeight ? el.scrollTop / (el.scrollHeight - el.clientHeight) : 0;
    update({ scroll_left: Math.round(left * 1000) / 1000, scroll_top: Math.round(top * 1000) / 1000 });
  };

  /* ---------- zoom ---------- */
  const zoomTo = useCallback(
    (next: number, focal?: { x: number; y: number }) => {
      const el = scroller.current;
      const target = clamp(next, 0.2, 8);
      if (el && focal) {
        const ratio = target / scale;
        const cx = el.scrollLeft + focal.x;
        const cy = el.scrollTop + focal.y;
        requestAnimationFrame(() => {
          el.scrollLeft = cx * ratio - focal.x;
          el.scrollTop = cy * ratio - focal.y;
        });
      }
      update({ zoom: target, fit: "custom" });
    },
    [scale, update],
  );

  // Pinch: CSS-scale while the fingers move, re-render once at the end.
  const pinchStart = useRef<{ dist: number; mid: { x: number; y: number } } | null>(null);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const r = el.getBoundingClientRect();
        pinchStart.current = {
          dist: dist(e.touches),
          mid: { x: (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top },
        };
        const box = pageBox.current?.getBoundingClientRect();
        if (box) {
          const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - box.left;
          const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - box.top;
          setPinchOrigin(`${midX}px ${midY}px`);
        }
      }
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchStart.current) {
        e.preventDefault();
        setPinch(clamp(dist(e.touches) / pinchStart.current.dist, 0.3, 4));
      }
    };
    const onEnd = (e: TouchEvent) => {
      if (pinchStart.current && e.touches.length < 2) {
        const start = pinchStart.current;
        pinchStart.current = null;
        setPinch((p) => {
          if (p && Math.abs(p - 1) > 0.02) zoomTo(scale * p, start.mid);
          return null;
        });
      }
    };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomTo(scale * Math.exp(-e.deltaY * 0.01), { x: e.clientX - r.left, y: e.clientY - r.top });
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
      el.removeEventListener("wheel", onWheel);
    };
  }, [scale, zoomTo]);

  /* ---------- guides ---------- */
  const guides = view.guides;
  const g = guides[Math.min(activeGuide, guides.length - 1)];
  const setGuide = (i: number, patch: Partial<Guide>) => update({ guides: guides.map((x, j) => (j === i ? { ...x, ...patch } : x)) });

  const keepGuideVisible = useCallback((guide: Guide) => {
    const el = scroller.current;
    const boxEl = pageBox.current;
    if (!el || !boxEl || guide.orientation !== "row") return;
    const top = boxEl.offsetTop + guide.pos * boxEl.offsetHeight;
    const bottom = top + guide.size * boxEl.offsetHeight;
    const margin = el.clientHeight * 0.25;
    if (top < el.scrollTop + 8) el.scrollTo({ top: Math.max(0, top - margin), behavior: "smooth" });
    else if (bottom > el.scrollTop + el.clientHeight - 8) el.scrollTo({ top: bottom - el.clientHeight + margin, behavior: "smooth" });
  }, []);

  const stepGuide = useCallback(
    (rows: number) => {
      const current = viewRef.current;
      const i = Math.min(activeGuide, current.guides.length - 1);
      const guide = current.guides[i];
      if (!guide) return;
      const dir = guide.orientation === "row" && rowDirection === "up" ? -1 : 1;
      const pos = clamp(guide.pos + rows * dir * guide.size, 0, 1 - guide.size);
      const next = { ...guide, pos };
      update({ guides: current.guides.map((x, j) => (j === i ? next : x)) });
      requestAnimationFrame(() => keepGuideVisible(next));
    },
    [activeGuide, rowDirection, update, keepGuideVisible],
  );

  // The main counter can carry the row guide along with it.
  const lastNudge = useRef(nudge.seq);
  useEffect(() => {
    if (nudge.seq === lastNudge.current) return;
    lastNudge.current = nudge.seq;
    stepGuide(nudge.rows);
  }, [nudge, stepGuide]);

  // Drag a guide by its handle (pointer capture keeps the gesture on the handle).
  const drag = useRef<{ i: number; offset: number } | null>(null);
  const onHandleDown = (i: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    const r = pageBox.current!.getBoundingClientRect();
    const guide = guides[i];
    const pointer = guide.orientation === "row" ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
    drag.current = { i, offset: pointer - guide.pos };
    setActiveGuide(i);
  };
  const onHandleMove = (e: React.PointerEvent) => {
    if (!drag.current || !pageBox.current) return;
    const r = pageBox.current.getBoundingClientRect();
    const guide = guides[drag.current.i];
    const pointer = guide.orientation === "row" ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
    setGuide(drag.current.i, { pos: clamp(pointer - drag.current.offset, 0, 1 - guide.size) });
  };
  const onHandleUp = () => {
    drag.current = null;
  };

  const goPage = (n: number) => {
    const next = clamp(n, 1, pageCount);
    if (next === page) return;
    update({ page: next, scroll_top: 0 }, true);
    requestAnimationFrame(() => scroller.current?.scrollTo({ top: 0 }));
  };

  // Keyboard: arrows move the row guide, PageUp/PageDown change pages.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable], dialog")) return;
      const actions: Record<string, () => void> = {
        ArrowDown: () => stepGuide(rowDirection === "up" ? -1 : 1),
        j: () => stepGuide(rowDirection === "up" ? -1 : 1),
        ArrowUp: () => stepGuide(rowDirection === "up" ? 1 : -1),
        k: () => stepGuide(rowDirection === "up" ? 1 : -1),
        PageDown: () => goPage(page + 1),
        PageUp: () => goPage(page - 1),
      };
      const action = actions[e.key];
      if (action) {
        e.preventDefault();
        action();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const cssW = (pageSize?.w ?? 0) * scale;
  const cssH = (pageSize?.h ?? 0) * scale;
  const pageBookmarks = bookmarks.filter((b) => b.source_id === doc.id && b.page === page);

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div
        ref={scroller}
        onScroll={onScroll}
        className="relative min-h-0 flex-1 overflow-auto overscroll-contain [touch-action:pan-x_pan-y]"
        style={{
          background:
            "radial-gradient(120% 70% at 50% -15%, color-mix(in srgb, var(--ws-a, #494AF4) 30%, transparent), transparent 60%), radial-gradient(80% 60% at 100% 110%, color-mix(in srgb, var(--ws-b, #F477D3) 24%, transparent), transparent 65%), #0a1433",
        }}
        data-testid="reader-scroller"
      >
        {loading && (
          <div className="flex justify-center p-6" role="status" aria-label={`Opening ${doc.title}`}>
            <div className="aspect-[8.5/11] w-full max-w-xl animate-pulse rounded-sm bg-white/10 p-8">
              {Array.from({ length: 9 }, (_, i) => (
                <div key={i} className="mb-4 h-3 rounded-full bg-white/15" style={{ width: `${55 + ((i * 37) % 40)}%` }} />
              ))}
            </div>
          </div>
        )}
        {error && (
          <div className="tone-paper m-6 rounded-card bg-white p-5" role="alert">
            <p className="font-semibold text-strong">{error}</p>
            <button type="button" className="btn btn-secondary mt-3" onClick={() => location.reload()}>
              Try again
            </button>
          </div>
        )}
        {!error && (
          <div style={{ padding: PAD, width: cssW ? cssW + PAD * 2 : undefined, minWidth: "100%" }} className="flex justify-center">
            <div
              ref={pageBox}
              data-testid="reader-page"
              className="relative shrink-0 bg-white shadow-[0_8px_40px_rgb(0_0_0/0.45)]"
              style={{
                width: cssW || undefined,
                height: cssH || undefined,
                transform: pinch ? `scale(${pinch})` : undefined,
                transformOrigin: pinch ? pinchOrigin : undefined,
              }}
            >
              {doc.kind === "pdf" ? (
                <canvas ref={canvas} className="block size-full" aria-label={`${doc.title}, page ${page} of ${pageCount}`} />
              ) : (
                imageUrls[page - 1] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrls[page - 1] ?? ""}
                    alt={`${doc.title}, image ${page} of ${pageCount}`}
                    className="block size-full select-none"
                    draggable={false}
                    onLoad={(e) => setPageSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                    onError={() => void onNeedFreshUrls()}
                  />
                )
              )}

              {pageSize &&
                guides.map((guide, i) => (
                  <GuideBand
                    key={guide.id}
                    guide={guide}
                    active={i === activeGuide}
                    onSelect={() => setActiveGuide(i)}
                    handleProps={{ onPointerDown: onHandleDown(i), onPointerMove: onHandleMove, onPointerUp: onHandleUp, onPointerCancel: onHandleUp }}
                  />
                ))}
              {pageBookmarks.map((b) => (
                <span
                  key={b.id}
                  className="pointer-events-none absolute -left-1 h-5 w-2 rounded-r bg-pink"
                  style={{ top: `calc(${b.y * 100}% - 10px)` }}
                  title={b.label}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reader toolbar: compact, scrollable, collapsible */}
      <div className="tone-midnight pointer-events-none absolute inset-x-0 bottom-2 flex justify-center px-2">
        <div className="pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-white/15 bg-midnight/90 p-1 shadow-xl backdrop-blur no-scrollbar">
          {toolsOpen ? (
            <>
              <ToolButton label="Previous page" onClick={() => goPage(page - 1)} disabled={page <= 1}>‹</ToolButton>
              <button type="button" className="min-h-11 shrink-0 rounded-full px-3 font-mono text-sm text-white hover:bg-white/10" onClick={() => setPagesSheet(true)} aria-label="Pages and bookmarks">
                {page}/{pageCount}
              </button>
              <ToolButton label="Next page" onClick={() => goPage(page + 1)} disabled={page >= pageCount}>›</ToolButton>
              <Divider />
              <ToolButton label="Zoom out" onClick={() => zoomTo(scale / 1.25)}>−</ToolButton>
              <button
                type="button"
                className="min-h-11 shrink-0 rounded-full px-2 text-xs font-semibold text-white hover:bg-white/10"
                onClick={() => update({ fit: view.fit === "width" ? "page" : "width" }, true)}
                aria-label={view.fit === "width" ? "Fit page" : "Fit width"}
              >
                {view.fit === "custom" ? `${Math.round(scale * 100)}%` : view.fit === "width" ? "Width" : "Page"}
              </button>
              <ToolButton label="Zoom in" onClick={() => zoomTo(scale * 1.25)}>+</ToolButton>
              <Divider />
              <ToolButton label={rowDirection === "up" ? "Next row (up)" : "Previous row"} onClick={() => stepGuide(-1)} testId="guide-prev">
                ▲
              </ToolButton>
              <ToolButton label={rowDirection === "up" ? "Previous row (down)" : "Next row"} onClick={() => stepGuide(1)} testId="guide-next">
                ▼
              </ToolButton>
              <ToolButton label="Highlighter settings" onClick={() => setGuideSheet(true)}>
                <span className="block h-2.5 w-5 rounded-sm" style={{ background: g?.color ?? "#B6FF00" }} />
              </ToolButton>
              <ToolButton
                label="Bookmark this spot"
                onClick={() => {
                  const label = window.prompt("Bookmark label", `Page ${page}`);
                  if (label?.trim()) onBookmark({ source_id: doc.id, page, y: g?.orientation === "row" ? g.pos : 0, label: label.trim() });
                }}
              >
                ★
              </ToolButton>
              <ToolButton label="Hide reader tools" onClick={() => setToolsOpen(false)}>⌄</ToolButton>
            </>
          ) : (
            <ToolButton label="Show reader tools" onClick={() => setToolsOpen(true)}>⌃</ToolButton>
          )}
        </div>
      </div>

      <Sheet open={guideSheet} onClose={() => setGuideSheet(false)} title="Highlighter">
        <GuideSettings
          guides={guides}
          active={Math.min(activeGuide, guides.length - 1)}
          onActive={setActiveGuide}
          onChange={(next) => update({ guides: next }, true)}
        />
      </Sheet>

      <Sheet open={pagesSheet} onClose={() => setPagesSheet(false)} title="Pages">
        {bookmarks.some((b) => b.source_id === doc.id) && (
          <section className="mb-5">
            <h3 className="eyebrow">Bookmarks</h3>
            <ul className="mt-2 space-y-1">
              {bookmarks
                .filter((b) => b.source_id === doc.id)
                .map((b) => (
                  <li key={b.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      className="flex min-h-11 flex-1 items-center gap-3 rounded-tile px-3 text-left hover:bg-selected"
                      onClick={() => {
                        goPage(b.page);
                        const i = guides.findIndex((x) => x.orientation === "row");
                        if (i >= 0) setGuide(i, { pos: clamp(b.y, 0, 1 - guides[i].size) });
                        setPagesSheet(false);
                      }}
                    >
                      <span className="font-mono text-xs text-muted">p.{b.page}</span>
                      <span className="font-semibold text-strong">{b.label}</span>
                    </button>
                    <button type="button" aria-label={`Delete bookmark ${b.label}`} className="grid size-10 place-items-center rounded-full text-muted hover:bg-selected" onClick={() => onDeleteBookmark(b.id)}>
                      ×
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        )}
        <label className="flex items-center gap-3">
          <span className="eyebrow">Go to page</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={pageCount}
            defaultValue={page}
            className="field w-24"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                goPage(Number(e.currentTarget.value));
                setPagesSheet(false);
              }
            }}
          />
        </label>
        <Thumbnails doc={doc} pdf={pdf} imageUrls={imageUrls} count={pageCount} current={page} onPick={(n) => (goPage(n), setPagesSheet(false))} />
      </Sheet>
    </div>
  );
}

function Divider() {
  return <span aria-hidden="true" className="mx-0.5 h-6 w-px shrink-0 bg-white/20" />;
}

function ToolButton({ label, onClick, disabled, children, testId }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode; testId?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      className="grid size-11 shrink-0 place-items-center rounded-full text-lg text-white hover:bg-white/10 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function GuideBand({
  guide,
  active,
  onSelect,
  handleProps,
}: {
  guide: Guide;
  active: boolean;
  onSelect: () => void;
  handleProps: React.HTMLAttributes<HTMLButtonElement>;
}) {
  const row = guide.orientation === "row";
  const pos = `${guide.pos * 100}%`;
  const size = `${guide.size * 100}%`;
  const band = row ? { top: pos, height: size, left: 0, right: 0 } : { left: pos, width: size, top: 0, bottom: 0 };
  const shade = "rgb(8 22 56 / 0.5)";
  return (
    <>
      {guide.shade &&
        (row ? (
          <>
            <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: pos, background: shade }} />
            <div className="pointer-events-none absolute inset-x-0 bottom-0" style={{ top: `${(guide.pos + guide.size) * 100}%`, background: shade }} />
          </>
        ) : (
          <>
            <div className="pointer-events-none absolute inset-y-0 left-0" style={{ width: pos, background: shade }} />
            <div className="pointer-events-none absolute inset-y-0 right-0" style={{ left: `${(guide.pos + guide.size) * 100}%`, background: shade }} />
          </>
        ))}
      {/* The band spans the page; the handle is sticky so it stays on screen when zoomed in. */}
      <div
        className={`pointer-events-none absolute flex ${row ? "items-center justify-end" : "flex-col items-center justify-end"}`}
        data-testid={`guide-${guide.orientation}`}
        data-pos={guide.pos.toFixed(4)}
        style={band}
      >
        <div
          className="absolute inset-0"
          style={{
            background: hexToRgba(guide.color, guide.opacity),
            [row ? "borderTop" : "borderLeft"]: `2px solid ${guide.color}`,
            [row ? "borderBottom" : "borderRight"]: `2px solid ${guide.color}`,
            mixBlendMode: "multiply",
          }}
        />
        <button
          type="button"
          aria-label={`Drag ${row ? "row" : "column"} highlighter`}
          onClick={onSelect}
          {...handleProps}
          className={`pointer-events-auto sticky z-10 grid size-11 shrink-0 cursor-grab touch-none place-items-center rounded-full border-2 text-sm font-bold shadow-lg active:cursor-grabbing ${
            row ? "right-2 mr-2" : "bottom-2 mb-2"
          } ${active ? "border-white bg-midnight text-neon" : "border-midnight/40 bg-white/90 text-midnight"}`}
        >
          {row ? "⇕" : "⇔"}
        </button>
      </div>
    </>
  );
}

function hexToRgba(hex: string, alpha: number) {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / ${alpha})`;
}

function GuideSettings({ guides, active, onActive, onChange }: { guides: Guide[]; active: number; onActive: (i: number) => void; onChange: (g: Guide[]) => void }) {
  const g = guides[active];
  const set = (patch: Partial<Guide>) => onChange(guides.map((x, i) => (i === active ? { ...x, ...patch } : x)));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Highlighters">
        {guides.map((x, i) => (
          <button key={x.id} type="button" className="chip" aria-pressed={i === active} onClick={() => onActive(i)}>
            <span className="mr-1.5 inline-block h-2.5 w-4 rounded-sm" style={{ background: x.color }} />
            {x.orientation === "row" ? "Row" : "Column"} {i + 1}
          </button>
        ))}
        {guides.length < 4 && (
          <>
            <button type="button" className="chip" onClick={() => (onChange([...guides, defaultGuide("row", 0.5)]), onActive(guides.length))}>
              ＋ Row guide
            </button>
            <button type="button" className="chip" onClick={() => (onChange([...guides, { ...defaultGuide("column", 0.4), color: GUIDE_COLORS[2] }]), onActive(guides.length))}>
              ＋ Column guide
            </button>
          </>
        )}
      </div>
      {g && (
        <>
          <fieldset>
            <legend className="eyebrow">Colour</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {GUIDE_COLORS.map((c) => (
                <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={g.color === c} onClick={() => set({ color: c })} className="size-11 rounded-full border-2 aria-pressed:border-midnight aria-pressed:ring-2 aria-pressed:ring-midnight/30" style={{ background: c, borderColor: g.color === c ? undefined : "transparent" }} />
              ))}
            </div>
          </fieldset>
          <label className="block">
            <span className="flex justify-between">
              <span className="eyebrow">Thickness (one row)</span>
              <span className="font-mono text-sm">{(g.size * 100).toFixed(1)}%</span>
            </span>
            <input type="range" min={0.4} max={20} step={0.1} value={g.size * 100} onChange={(e) => set({ size: Number(e.target.value) / 100 })} className="mt-2 h-10 w-full accent-[#081638]" />
            <span className="text-xs text-muted">Match one row or chart line so ▲▼ move exactly one row.</span>
          </label>
          <label className="block">
            <span className="flex justify-between">
              <span className="eyebrow">Opacity</span>
              <span className="font-mono text-sm">{Math.round(g.opacity * 100)}%</span>
            </span>
            <input type="range" min={5} max={90} value={Math.round(g.opacity * 100)} onChange={(e) => set({ opacity: Number(e.target.value) / 100 })} className="mt-2 h-10 w-full accent-[#081638]" />
          </label>
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" className="size-5 accent-[#081638]" checked={Boolean(g.shade)} onChange={(e) => set({ shade: e.target.checked })} />
            <span>Dim the page outside this highlighter</span>
          </label>
          {guides.length > 1 && (
            <button type="button" className="text-sm font-semibold text-[#a3123f]" onClick={() => (onChange(guides.filter((_, i) => i !== active)), onActive(0))}>
              Remove this highlighter
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Thumbnails({ doc, pdf, imageUrls, count, current, onPick }: { doc: ReaderDoc; pdf: PdfDoc | null; imageUrls: (string | null)[]; count: number; current: number; onPick: (n: number) => void }) {
  return (
    <ul className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4">
      {Array.from({ length: Math.min(count, 300) }, (_, i) => i + 1).map((n) => (
        <li key={n}>
          <button
            type="button"
            onClick={() => onPick(n)}
            aria-label={`Page ${n}`}
            aria-current={n === current ? "page" : undefined}
            className="block w-full overflow-hidden rounded-tile border-2 border-transparent bg-white aria-[current=page]:border-cobalt"
          >
            {doc.kind === "pdf" ? (
              <PdfThumb pdf={pdf} n={n} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              imageUrls[n - 1] && <img src={imageUrls[n - 1] ?? ""} alt="" className="aspect-[3/4] w-full object-cover" loading="lazy" />
            )}
            <span className="block py-1 text-center font-mono text-xs text-muted">{n}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function PdfThumb({ pdf, n }: { pdf: PdfDoc | null; n: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!pdf || !c) return;
    let task: { cancel: () => void; promise: Promise<unknown> } | null = null;
    const io = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting || task) return;
      io.disconnect();
      const page = await pdf.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: 200 / base.width });
      c.width = viewport.width;
      c.height = viewport.height;
      task = page.render({ canvas: c, viewport });
      await task.promise.catch(() => {});
    });
    io.observe(c);
    return () => {
      io.disconnect();
      task?.cancel();
    };
  }, [pdf, n]);
  return <canvas ref={ref} className="aspect-[3/4] w-full bg-white object-contain" />;
}
