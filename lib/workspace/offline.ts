"use client";

import { refreshWorkspace } from "./actions";
import { idb, type OfflineRecord } from "./idb";
import type { Snapshot, Source } from "./model";

/**
 * "Make available offline" — deliberate, per project.
 *
 * Downloads the pattern's private files into IndexedDB (signed URLs expire;
 * blobs don't), saves the project snapshot, and asks the service worker to
 * keep this project's Work Mode page plus the app code it needs. Nothing is
 * considered offline-ready just because it was opened once.
 */

export const fileKey = (s: Pick<Source, "id" | "storage_path" | "sha256">) => `src:${s.id}:${s.sha256 ?? s.storage_path ?? ""}`;
export const fileSources = (snap: Snapshot) => snap.sources.filter((s) => (s.kind === "pdf" || s.kind === "image") && s.storage_path);

export async function registerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

async function swMessage(message: { type: string; urls?: string[] }, timeoutMs = 60_000): Promise<{ ok: boolean; error?: string }> {
  const reg = await registerServiceWorker();
  const worker = reg?.active ?? (await navigator.serviceWorker?.ready)?.active;
  if (!worker) return { ok: false, error: "Offline support isn't available in this browser." };
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const t = setTimeout(() => resolve({ ok: false, error: "The offline save timed out." }), timeoutMs);
    channel.port1.onmessage = (e) => {
      clearTimeout(t);
      resolve(e.data);
    };
    worker.postMessage(message, [channel.port2]);
  });
}

/** Build assets this page has loaded (scripts, styles, fonts, PDF worker). */
function loadedAssets(extra: string[] = []) {
  const urls = new Set<string>(extra);
  for (const e of performance.getEntriesByType("resource")) {
    try {
      const u = new URL(e.name);
      if (u.origin === location.origin && u.pathname.startsWith("/_next/static/")) urls.add(u.toString());
    } catch {}
  }
  document.querySelectorAll<HTMLScriptElement>("script[src]").forEach((s) => s.src.includes("/_next/static/") && urls.add(s.src));
  document.querySelectorAll<HTMLLinkElement>("link[href]").forEach((l) => l.href.includes("/_next/static/") && urls.add(l.href));
  return [...urls];
}

export const workUrl = (projectId: string) => `/projects/${projectId}/work`;

export type OfflineStatus =
  | { state: "none" }
  | { state: "downloading"; progress: number; label: string }
  | { state: "ready"; savedAt: string; bytes: number; stale: boolean }
  | { state: "failed"; error: string };

export async function offlineStatus(snap: Snapshot): Promise<OfflineStatus> {
  const rec = await idb.getOffline(snap.project.id);
  if (!rec) return { state: "none" };
  if (rec.status === "failed") return { state: "failed", error: rec.error ?? "The download didn't finish." };
  if (rec.status === "downloading") return { state: "failed", error: "The last download was interrupted." };
  const stale = fileSources(snap).some((s) => rec.files[s.id] !== fileKey(s));
  return { state: "ready", savedAt: rec.savedAt, bytes: rec.bytes, stale };
}

export async function makeAvailableOffline(
  projectId: string,
  onProgress: (fraction: number, label: string) => void,
  extraAssets: string[] = [],
): Promise<{ ok: true; bytes: number } | { ok: false; error: string }> {
  if (!(await idb.available())) return { ok: false, error: "This browser is blocking offline storage (private browsing?)." };

  // Fresh snapshot = fresh signed URLs, never an expired one.
  const fresh = await refreshWorkspace(projectId).catch(() => null);
  if (!fresh?.ok) return { ok: false, error: "Connect to the internet to make this project available offline." };
  const snap = fresh.snapshot;
  const files = fileSources(snap);
  const needed = files.reduce((n, f) => n + (f.size_bytes ?? 0), 0);

  try {
    await navigator.storage?.persist?.();
    const est = await navigator.storage?.estimate?.();
    if (est?.quota && est.usage !== undefined && est.quota - est.usage < needed * 1.2 + 5_000_000) {
      return { ok: false, error: `Not enough storage on this device (needs about ${Math.ceil(needed / 1_048_576)} MB).` };
    }
  } catch {}

  const record: OfflineRecord = {
    projectId,
    name: snap.project.name,
    patternTitle: snap.pattern?.title ?? null,
    status: "downloading",
    savedAt: new Date().toISOString(),
    bytes: 0,
    files: {},
  };
  await idb.putOffline(record);

  try {
    const existing = new Map((await idb.projectFiles(projectId)).map((f) => [f.key, f]));
    let done = 0;
    for (const s of files) {
      const key = fileKey(s);
      onProgress(needed ? done / needed : 0, `Downloading ${s.file_name ?? s.title ?? "file"}…`);
      if (!existing.has(key)) {
        if (!s.fileUrl) throw new Error(`Couldn't get a download link for ${s.file_name ?? "a file"}.`);
        const res = await fetch(s.fileUrl);
        if (!res.ok) throw new Error(`Couldn't download ${s.file_name ?? "a file"} (${res.status}).`);
        const blob = await res.blob();
        await idb.putFile({ key, projectId, blob, size: blob.size, savedAt: new Date().toISOString() });
        // Read back: a quota failure would otherwise pass silently.
        if (!(await idb.getFile(key))) throw new Error("This device ran out of offline storage.");
      }
      record.files[s.id] = key;
      record.bytes += s.size_bytes ?? existing.get(key)?.size ?? 0;
      done += s.size_bytes ?? 0;
    }
    // Drop superseded versions of this project's files.
    const keep = new Set(Object.values(record.files));
    for (const key of existing.keys()) if (key.startsWith("src:") && !keep.has(key)) await idb.deleteFile(key);

    await idb.putSnapshot(projectId, snap);
    onProgress(0.95, "Saving Work Mode for offline use…");
    const pages = await swMessage({ type: "cache-pages", urls: [new URL(workUrl(projectId), location.origin).toString(), new URL("/offline", location.origin).toString()] });
    if (!pages.ok) throw new Error(pages.error ?? "Couldn't save the page for offline use.");
    const assets = await swMessage({ type: "cache-static", urls: loadedAssets(extraAssets) });
    if (!assets.ok) throw new Error(assets.error ?? "Couldn't save the app for offline use.");

    record.status = "ready";
    record.savedAt = new Date().toISOString();
    await idb.putOffline(record);
    onProgress(1, "Ready offline");
    return { ok: true, bytes: record.bytes };
  } catch (e) {
    record.status = "failed";
    record.error = e instanceof Error ? e.message : "The download failed.";
    await idb.putOffline(record);
    return { ok: false, error: record.error };
  }
}

export async function removeOffline(projectId: string) {
  for (const f of await idb.projectFiles(projectId)) if (f.key.startsWith("src:")) await idb.deleteFile(f.key);
  await idb.deleteOffline(projectId);
  await swMessage({ type: "uncache-pages", urls: [new URL(workUrl(projectId), location.origin).toString()] }, 10_000);
}

/** Local blob URL for a source when downloaded; otherwise null. */
export async function localFileUrl(s: Source): Promise<string | null> {
  const row = await idb.getFile(fileKey(s));
  return row ? URL.createObjectURL(row.blob) : null;
}

/** Sign-out: remove every private offline copy from this device. */
export async function clearOfflineData() {
  await idb.clearAll();
  try {
    if ("serviceWorker" in navigator) await swMessage({ type: "clear" }, 5000);
    else for (const key of await caches.keys()) await caches.delete(key);
  } catch {}
}
