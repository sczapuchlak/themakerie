"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Renders a date/time in the viewer's own time zone. The server (UTC on
 * Vercel) renders nothing; the browser fills it in after hydration, so a
 * session at 11pm never shows up as "tomorrow".
 */
export function LocalTime({ iso, format, className }: { iso: string; format: (d: Date) => string; className?: string }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  return (
    <time dateTime={iso} className={className}>
      {mounted ? format(new Date(iso)) : " "}
    </time>
  );
}
