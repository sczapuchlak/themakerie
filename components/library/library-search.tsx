"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Search box that opens the All Patterns collection with the query. */
export function LibrarySearch({ action, initial = "" }: { action: string; initial?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(q.trim() ? `${action}?q=${encodeURIComponent(q.trim())}` : action);
      }}
      className="flex gap-2"
    >
      <label className="sr-only" htmlFor="library-search">
        Search patterns
      </label>
      <input
        id="library-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search titles, designers, tags, notes…"
        className="field !border-white/20 !bg-white/95"
        enterKeyHint="search"
      />
      <button type="submit" className="btn btn-secondary shrink-0">
        Search
      </button>
    </form>
  );
}
