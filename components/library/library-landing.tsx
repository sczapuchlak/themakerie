import Link from "next/link";
import { SectionLabel } from "@/components/editorial/section-label";
import { FOLDER_COLOR_HEX, type FolderColor } from "@/lib/library/constants";
import type { ActiveProject, FolderOverview } from "@/lib/library/data";
import { CoverArt } from "./cover-art";
import { FolderButton } from "./folder-dialog";
import { LibrarySearch } from "./library-search";

/* ------------------------------------------------------------ masthead */

export function LibraryMasthead({ total, covers = [] }: { total: number; covers?: RecentPattern[] }) {
  const fan = covers.filter((c) => c.coverUrl).slice(0, 3);
  return (
    <header className="tone-midnight surface-midnight relative isolate mt-4 overflow-hidden rounded-panel p-6 sm:p-8 md:mt-8">
      <div className="tech-grid pointer-events-none absolute inset-0 text-white/[0.05]" />
      <div aria-hidden="true" className="pointer-events-none absolute -top-24 right-10 -z-10 size-80 rounded-full bg-pink/35 blur-[90px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 right-1/3 -z-10 size-72 rounded-full bg-laser/25 blur-[90px]" />
      {fan.length > 0 && (
        <div aria-hidden="true" className="pointer-events-none absolute top-1/2 right-8 hidden h-[15rem] w-[17rem] -translate-y-1/2 lg:block xl:right-14">
          {fan.map((c, i) => (
            <div
              key={c.id}
              className="absolute top-0 aspect-[3/4] h-full overflow-hidden rounded-card shadow-2xl ring-1 ring-white/25"
              style={{ right: i * 46, transform: `rotate(${[6, -4, -12][i]}deg) translateY(${i * 6}px)`, zIndex: 3 - i }}
            >
              <CoverArt url={c.coverUrl} title={c.title} craft={c.craft} />
            </div>
          ))}
        </div>
      )}
      <div className="relative flex flex-wrap items-end justify-between gap-5">
        <div>
          <SectionLabel>Your collection</SectionLabel>
          <h1 className="mt-3 font-display-tight text-[clamp(2.4rem,6vw,3.75rem)]">
            Pattern <span className="font-serif font-normal tracking-normal text-vivid italic">Library</span>
          </h1>
          <p className="mt-2 max-w-md text-body">
            Everything you could make — and everything you&rsquo;ve made from it.{" "}
            <span className="text-muted">
              {total} pattern{total === 1 ? "" : "s"}
            </span>
          </p>
        </div>
        <Link href="/patterns/new" className={`btn btn-primary ${fan.length ? "lg:hidden" : ""}`}>
          <span aria-hidden="true">＋</span> Add pattern
        </Link>
      </div>
      <div className="relative mt-6 flex max-w-2xl flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 basis-72">
          <LibrarySearch action="/patterns/all" />
        </div>
        {fan.length > 0 && (
          <Link href="/patterns/new" className="btn btn-primary hidden lg:inline-flex">
            <span aria-hidden="true">＋</span> Add pattern
          </Link>
        )}
      </div>
    </header>
  );
}

/* --------------------------------------------------------- in progress */

export function InProgress({ projects }: { projects: ActiveProject[] }) {
  return (
    <section aria-labelledby="in-progress" className="mt-10">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="in-progress" className="font-display-tight text-[1.65rem]">
          In progress
        </h2>
        {projects.length > 0 && <span className="eyebrow">{projects.length} active</span>}
      </div>
      {projects.length === 0 ? (
        <div className="relative mt-3 overflow-hidden rounded-card bg-gradient-to-r from-[#fde7f6] via-[#ece9ff] to-[#dff8ff] px-5 py-5 ring-1 ring-white/70">
          <div aria-hidden="true" className="absolute -top-10 -right-6 size-40 rounded-full bg-pink/30 blur-2xl" />
          <p className="relative text-body">
            <span className="font-display-tight text-xl text-strong">Nothing on the needles.</span>{" "}
            Pick a pattern below and choose <strong className="text-strong">Start a project</strong> — it&rsquo;ll wait for you here.
          </p>
        </div>
      ) : (
        <ul className="no-scrollbar -mx-[var(--gutter)] mt-3 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-[var(--gutter)] px-[var(--gutter)] pb-2 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0">
          {projects.map((p) => (
            <li key={p.id} className="w-[78%] max-w-[20rem] shrink-0 snap-start lg:w-auto lg:max-w-none">
              <article className="surface-panel flex h-full gap-4 overflow-hidden rounded-card p-3">
                <div className="aspect-[4/5] w-24 shrink-0 overflow-hidden rounded-tile">
                  <CoverArt url={p.coverUrl} title={p.pattern?.title ?? p.name} craft={p.pattern?.craft} />
                </div>
                <div className="flex min-w-0 flex-1 flex-col py-1">
                  <h3 className="truncate font-semibold text-strong">{p.name}</h3>
                  {p.pattern && <p className="truncate text-xs text-muted">{p.pattern.title}</p>}
                  <Progress value={p.progress} className="mt-3" />
                  <Link
                    href={`/projects/${p.id}/work`}
                    className="btn btn-ink mt-auto self-start !min-h-10 !px-4"
                    aria-label={`Continue ${p.name}`}
                  >
                    Continue
                  </Link>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Progress({ value, className = "" }: { value: number | null; className?: string }) {
  if (value === null || value === undefined) return <p className={`text-xs text-muted ${className}`}>No progress yet</p>;
  return (
    <div className={className}>
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progress"
        className="h-2 overflow-hidden rounded-full bg-midnight/10"
      >
        <div className="h-full rounded-full bg-midnight" style={{ width: `${value}%` }} />
      </div>
      <p className="mt-1 font-mono text-[0.7rem] text-muted">{value}%</p>
    </div>
  );
}

/* ------------------------------------------------------------- folders */

export function FolderTiles({
  folders,
  allCount,
  unsortedCount,
}: {
  folders: FolderOverview[];
  allCount: number;
  unsortedCount: number;
}) {
  const top = folders.filter((f) => !f.parent_id);
  return (
    <section aria-labelledby="folders" className="mt-10">
      <div className="flex items-center justify-between gap-4">
        <h2 id="folders" className="font-display-tight text-[1.65rem]">
          Folders
        </h2>
        <FolderButton folders={folders} label={<>＋ New folder</>} className="btn btn-secondary !min-h-10" />
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <SmartTile href="/patterns/all" title="All Patterns" count={allCount} hint="Everything" />
        <SmartTile href="/patterns/unsorted" title="Unsorted" count={unsortedCount} hint="Not in a folder" />
        {top.map((f) => (
          <li key={f.id}>
            <Link
              href={`/patterns/folders/${f.id}`}
              className="surface-panel group flex h-full min-h-24 flex-col justify-between rounded-card p-4 transition-transform duration-200 ease-soft hover:-translate-y-0.5 active:translate-y-0"
            >
              <FolderGlyph color={f.color} />
              <span>
                <span className="block truncate font-semibold text-strong">{f.name}</span>
                <span className="text-xs text-muted">
                  {f.pattern_count ?? 0} pattern{f.pattern_count === 1 ? "" : "s"}
                  {f.child_count ? ` · ${f.child_count} folder${f.child_count === 1 ? "" : "s"}` : ""}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {top.length === 0 && (
        <p className="mt-3 text-sm text-muted">
          Make folders however you like — by craft, by season, by who it&rsquo;s for. Nothing is pre-sorted for you.
        </p>
      )}
    </section>
  );
}

function SmartTile({ href, title, count, hint }: { href: string; title: string; count: number; hint: string }) {
  return (
    <li>
      <Link
        href={href}
        className="tone-midnight surface-midnight flex h-full min-h-24 flex-col justify-between rounded-card p-4 transition-transform duration-200 ease-soft hover:-translate-y-0.5"
      >
        <span className="eyebrow">{hint}</span>
        <span>
          <span className="block font-semibold text-strong">{title}</span>
          <span className="font-mono text-xs text-muted">{count}</span>
        </span>
      </Link>
    </li>
  );
}

export function FolderGlyph({ color }: { color?: string | null }) {
  const hex = color ? FOLDER_COLOR_HEX[color as FolderColor] : "#ae8aff";
  return (
    <svg viewBox="0 0 32 24" className="h-6 w-8" aria-hidden="true">
      <path d="M2 4a2 2 0 0 1 2-2h8l3 3h13a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2Z" fill={hex} />
      <path d="M2 9h28" stroke="#081638" strokeOpacity=".25" />
    </svg>
  );
}

/* ------------------------------------------------------- recently added */

export type RecentPattern = { id: string; title: string; craft: string; designer: string | null; coverUrl: string | null };

/** A shelf of covers: the collection should look like the patterns in it. */
export function RecentShelf({ patterns }: { patterns: RecentPattern[] }) {
  if (!patterns.length) return null;
  return (
    <section aria-labelledby="recent" className="mt-10">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="recent" className="font-display-tight text-[1.65rem]">
          Recently <span className="font-serif font-normal tracking-normal text-vivid italic">added</span>
        </h2>
        <Link href="/patterns/all" className="text-sm font-semibold text-accent hover:underline">
          See all →
        </Link>
      </div>
      <ul className="no-scrollbar -mx-[var(--gutter)] mt-4 flex snap-x gap-5 overflow-x-auto scroll-px-[var(--gutter)] px-[var(--gutter)] pt-2 pb-6">
        {patterns.map((p, i) => (
          <li key={p.id} className="w-[11.5rem] shrink-0 snap-start sm:w-[13rem]">
            <Link href={`/patterns/${p.id}`} className="group block">
              <div
                className={`relative aspect-[3/4] overflow-hidden rounded-card shadow-[0_18px_40px_-18px_rgb(8_22_56/0.55)] ring-1 ring-white/60 transition-transform duration-300 ease-soft group-hover:-translate-y-1.5 group-hover:rotate-0 ${
                  i % 2 ? "rotate-[1.5deg]" : "-rotate-[1.5deg]"
                }`}
              >
                <CoverArt url={p.coverUrl} title={p.title} craft={p.craft} />
              </div>
              <h3 className="mt-3 line-clamp-2 font-semibold leading-snug text-strong">{p.title}</h3>
              {p.designer && <p className="truncate text-sm text-muted">{p.designer}</p>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
