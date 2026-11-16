/**
 * Minimal IndexedDB access for Work Mode (browser only).
 *
 *   snapshots  projectId -> last server snapshot
 *   outbox     opId      -> { projectId, seq, op }   unsynced changes, in order
 *   files      key       -> { key, projectId, blob, size, savedAt }
 *   offline    projectId -> OfflineRecord           explicit "available offline"
 *   meta       key       -> any                     small per-device state
 *
 * Every call fails soft to `null`/no-op when IndexedDB is unavailable
 * (private mode, storage blocked); the workspace then runs from memory.
 */
import type { Op, Snapshot } from "./model";

const DB_NAME = "makerie-offline";
const VERSION = 1;

export type OutboxRow = { opId: string; projectId: string; seq: number; op: Op };
export type FileRow = { key: string; projectId: string; blob: Blob; size: number; savedAt: string };
export type OfflineRecord = {
  projectId: string;
  name: string;
  patternTitle: string | null;
  status: "ready" | "downloading" | "failed";
  savedAt: string;
  bytes: number;
  /** source id -> file key, so changed sources show as needing an update. */
  files: Record<string, string>;
  error?: string;
};

let dbPromise: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  dbPromise ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore("snapshots");
        const outbox = db.createObjectStore("outbox", { keyPath: "opId" });
        outbox.createIndex("project", "projectId");
        const files = db.createObjectStore("files", { keyPath: "key" });
        files.createIndex("project", "projectId");
        db.createObjectStore("offline", { keyPath: "projectId" });
        db.createObjectStore("meta");
      };
      req.onsuccess = () => {
        req.result.onversionchange = () => req.result.close();
        resolve(req.result);
      };
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | null> {
  return open().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null);
        try {
          const tx = db.transaction(store, mode);
          const req = fn(tx.objectStore(store));
          tx.oncomplete = () => resolve(req ? (req.result ?? null) : null);
          tx.onerror = () => resolve(null);
          tx.onabort = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}

export const idb = {
  available: async () => Boolean(await open()),

  getSnapshot: (projectId: string) => run<Snapshot>("snapshots", "readonly", (s) => s.get(projectId)),
  putSnapshot: (projectId: string, snap: Snapshot) => run("snapshots", "readwrite", (s) => s.put(snap, projectId)),

  outbox: async (projectId: string) => {
    const rows = (await run<OutboxRow[]>("outbox", "readonly", (s) => s.index("project").getAll(projectId))) ?? [];
    return rows.sort((a, b) => a.seq - b.seq);
  },
  allOutbox: async () => (await run<OutboxRow[]>("outbox", "readonly", (s) => s.getAll())) ?? [],
  addOps: (rows: OutboxRow[]) =>
    run("outbox", "readwrite", (s) => {
      for (const r of rows) s.put(r);
    }),
  removeOps: (opIds: string[]) =>
    run("outbox", "readwrite", (s) => {
      for (const id of opIds) s.delete(id);
    }),

  getFile: (key: string) => run<FileRow>("files", "readonly", (s) => s.get(key)),
  putFile: (row: FileRow) => run("files", "readwrite", (s) => s.put(row)),
  deleteFile: (key: string) => run("files", "readwrite", (s) => s.delete(key)),
  projectFiles: async (projectId: string) => (await run<FileRow[]>("files", "readonly", (s) => s.index("project").getAll(projectId))) ?? [],

  getOffline: (projectId: string) => run<OfflineRecord>("offline", "readonly", (s) => s.get(projectId)),
  putOffline: (rec: OfflineRecord) => run("offline", "readwrite", (s) => s.put(rec)),
  deleteOffline: (projectId: string) => run("offline", "readwrite", (s) => s.delete(projectId)),
  allOffline: async () => (await run<OfflineRecord[]>("offline", "readonly", (s) => s.getAll())) ?? [],

  getMeta: <T>(key: string) => run<T>("meta", "readonly", (s) => s.get(key)),
  putMeta: (key: string, value: unknown) => run("meta", "readwrite", (s) => s.put(value, key)),

  /** Sign-out: remove every private copy from this device. */
  clearAll: async () => {
    const db = await open();
    db?.close();
    dbPromise = null;
    await new Promise<void>((resolve) => {
      try {
        const req = indexedDB.deleteDatabase(DB_NAME);
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
      } catch {
        resolve();
      }
    });
  },
};
