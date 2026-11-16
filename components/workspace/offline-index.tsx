"use client";

import { useEffect, useState } from "react";
import { idb, type OfflineRecord } from "@/lib/workspace/idb";
import { formatBytes } from "@/lib/library/constants";

/** Lists projects saved for offline use on this device. */
export function OfflineIndex() {
  const [records, setRecords] = useState<OfflineRecord[] | null>(null);
  const [pending, setPending] = useState(0);
  useEffect(() => {
    void Promise.all([idb.allOffline(), idb.allOutbox()]).then(([r, o]) => {
      setRecords(r.filter((x) => x.status === "ready"));
      setPending(o.length);
    });
  }, []);
  return (
    <div className="tone-midnight min-h-dvh bg-midnight px-[var(--gutter)] pt-[max(2rem,env(safe-area-inset-top))] pb-10">
      <p className="eyebrow">The Makerie</p>
      <h1 className="mt-2 font-display-tight text-[2.4rem] text-white">Ready offline</h1>
      <p className="mt-2 max-w-prose text-body">These projects open without a connection. Changes you make are kept on this device and sync when you&rsquo;re back online.</p>
      {pending > 0 && <p className="mt-3 text-sm font-semibold text-peach">{pending} change{pending === 1 ? "" : "s"} waiting to sync.</p>}
      {records === null ? (
        <p className="mt-6 text-sm text-muted" role="status">Checking this device…</p>
      ) : records.length === 0 ? (
        <p className="mt-6 text-body">No projects are saved for offline use yet. In Work Mode, open Tools → Offline → Make available offline.</p>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {records.map((r) => (
            <li key={r.projectId}>
              {/* A full navigation: the service worker serves the saved page. */}
              <a href={`/projects/${r.projectId}/work`} className="block rounded-card border border-white/15 bg-white/5 p-4 hover:bg-white/10">
                <span className="block font-semibold text-white">{r.name}</span>
                <span className="text-sm text-muted">
                  {r.patternTitle ? `${r.patternTitle} · ` : ""}
                  {formatBytes(r.bytes) || "small"} · saved {new Date(r.savedAt).toLocaleDateString()}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
