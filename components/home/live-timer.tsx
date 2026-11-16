"use client";

import { useNow } from "@/components/workspace/session";
import { activeSeconds, formatDuration } from "@/lib/workspace/model";

/** Session time on Home — computed from saved timestamps, ticking while running. */
export function LiveTimer({ session, trackedSeconds }: { session: { status: string; active_seconds: number; resumed_at: string | null } | null; trackedSeconds: number }) {
  const running = session?.status === "active";
  const now = useNow(running);
  if (!session) return <>{trackedSeconds > 0 ? formatDuration(trackedSeconds) : "--:--"}</>;
  const s = activeSeconds({ active_seconds: session.active_seconds, resumed_at: session.resumed_at, status: session.status as "active" | "paused" }, now);
  return (
    <span className={running ? "text-neon" : "text-peach"} suppressHydrationWarning>
      {formatDuration(s, true)}
      <span className="ml-1.5 text-xs font-sans font-semibold">{running ? "running" : "paused"}</span>
    </span>
  );
}
