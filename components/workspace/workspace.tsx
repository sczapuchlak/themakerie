"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CoverAura, usePalette } from "@/components/library/cover-palette";
import { Sheet } from "@/components/ui/sheet";
import { statusLabel } from "@/lib/library/constants";
import { idb } from "@/lib/workspace/idb";
import { computeProgress, openSession, readerStateFor, type Counter, type ReaderState, type Snapshot, type Source } from "@/lib/workspace/model";
import { registerServiceWorker } from "@/lib/workspace/offline";
import { useWorkspace } from "@/lib/workspace/use-workspace";
import { CounterDock, CounterList } from "./counters";
import { NotesPanel, OfflinePanel, PhotosPanel, ProgressPanel, StepsPanel } from "./panels";
import { Reader, type ReaderDoc } from "./reader";
import { FinishSession, RecoverSession, TimerControl } from "./session";

const PANELS = [
  { id: "counters", label: "Counters" },
  { id: "steps", label: "Steps" },
  { id: "notes", label: "Notes" },
  { id: "progress", label: "Progress" },
  { id: "photos", label: "Photos" },
  { id: "offline", label: "Offline" },
] as const;
type PanelId = (typeof PANELS)[number]["id"];

/** PDFs are separate documents; all images form one picture book. */
function buildDocs(sources: Source[]): ReaderDoc[] {
  const pdfs = sources
    .filter((s) => s.kind === "pdf" && s.storage_path)
    .map((s): ReaderDoc => ({ id: s.id, kind: "pdf", title: s.title || s.file_name || "Pattern PDF", sources: [s] }));
  const images = sources.filter((s) => s.kind === "image" && s.storage_path);
  return images.length ? [...pdfs, { id: images[0].id, kind: "images", title: images.length > 1 ? "Images" : "Image", sources: images }] : pdfs;
}

export function Workspace({ initial }: { initial: Snapshot }) {
  const ws = useWorkspace(initial);
  // Stable callbacks (ws itself is a new object every render).
  const { dispatch, changeCounter, undo: undoChange } = ws;
  const s = ws.state;
  const open = openSession(s.sessions);
  const progress = computeProgress(s);
  const docs = useMemo(() => buildDocs(s.sources), [s.sources]);
  const views = useMemo(() => [...docs.map((d) => ({ id: d.id, label: d.title })), ...(s.sections.length ? [{ id: "steps", label: "Steps" }] : [])], [docs, s.sections.length]);

  const [viewId, setViewId] = useState(() => (views.some((v) => v.id === initial.project.workspace.sourceId) ? initial.project.workspace.sourceId! : (views[0]?.id ?? "notes")));
  const [panel, setPanel] = useState<PanelId>("counters");
  const [toolsOpen, setToolsOpen] = useState(false);
  const main = s.counters.find((c) => c.is_main) ?? s.counters[0];
  const [selected, setSelected] = useState(main?.id ?? "");
  const [nudge, setNudge] = useState({ seq: 0, rows: 0 });
  const [finishing, setFinishing] = useState<Date | null>(null);
  const [recover, setRecover] = useState<Date | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }, []);

  const follow = Boolean(s.project.workspace.followCounter);
  const rowDirection = s.project.workspace.rowDirection ?? "down";

  /* ---------- counters ---------- */
  const tap = useCallback(
    (c: Counter, sign: 1 | -1) => {
      const amount = sign * c.step;
      const r = changeCounter(c.id, "add", amount, open?.id ?? null, `${c.name} ${sign > 0 ? "+" : "−"}${c.step}`);
      if (r.rolls > 0) {
        const linked = s.counters.find((x) => x.id === c.rollover_counter_id);
        notify(`${c.name} reached ${c.target} and started over at ${r.counter?.value ?? 0}${linked ? ` · ${linked.name} +${r.rolls}` : ""}`);
      }
      if (c.is_main && follow && r.counter?.value !== c.value) setNudge((n) => ({ seq: n.seq + 1, rows: sign }));
      if (typeof navigator.vibrate === "function") navigator.vibrate(8);
    },
    [changeCounter, open?.id, s.counters, follow, notify],
  );

  const undo = useCallback(() => {
    const last = ws.undoStack.at(-1);
    const mainRestore = last?.restore.find((r) => r.counterId === main?.id);
    const label = undoChange();
    if (!label) return;
    notify(`Undid ${label}`);
    if (follow && mainRestore && main) {
      const delta = mainRestore.value - main.value;
      if (delta !== 0 && Math.abs(delta) <= 5) setNudge((n) => ({ seq: n.seq + 1, rows: delta }));
    }
  }, [ws.undoStack, undoChange, main, follow, notify]);

  /* ---------- reader state & last view ---------- */
  const onReaderState = useCallback((state: ReaderState) => dispatch({ type: "reader.save", state }), [dispatch]);
  const chooseView = (id: string) => {
    setViewId(id);
    if (id !== "steps") ws.dispatch({ type: "project.update", patch: { workspace: { ...s.project.workspace, sourceId: id } } });
  };

  /* ---------- keep stored progress in step with connected counters ---------- */
  useEffect(() => {
    if (!ws.loaded || s.project.progress_method === "manual" || progress.percent === s.project.progress) return;
    const t = setTimeout(() => dispatch({ type: "project.update", patch: { progress: progress.percent } }), 2500);
    return () => clearTimeout(t);
  }, [dispatch, ws.loaded, progress.percent, s.project.progress, s.project.progress_method]);

  /* ---------- recover a session interrupted by closing / locking ---------- */
  const checkedRecovery = useRef(false);
  useEffect(() => {
    if (!ws.loaded || checkedRecovery.current) return;
    checkedRecovery.current = true;
    if (open?.status !== "active") return;
    void idb.getMeta<string>(`activity:${s.project.id}`).then((last) => {
      if (!last) return;
      const t = new Date(last);
      if (Date.now() - t.getTime() > 45 * 60_000 && t.getTime() > new Date(open.resumed_at ?? open.started_at).getTime()) setRecover(t);
    });
  }, [ws.loaded, open, s.project.id]);

  /* ---------- keep the screen awake while a session runs ---------- */
  useEffect(() => {
    if (open?.status !== "active" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const acquire = async () => {
      try {
        if (document.visibilityState === "visible") lock = await navigator.wakeLock.request("screen");
      } catch {}
    };
    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release();
    };
  }, [open?.status]);

  useEffect(() => {
    void registerServiceWorker();
  }, []);

  const palette = usePalette(s.pattern?.coverUrl, s.pattern?.cover_path);
  const doc = docs.find((d) => d.id === viewId);
  const undoLabel = ws.undoStack.at(-1)?.label ?? null;
  const syncDot = !ws.sync.online ? "bg-white/40" : ws.sync.pending ? "bg-peach" : "bg-neon";
  const syncText = !ws.sync.online ? "Offline" : ws.sync.pending ? "Saving…" : "Synced";

  const panelBody = (id: PanelId) => {
    switch (id) {
      case "counters":
        return <CounterList ws={ws} sections={s.sections} selectedId={selected} onSelect={setSelected} onTap={tap} />;
      case "steps":
        return <StepsPanel ws={ws} />;
      case "notes":
        return <NotesPanel ws={ws} />;
      case "progress":
        return <ProgressPanel ws={ws} />;
      case "photos":
        return <PhotosPanel ws={ws} openSessionId={open?.id ?? null} />;
      case "offline":
        return (
          <div className="space-y-6">
            <ReaderPrefs ws={ws} />
            <OfflinePanel ws={ws} />
          </div>
        );
    }
  };

  const tabs = (
    <div role="tablist" aria-label="Tools" className="flex gap-1.5 overflow-x-auto border-b border-line px-3 py-2 no-scrollbar">
      {PANELS.map((p) => (
        <button
          key={p.id}
          role="tab"
          type="button"
          aria-selected={panel === p.id}
          onClick={() => setPanel(p.id)}
          className="min-h-10 shrink-0 rounded-full px-3.5 text-sm font-semibold text-muted transition-colors hover:bg-selected aria-selected:bg-midnight aria-selected:text-neon"
        >
          {p.label}
        </button>
      ))}
    </div>
  );

  return (
    <div
      className="tone-midnight fixed inset-0 isolate flex flex-col bg-midnight"
      data-testid="workspace"
      style={{ "--ws-a": palette[0], "--ws-b": palette[1] ?? palette[0], "--ws-c": palette[2] ?? palette[0] } as React.CSSProperties}
    >
      {/* Top bar, tinted by the pattern's cover */}
      <header className="relative isolate flex items-center gap-2 overflow-hidden border-b border-white/10 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] [@media(max-height:500px)]:py-1">
        <CoverAura src={s.pattern?.coverUrl ?? null} cacheKey={s.pattern?.cover_path ?? null} className="opacity-70" />
        <Link href={`/projects/${s.project.id}`} aria-label="Leave Work Mode" className="grid size-11 shrink-0 place-items-center rounded-full text-xl text-white hover:bg-white/10">
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display-tight text-[1.15rem] leading-tight text-white">{s.project.name}</h1>
          <p className="flex items-center gap-1.5 truncate text-xs text-white/70">
            <span>{statusLabel(s.project.status)}</span>
            <span aria-hidden="true">·</span>
            <span data-testid="header-progress">{progress.percent}%</span>
            <span aria-hidden="true">·</span>
            <span className={`inline-block size-2 rounded-full ${syncDot}`} aria-hidden="true" />
            <span data-testid="sync-label">{syncText}</span>
          </p>
        </div>
        <TimerControl ws={ws} open={open} onFinish={() => setFinishing(new Date())} />
      </header>

      {views.length > 1 && (
        <nav aria-label="Pattern views" className="flex gap-1 overflow-x-auto border-b border-white/10 px-2 py-1.5 no-scrollbar">
          {views.map((v) => (
            <button key={v.id} type="button" aria-pressed={viewId === v.id} onClick={() => chooseView(v.id)} className="min-h-9 shrink-0 rounded-full px-3 text-sm font-semibold text-white/75 aria-pressed:bg-white aria-pressed:text-midnight">
              {v.label}
            </button>
          ))}
        </nav>
      )}

      <div className="flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1" id="main">
          {doc ? (
            <Reader
              key={doc.id}
              doc={doc}
              state={readerStateFor(s, doc.id)}
              onState={onReaderState}
              bookmarks={s.bookmarks}
              onBookmark={(b) => ws.dispatch({ type: "bookmark.upsert", bookmark: { ...b, id: crypto.randomUUID() } })}
              onDeleteBookmark={(id) => ws.dispatch({ type: "bookmark.delete", id })}
              rowDirection={rowDirection}
              nudge={nudge}
              onNeedFreshUrls={ws.refresh}
            />
          ) : (
            <div className="tone-paper h-full overflow-y-auto bg-paper p-4 sm:p-6">
              {viewId === "steps" ? (
                <StepsPanel ws={ws} />
              ) : (
                <>
                  <p className="mb-4 text-sm text-muted">This pattern has no PDF or images to read here. Your notes, counters and steps work as usual.</p>
                  <NotesPanel ws={ws} />
                </>
              )}
            </div>
          )}
          {/* Sync problems stay until read — never silent. */}
          {ws.sync.issues.length > 0 && (
            <div className="tone-paper absolute inset-x-3 top-3 z-30 rounded-card bg-[#fff6dc] p-3 text-sm text-[#5c4000] shadow-xl" role="alert" data-testid="sync-issues">
              <ul className="list-disc pl-5">
                {ws.sync.issues.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
              <button type="button" className="mt-2 min-h-9 font-semibold underline" onClick={ws.dismissIssues}>
                Got it
              </button>
            </div>
          )}
          {toast && (
            <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-3">
              <p role="status" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-midnight shadow-xl" data-testid="toast">
                {toast}
              </p>
            </div>
          )}
        </main>

        {/* Desktop tools */}
        <aside className="tone-paper hidden w-[26rem] shrink-0 flex-col border-l border-white/10 bg-paper lg:flex" aria-label="Tools">
          <div className="tone-midnight relative isolate overflow-hidden bg-midnight p-3">
            <div aria-hidden="true" className="absolute -top-16 -right-10 -z-10 size-56 rounded-full opacity-40 blur-3xl" style={{ background: "var(--ws-a)" }} />
            <CounterDock counters={s.counters} selectedId={selected} onSelect={setSelected} onTap={tap} onUndo={undo} undoLabel={undoLabel} />
          </div>
          {tabs}
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{panelBody(panel)}</div>
        </aside>
      </div>

      {/* Phone dock: one-handed counter, tools in a sheet */}
      <footer className="border-t border-white/10 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] lg:hidden">
        <div className="flex h-[4.5rem] items-stretch gap-2 [@media(max-height:500px)]:h-14">
          <button type="button" onClick={() => setToolsOpen(true)} className="grid w-12 shrink-0 place-items-center rounded-card bg-white/10 text-white" aria-label="Open tools" data-testid="open-tools">
            <span aria-hidden="true" className="text-xl">☰</span>
          </button>
          <div className="min-w-0 flex-1">
            <CounterDock counters={s.counters} selectedId={selected} onSelect={setSelected} onTap={tap} onUndo={undo} undoLabel={undoLabel} compact />
          </div>
        </div>
      </footer>

      <Sheet open={toolsOpen} onClose={() => setToolsOpen(false)} title="Tools">
        <div className="-mx-5 -mt-5 mb-4">{tabs}</div>
        {panelBody(panel)}
      </Sheet>

      {finishing && open && <FinishSession ws={ws} session={open} endAt={finishing} onClose={() => setFinishing(null)} />}
      {recover && open && (
        <RecoverSession ws={ws} open={open} lastActivity={recover} onClose={() => setRecover(null)} onFinishAt={(at) => setFinishing(at)} />
      )}
    </div>
  );
}

function ReaderPrefs({ ws }: { ws: ReturnType<typeof useWorkspace> }) {
  const w = ws.state.project.workspace;
  const set = (patch: Partial<typeof w>) => ws.dispatch({ type: "project.update", patch: { workspace: { ...w, ...patch } } });
  return (
    <section className="rounded-card border border-line bg-white p-4">
      <h3 className="font-semibold text-strong">Reading</h3>
      <label className="mt-2 flex min-h-11 items-center gap-3">
        <input type="checkbox" className="size-5 accent-[#081638]" checked={Boolean(w.followCounter)} onChange={(e) => set({ followCounter: e.target.checked })} data-testid="follow-counter" />
        <span>Move the row highlighter when the main counter changes</span>
      </label>
      <fieldset className="mt-2">
        <legend className="text-sm text-muted">Rows advance</legend>
        <div className="mt-1 flex gap-2">
          <button type="button" className="chip" aria-pressed={(w.rowDirection ?? "down") === "down"} onClick={() => set({ rowDirection: "down" })}>
            Down the page ↓
          </button>
          <button type="button" className="chip" aria-pressed={w.rowDirection === "up"} onClick={() => set({ rowDirection: "up" })}>
            Up (charts) ↑
          </button>
        </div>
      </fieldset>
    </section>
  );
}
