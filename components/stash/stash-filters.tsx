"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { COLOR_FAMILIES, FAMILIES } from "@/lib/stash/catalog";

type Opt = { id: string; name: string; parent_id: string | null };

const label = (rows: Opt[], id: string) => {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const parts: string[] = [];
  let cur = byId.get(id);
  for (let i = 0; cur && i < 20; i++) {
    parts.unshift(cur.name);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return parts.join(" › ");
};

/** Filters live in the URL, so views are shareable and the back button works. */
export function StashFilters({ locations, collections, total }: { locations: Opt[]; collections: Opt[]; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
  const v = (k: string) => params.get(k) ?? "";
  const toggle = (k: string) => set(k, v(k) === "1" ? null : "1");

  return (
    <div className="space-y-3" data-testid="stash-filters">
      <div className="no-scrollbar -mx-[var(--gutter)] flex gap-1.5 overflow-x-auto px-[var(--gutter)]">
        <button type="button" className="chip shrink-0" aria-pressed={!v("family")} onClick={() => set("family", null)}>
          Everything
        </button>
        {FAMILIES.map((f) => (
          <button key={f.value} type="button" className="chip shrink-0" aria-pressed={v("family") === f.value} onClick={() => set("family", v("family") === f.value ? null : f.value)}>
            {f.label}
          </button>
        ))}
      </div>
      <div className="no-scrollbar -mx-[var(--gutter)] flex items-center gap-2 overflow-x-auto px-[var(--gutter)] pb-1" role="group" aria-label="Colour">
        {COLOR_FAMILIES.map((c) => (
          <button
            key={c.value}
            type="button"
            aria-label={c.label}
            title={c.label}
            aria-pressed={v("color") === c.value}
            onClick={() => set("color", v("color") === c.value ? null : c.value)}
            className="press size-9 shrink-0 rounded-full ring-2 ring-white aria-pressed:ring-[3px] aria-pressed:ring-midnight"
            style={{ background: c.hex === "conic" ? "conic-gradient(#d63a3a,#f5d33f,#4caf50,#3b6fe0,#8b55d6,#d63a3a)" : c.hex }}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select className="field !min-h-10 !w-auto !py-1.5 !text-sm" value={v("location")} onChange={(e) => set("location", e.target.value || null)} aria-label="Place">
          <option value="">Any place</option>
          <option value="none">Without a place</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {label(locations, l.id)}
            </option>
          ))}
        </select>
        {collections.length > 0 && (
          <select className="field !min-h-10 !w-auto !py-1.5 !text-sm" value={v("collection")} onChange={(e) => set("collection", e.target.value || null)} aria-label="Collection">
            <option value="">Any collection</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {label(collections, c.id)}
              </option>
            ))}
          </select>
        )}
        <button type="button" className="chip !min-h-10" aria-pressed={v("favorites") === "1"} onClick={() => toggle("favorites")}>
          ★ Favourites
        </button>
        <button type="button" className="chip !min-h-10" aria-pressed={v("reserved") === "1"} onClick={() => toggle("reserved")}>
          Reserved
        </button>
        <button type="button" className="chip !min-h-10" aria-pressed={v("low") === "1"} onClick={() => toggle("low")}>
          Low stock
        </button>
        <span className="ml-auto flex items-center gap-2">
          <select className="field !min-h-10 !w-auto !py-1.5 !text-sm" value={v("sort") || "recent"} onChange={(e) => set("sort", e.target.value === "recent" ? null : e.target.value)} aria-label="Sort">
            <option value="recent">Recently added</option>
            <option value="name">Name</option>
            <option value="brand">Brand</option>
            <option value="available">Most available</option>
          </select>
          <span className="flex rounded-full bg-white p-1 ring-1 ring-line">
            <button type="button" className="min-h-8 rounded-full px-3 text-sm font-semibold aria-pressed:bg-midnight aria-pressed:text-white" aria-pressed={v("layout") !== "list"} onClick={() => set("layout", null)}>
              Gallery
            </button>
            <button type="button" className="min-h-8 rounded-full px-3 text-sm font-semibold aria-pressed:bg-midnight aria-pressed:text-white" aria-pressed={v("layout") === "list"} onClick={() => set("layout", "list")}>
              List
            </button>
          </span>
        </span>
      </div>
      <p className="text-sm text-muted" role="status">
        {total} {total === 1 ? "supply" : "supplies"}
      </p>
    </div>
  );
}
