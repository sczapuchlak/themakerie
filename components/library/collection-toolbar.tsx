"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Sheet } from "@/components/ui/sheet";
import { DIFFICULTY } from "@/lib/library/constants";
import { ACTIVITY, activeFilterCount, SORTS, toSearchParams, type LibraryQuery } from "@/lib/library/query";

export const VIEW_COOKIE = "makerie-library-view";

export function CollectionToolbar({
  query,
  total,
  shown,
  crafts,
  tags,
}: {
  query: LibraryQuery;
  total: number;
  shown: number;
  crafts: { slug: string; name: string }[];
  tags: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(query.q);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const typing = useRef<ReturnType<typeof setTimeout> | null>(null);

  const go = (patch: Partial<LibraryQuery>) =>
    start(() => router.replace(`${pathname}${toSearchParams({ ...query, page: 1, ...patch })}`, { scroll: false }));

  // Debounced search-as-you-type.
  useEffect(() => {
    if (q === query.q) return;
    if (typing.current) clearTimeout(typing.current);
    typing.current = setTimeout(() => go({ q }), 300);
    return () => {
      if (typing.current) clearTimeout(typing.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const setView = (view: "gallery" | "list") => {
    rememberView(view);
    go({ view });
  };

  const filters = activeFilterCount(query);
  const anything = filters > 0 || query.q !== "";

  return (
    <div className="mt-5 space-y-3" aria-busy={pending}>
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="collection-search">
          Search this collection
        </label>
        <input
          id="collection-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search titles, designers, tags, notes…"
          className="field min-w-0 flex-1 basis-56"
          enterKeyHint="search"
        />
        <button type="button" className="chip" data-active={filters > 0} onClick={() => setFiltersOpen(true)}>
          Filters{filters > 0 ? ` · ${filters}` : ""}
        </button>
        <label className="sr-only" htmlFor="collection-sort">
          Sort
        </label>
        <select
          id="collection-sort"
          className="field !w-auto"
          value={query.sort}
          onChange={(e) => go({ sort: e.target.value as LibraryQuery["sort"] })}
        >
          {Object.entries(SORTS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <div role="group" aria-label="View" className="flex rounded-full border border-line-strong bg-white p-1">
          {(["gallery", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={query.view === v}
              onClick={() => setView(v)}
              className="min-h-9 rounded-full px-3 text-sm font-semibold text-body aria-pressed:bg-midnight aria-pressed:text-white"
            >
              {v === "gallery" ? "Gallery" : "List"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted" aria-live="polite">
        <span>
          {shown < total ? `Showing ${shown} of ${total}` : `${total} pattern${total === 1 ? "" : "s"}`}
          {pending ? " · updating…" : ""}
        </span>
        {anything && (
          <button
            type="button"
            className="min-h-9 font-semibold text-accent underline underline-offset-4"
            onClick={() => {
              setQ("");
              go({ q: "", craft: null, difficulty: null, tag: null, favorites: false, activity: null, archived: false });
            }}
          >
            Reset filters
          </button>
        )}
      </div>

      <Sheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filters"
        footer={
          <button type="button" className="btn btn-ink w-full" onClick={() => setFiltersOpen(false)}>
            Show {total} pattern{total === 1 ? "" : "s"}
          </button>
        }
      >
        <div className="space-y-6">
          <ChipGroup
            label="Craft"
            options={crafts.map((c) => ({ value: c.slug, label: c.name }))}
            value={query.craft}
            onChange={(craft) => go({ craft })}
          />
          <ChipGroup
            label="Difficulty"
            options={DIFFICULTY.map((d, i) => ({ value: String(i + 1), label: d }))}
            value={query.difficulty ? String(query.difficulty) : null}
            onChange={(d) => go({ difficulty: d ? Number(d) : null })}
          />
          <ChipGroup
            label="Projects"
            options={Object.entries(ACTIVITY).map(([value, label]) => ({ value, label }))}
            value={query.activity}
            onChange={(activity) => go({ activity: activity as LibraryQuery["activity"] })}
          />
          {tags.length > 0 && (
            <ChipGroup label="Tag" options={tags.map((t) => ({ value: t, label: `#${t}` }))} value={query.tag} onChange={(tag) => go({ tag })} />
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="chip" aria-pressed={query.favorites} onClick={() => go({ favorites: !query.favorites })}>
              ★ Favorites only
            </button>
            <button type="button" className="chip" aria-pressed={query.archived} onClick={() => go({ archived: !query.archived })}>
              Archived
            </button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

function ChipGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <fieldset>
      <legend className="eyebrow">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className="chip"
            aria-pressed={value === o.value}
            onClick={() => onChange(value === o.value ? null : o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function rememberView(view: "gallery" | "list") {
  document.cookie = `${VIEW_COOKIE}=${view}; path=/; max-age=31536000; samesite=lax`;
}
