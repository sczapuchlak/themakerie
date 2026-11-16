/**
 * Library browsing state <-> URL search params. Pure module.
 */

export const SORTS = {
  added: "Recently added",
  updated: "Recently updated",
  title: "Title",
  designer: "Designer",
} as const;
export type SortKey = keyof typeof SORTS;

export const ACTIVITY = {
  active: "In progress",
  finished: "Made before",
  none: "Not made yet",
} as const;
export type Activity = keyof typeof ACTIVITY;

export type LibraryQuery = {
  q: string;
  craft: string | null;
  difficulty: number | null;
  tag: string | null;
  favorites: boolean;
  activity: Activity | null;
  archived: boolean;
  sort: SortKey;
  view: "gallery" | "list";
  page: number;
};

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export function parseLibraryQuery(params: Params, savedView?: string | null): LibraryQuery {
  const sort = one(params.sort);
  const activity = one(params.activity);
  const difficulty = Number(one(params.difficulty));
  const view = one(params.view) ?? savedView;
  const page = Number(one(params.page));
  return {
    q: (one(params.q) ?? "").trim().slice(0, 100),
    craft: one(params.craft)?.match(/^[a-z][a-z0-9-]{1,30}$/)?.[0] ?? null,
    difficulty: Number.isInteger(difficulty) && difficulty >= 1 && difficulty <= 5 ? difficulty : null,
    tag: one(params.tag)?.trim().toLowerCase().slice(0, 60) || null,
    favorites: one(params.favorites) === "1",
    activity: activity && activity in ACTIVITY ? (activity as Activity) : null,
    archived: one(params.archived) === "1",
    sort: sort && sort in SORTS ? (sort as SortKey) : "added",
    view: view === "list" ? "list" : "gallery",
    page: Number.isInteger(page) && page > 1 ? Math.min(page, 1000) : 1,
  };
}

/** Number of active filters (not counting search, sort or view). */
export function activeFilterCount(q: LibraryQuery): number {
  return [q.craft, q.difficulty, q.tag, q.favorites || null, q.activity, q.archived || null].filter(Boolean)
    .length;
}

/** Serializes back to a query string, omitting defaults. */
export function toSearchParams(q: Partial<LibraryQuery>): string {
  const p = new URLSearchParams();
  if (q.q) p.set("q", q.q);
  if (q.craft) p.set("craft", q.craft);
  if (q.difficulty) p.set("difficulty", String(q.difficulty));
  if (q.tag) p.set("tag", q.tag);
  if (q.favorites) p.set("favorites", "1");
  if (q.activity) p.set("activity", q.activity);
  if (q.archived) p.set("archived", "1");
  if (q.sort && q.sort !== "added") p.set("sort", q.sort);
  if (q.view === "list") p.set("view", "list");
  if (q.page && q.page > 1) p.set("page", String(q.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Escapes LIKE wildcards in user search text. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export const PAGE_SIZE = 48;
