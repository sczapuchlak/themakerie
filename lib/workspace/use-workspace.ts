"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { uploadFile } from "@/lib/library/client-files";
import { refreshWorkspace, syncWorkspace } from "./actions";
import { idb, type OutboxRow } from "./idb";
import { applyCounterChange, compact, replay, type Counter, type Op, type OpInput, type Snapshot } from "./model";

export type SyncState = {
  online: boolean;
  syncing: boolean;
  pending: number;
  lastSyncedAt: string | null;
  /** Things the server merged or rejected — always surfaced, never silent. */
  issues: string[];
  storage: "indexeddb" | "memory";
};

type UndoEntry = { label: string; restore: { counterId: string; value: number }[] };

let seqBase = 0;
const nextSeq = () => Date.now() * 1000 + (seqBase++ % 1000);
const isNetworkError = (e: unknown) =>
  e instanceof TypeError || (e instanceof Error && /fetch|network|load failed|offline/i.test(e.message));

export function useWorkspace(initial: Snapshot) {
  const projectId = initial.project.id;
  const [base, setBase] = useState(initial);
  const [rows, setRows] = useState<OutboxRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sync, setSync] = useState<SyncState>({ online: true, syncing: false, pending: 0, lastSyncedAt: null, issues: [], storage: "indexeddb" });
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const undoRef = useRef<UndoEntry[]>([]);

  // Refs are the source of truth inside async work; state mirrors them for render.
  const baseRef = useRef(initial);
  const rowsRef = useRef<OutboxRow[]>([]);
  const flushing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoff = useRef(0);
  const lastActivity = useRef(0);
  const flushRef = useRef<() => Promise<void>>(async () => {});

  const state = useMemo(() => replay(base, rows.map((r) => r.op)), [base, rows]);

  const setRowsBoth = (next: OutboxRow[]) => {
    rowsRef.current = next;
    setRows(next);
    setSync((s) => ({ ...s, pending: next.length }));
  };
  const setBaseBoth = (next: Snapshot) => {
    baseRef.current = next;
    setBase(next);
  };

  const flush = useCallback(async (): Promise<void> => {
    if (flushing.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const batch = rowsRef.current.slice();
    if (!batch.length) return;
    flushing.current = true;
    setSync((s) => ({ ...s, syncing: true }));
    try {
      // Offline-captured photos upload first; the op then carries the path.
      for (const row of batch) {
        if (row.op.type !== "photo.add" || row.op.path) continue;
        const file = await idb.getFile(row.op.localKey);
        if (!file) continue;
        const path = await uploadFile(file.blob, { scope: "projects", parentId: projectId, kind: "image", fileName: row.op.photo.fileName });
        row.op = { ...row.op, path };
        await idb.addOps([row]);
      }
      const sendable = batch.filter((r) => r.op.type !== "photo.add" || r.op.path);
      const res = await syncWorkspace(projectId, compact(sendable.map((r) => r.op)));
      if (!res.ok) throw new Error(res.error);

      if (res.results.some((r) => r.status === "retry")) {
        // Nothing is dropped: every op is idempotent, so the whole batch is resent later.
        throw new Error(res.results.find((r) => r.status === "retry")?.message ?? "Temporary problem");
      }
      const sentIds = new Set(sendable.map((r) => r.opId));
      await idb.removeOps([...sentIds]);
      for (const r of sendable) if (r.op.type === "photo.add") await idb.deleteFile(r.op.localKey);
      const remaining = rowsRef.current.filter((r) => !sentIds.has(r.opId));
      setBaseBoth(res.snapshot);
      await idb.putSnapshot(projectId, res.snapshot);
      setRowsBoth(remaining);
      const issues = res.results.filter((r) => r.status !== "ok" && r.message).map((r) => r.message!);
      backoff.current = 0;
      setSync((s) => ({ ...s, online: true, lastSyncedAt: new Date().toISOString(), issues: [...s.issues, ...issues].slice(-5) }));
    } catch (e) {
      const offline = isNetworkError(e) || (typeof navigator !== "undefined" && !navigator.onLine);
      backoff.current = Math.min(backoff.current ? backoff.current * 2 : 5000, 60_000);
      setSync((s) => ({ ...s, online: !offline && s.online }));
      timer.current = setTimeout(() => void flushRef.current(), backoff.current);
    } finally {
      flushing.current = false;
      setSync((s) => ({ ...s, syncing: false }));
      // Changes made while this sync was in flight go next.
      if (rowsRef.current.some((r) => !batch.includes(r)) && !timer.current) timer.current = setTimeout(() => void flushRef.current(), 300);
    }
  }, [projectId]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  // Debounced, with a ceiling: a steady stream of changes can't postpone sync forever.
  const firstScheduled = useRef<number | null>(null);
  const schedule = useCallback(
    (delay = 700) => {
      const now = Date.now();
      if (timer.current && firstScheduled.current && now - firstScheduled.current > 4000) return;
      if (timer.current) clearTimeout(timer.current);
      firstScheduled.current ??= now;
      timer.current = setTimeout(() => {
        firstScheduled.current = null;
        void flush();
      }, delay);
    },
    [flush],
  );

  const touch = useCallback(() => {
    const now = Date.now();
    if (now - lastActivity.current < 10_000) return;
    lastActivity.current = now;
    void idb.putMeta(`activity:${projectId}`, new Date(now).toISOString());
  }, [projectId]);

  const dispatch = useCallback(
    (input: OpInput) => {
      const op = { ...input, opId: crypto.randomUUID(), at: new Date().toISOString() } as Op;
      const row: OutboxRow = { opId: op.opId, projectId, seq: nextSeq(), op };
      setRowsBoth([...rowsRef.current, row]);
      void idb.addOps([row]);
      touch();
      schedule(op.type === "reader.save" ? 2500 : 700);
      return op;
    },
    [projectId, schedule, touch],
  );

  /* ---- counters with undo ---- */
  const current = () => replay(baseRef.current, rowsRef.current.map((r) => r.op));

  const changeCounter = useCallback(
    (counterId: string, kind: "add" | "set", amount: number, sessionId: string | null, label: string) => {
      const before = current().counters;
      const { counters: after, rolls } = applyCounterChange(before, counterId, kind, amount);
      const changed = before.filter((c) => after.find((a) => a.id === c.id)?.value !== c.value);
      if (!changed.length) return { rolls: 0, counter: before.find((c) => c.id === counterId) as Counter | undefined };
      dispatch({ type: "counter.event", counterId, kind, amount, sessionId });
      undoRef.current = [...undoRef.current.slice(-29), { label, restore: changed.map((c) => ({ counterId: c.id, value: c.value })) }];
      setUndoStack(undoRef.current);
      return { rolls, counter: after.find((c) => c.id === counterId) };
    },
     
    [dispatch],
  );

  const undo = useCallback(() => {
    const last = undoRef.current.at(-1);
    if (!last) return null;
    for (const r of last.restore) dispatch({ type: "counter.event", counterId: r.counterId, kind: "set", amount: r.value, sessionId: null });
    undoRef.current = undoRef.current.slice(0, -1);
    setUndoStack(undoRef.current);
    return last.label;
  }, [dispatch]);

  /** Pulls the latest server state (e.g. after edits on another device). */
  const refresh = useCallback(async () => {
    if (rowsRef.current.length || flushing.current) return;
    try {
      const res = await refreshWorkspace(projectId);
      if (res.ok && !rowsRef.current.length) {
        setBaseBoth(res.snapshot);
        await idb.putSnapshot(projectId, res.snapshot);
        setSync((s) => ({ ...s, online: true, lastSyncedAt: new Date().toISOString() }));
      }
    } catch (e) {
      if (isNetworkError(e)) setSync((s) => ({ ...s, online: false }));
    }
  }, [projectId]);

  /* ---- lifecycle ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const available = await idb.available();
      const [stored, outbox] = await Promise.all([idb.getSnapshot(projectId), idb.outbox(projectId)]);
      if (cancelled) return;
      // Newest base wins: a cached offline page may carry an older snapshot.
      const chosen = stored && stored.loadedAt > initial.loadedAt ? stored : initial;
      setBaseBoth(chosen);
      if (chosen === initial) void idb.putSnapshot(projectId, initial);
      setRowsBoth(outbox);
      setSync((s) => ({ ...s, storage: available ? "indexeddb" : "memory", online: navigator.onLine }));
      setLoaded(true);
      if (outbox.length) void flush();
    })();
    return () => {
      cancelled = true;
    };
    // initial is the server render; later snapshots arrive through sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    const online = () => {
      setSync((s) => ({ ...s, online: true }));
      backoff.current = 0;
      void flush();
    };
    const offline = () => setSync((s) => ({ ...s, online: false }));
    const visible = () => {
      if (document.visibilityState !== "visible") return;
      if (rowsRef.current.length) void flush();
      else if (navigator.onLine) void refresh();
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [flush, refresh]);

  const dismissIssues = useCallback(() => setSync((s) => ({ ...s, issues: [] })), []);

  return { state, loaded, sync, dispatch, changeCounter, undo, undoStack, flush, refresh, dismissIssues };
}
export type Workspace = ReturnType<typeof useWorkspace>;
