"use client";

import { useSyncExternalStore } from "react";
import { sinceLabel } from "@/lib/library/format";

const subscribe = () => () => {};

const PRESETS = {
  month: (d: Date) => d.toLocaleDateString(undefined, { month: "short" }),
  day: (d: Date) => String(d.getDate()),
  weekday: (d: Date) => d.toLocaleDateString(undefined, { weekday: "long" }),
  shortDate: (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  since: (d: Date) => sinceLabel(d.toISOString()) ?? "",
} as const;
export type TimePreset = keyof typeof PRESETS;

/**
 * Renders a date/time in the viewer's own time zone. The server (UTC on
 * Vercel) renders nothing and never reads the clock — so pages can still be
 * prerendered — and the browser fills it in after hydration. Usable from
 * server components (presets are plain strings).
 */
export function LocalTime({ iso, preset, prefix = "", className }: { iso: string; preset: TimePreset; prefix?: string; className?: string }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  return (
    <time dateTime={iso} className={className}>
      {mounted ? `${prefix}${PRESETS[preset](new Date(iso))}` : " "}
    </time>
  );
}
