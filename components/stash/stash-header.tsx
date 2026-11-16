import Link from "next/link";
import { FoilStrip } from "@/components/editorial/foil";

export type StashCounts = { total: number; materials: number; tools: number; shopping: number; wishlist: number };

/** Supply Studio header: compact, so the stash itself starts above the fold. */
export function StashHeader({ counts, q = "", active = "all" }: { counts: StashCounts; q?: string; active?: "all" | "materials" | "tools" | "shopping" | "wishlist" }) {
  const views = [
    { id: "all", label: "All supplies", n: counts.total, href: "/stash/browse" },
    { id: "materials", label: "Materials", n: counts.materials, href: "/stash/browse?view=materials" },
    { id: "tools", label: "Tools", n: counts.tools, href: "/stash/browse?view=tools" },
    { id: "shopping", label: "Shopping list", n: counts.shopping, href: "/stash/shopping" },
    { id: "wishlist", label: "Wishlist", n: counts.wishlist, href: "/stash/shopping?list=wishlist" },
  ] as const;
  return (
    <header className="tone-midnight surface-midnight relative isolate mt-4 overflow-hidden rounded-panel md:mt-8" data-testid="stash-header">
      <FoilStrip left="The Makerie — Supply Studio" right={`${counts.materials} materials · ${counts.tools} tools`} />
      <div aria-hidden="true" className="pointer-events-none absolute -top-10 right-10 -z-10 size-72 rounded-full bg-aqua/30 blur-[90px]" />
      <div aria-hidden="true" className="pointer-events-none absolute right-1/3 -bottom-24 -z-10 size-64 rounded-full bg-pink/30 blur-[90px]" />
      <div className="p-5 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display-tight text-[clamp(2.2rem,5.4vw,3.4rem)] leading-none">
              Stash <span className="font-serif font-normal tracking-normal text-vivid italic">studio</span>
            </h1>
            <p className="mt-2 max-w-md text-body">Everything you make with, everything set aside for a make, and everything you&rsquo;re dreaming of.</p>
          </div>
          <Link href="/stash/new" className="btn btn-primary press" data-testid="add-supply">
            <span aria-hidden="true">＋</span> Add supply
          </Link>
        </div>
        <form action="/stash/browse" className="mt-5 flex max-w-2xl gap-2" role="search">
          <label className="sr-only" htmlFor="stash-search">
            Search your stash
          </label>
          <input
            id="stash-search"
            name="q"
            defaultValue={q}
            placeholder="Search colour, code, brand, size…"
            className="field min-w-0 flex-1 !bg-white/95 !text-midnight"
            enterKeyHint="search"
          />
          <button type="submit" className="btn btn-secondary press">
            Search
          </button>
        </form>
        <nav aria-label="Stash views" className="no-scrollbar -mx-5 mt-5 flex gap-2 overflow-x-auto px-5 sm:-mx-7 sm:px-7">
          {views.map((v) => (
            <Link
              key={v.id}
              href={v.href}
              aria-current={active === v.id ? "page" : undefined}
              className="press flex min-h-10 shrink-0 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-white/15 aria-[current=page]:bg-white aria-[current=page]:text-midnight"
            >
              {v.label}
              <span className="font-mono text-xs opacity-70">{v.n}</span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
