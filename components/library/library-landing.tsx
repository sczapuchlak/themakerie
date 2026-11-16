import Link from "next/link";
import { ViewTransition } from "react";
import { FoilStrip, NumberedHeading } from "@/components/editorial/foil";
import { FOLDER_COLOR_HEX, type FolderColor } from "@/lib/library/constants";
import type { ActiveProject, CollectionPreviews, FolderOverview, RecentPattern } from "@/lib/library/data";
import { plural, sinceLabel } from "@/lib/library/format";
import { formatDuration } from "@/lib/workspace/model";
import { CoverArt } from "./cover-art";
import { FolderButton } from "./folder-dialog";
import { LibrarySearch } from "./library-search";
import { ProgressRing } from "./progress-ring";

export type { RecentPattern } from "@/lib/library/data";

/* ------------------------------------------------------------ masthead */

export function LibraryMasthead({ total, active = 0, covers = [] }: { total: number; active?: number; covers?: RecentPattern[] }) {
  const fan = covers.filter((c) => c.coverUrl).slice(0, 3);
  return (
    <header className="tone-midnight surface-midnight relative isolate mt-4 overflow-hidden rounded-panel p-6 pt-0 sm:p-8 sm:pt-0 md:mt-8">
      <FoilStrip
        className="-mx-6 mb-6 sm:-mx-8 sm:mb-8"
        left="The Makerie — Pattern Library"
        right={`${plural(total, "pattern")}${active ? ` · ${active} in progress` : ""}`}
      />
      <div className="tech-grid pointer-events-none absolute inset-0 text-white/[0.05]" />
      <div aria-hidden="true" className="pointer-events-none absolute -top-24 right-10 -z-10 size-80 rounded-full bg-pink/35 blur-[90px]" />
      <div aria-hidden="true" className="pointer-events-none absolute right-1/3 -bottom-32 -z-10 size-72 rounded-full bg-laser/25 blur-[90px]" />
      {fan.length > 0 && (
        <div aria-hidden="true" className="pointer-events-none absolute top-[calc(50%+1.4rem)] right-8 hidden h-[12.5rem] w-[15rem] -translate-y-1/2 lg:block xl:right-14">
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
      <div className="relative max-w-2xl">
        <h1 className="font-display-tight text-[clamp(2.4rem,6vw,3.75rem)]">
          Pattern <span className="font-serif font-normal tracking-normal text-vivid italic">Library</span>
        </h1>
        <p className="mt-2 max-w-md text-body">
          Everything you could make — and everything you&rsquo;ve made from it.{" "}
          <span className="text-muted">{plural(total, "pattern")}</span>
        </p>
      </div>
      <div className="relative mt-6 flex max-w-2xl flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 basis-72">
          <LibrarySearch action="/patterns/all" />
        </div>
        <Link href="/patterns/new" className="btn btn-primary press">
          <span aria-hidden="true">＋</span> Add pattern
        </Link>
      </div>
    </header>
  );
}

function SectionHead({ n, id, title, accent, aside }: { n: number; id: string; title: string; accent?: string; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <NumberedHeading n={n} id={id}>
        {title} {accent && <span className="font-serif font-normal tracking-normal text-vivid italic">{accent}</span>}
      </NumberedHeading>
      {aside}
    </div>
  );
}

/* ------------------------------------------------------------- folders */

/**
 * Folders as collectible objects: a layered folder with the covers inside
 * peeking out. Automatic collections are midnight with a holographic edge
 * and say so; your own folders take their chosen colour.
 */
export function FolderTiles({
  folders,
  allCount,
  unsortedCount,
  previews,
}: {
  folders: FolderOverview[];
  allCount: number;
  unsortedCount: number;
  previews: CollectionPreviews;
}) {
  const top = folders.filter((f) => !f.parent_id);
  return (
    <section aria-labelledby="folders" className="mt-10 md:mt-12">
      <SectionHead
        n={1}
        id="folders"
        title="Folders"
        aside={<FolderButton folders={folders} label={<>＋ New folder</>} className="btn btn-secondary press !min-h-10" />}
      />
      <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" data-testid="folder-grid">
        <FolderObject href="/patterns/all" name="All Patterns" count={allCount} covers={previews.all} auto />
        <FolderObject href="/patterns/unsorted" name="Unsorted" count={unsortedCount} covers={previews.unsorted} auto />
        {top.map((f) => (
          <FolderObject
            key={f.id}
            href={`/patterns/folders/${f.id}`}
            name={f.name}
            count={f.pattern_count ?? 0}
            subfolders={f.child_count ?? 0}
            color={f.color}
            covers={previews.folders[f.id] ?? []}
          />
        ))}
        {top.length === 0 && (
          <li>
            <FolderButton
              folders={folders}
              label={
                <span className="flex h-full flex-col items-center justify-center gap-2 text-center">
                  <span className="grid size-10 place-items-center rounded-full bg-selected text-xl text-strong">＋</span>
                  <span className="text-sm font-semibold text-strong">Make your first folder</span>
                  <span className="px-3 text-xs text-muted">By craft, season, or who it&rsquo;s for — it&rsquo;s up to you.</span>
                </span>
              }
              className="press flex aspect-[5/4] w-full rounded-[1.1rem] border-2 border-dashed border-line-strong bg-white/40 hover:bg-white/70"
            />
          </li>
        )}
      </ul>
    </section>
  );
}

const DARK_TEXT: FolderColor[] = ["lime", "pink", "laser", "ultraviolet", "aqua", "peach"];

function FolderObject({
  href,
  name,
  count,
  subfolders = 0,
  color,
  covers,
  auto = false,
}: {
  href: string;
  name: string;
  count: number;
  subfolders?: number;
  color?: string | null;
  covers: string[];
  auto?: boolean;
}) {
  const hex = auto ? "#142a6b" : (FOLDER_COLOR_HEX[(color ?? "ultraviolet") as FolderColor] ?? "#ae8aff");
  const darkText = !auto && DARK_TEXT.includes((color ?? "ultraviolet") as FolderColor);
  const back = auto ? "#0f1f55" : `color-mix(in srgb, ${hex} 62%, #081638)`;
  const front = auto
    ? "linear-gradient(165deg, #1a2d74 0%, #081638 85%)"
    : `linear-gradient(165deg, color-mix(in srgb, ${hex} 45%, white) 0%, ${hex} 70%)`;
  const sheets = covers.length ? covers : [null, null];
  return (
    <li>
      <Link
        href={href}
        className="group relative block aspect-[5/4] rounded-[1.1rem] focus-visible:outline-offset-4 [perspective:900px]"
        aria-label={`${name}: ${plural(count, "pattern")}${auto ? " (automatic collection)" : ""}${subfolders ? `, ${plural(subfolders, "folder")}` : ""}`}
        data-testid={auto ? "collection" : "folder"}
      >
        {/* back panel + tab */}
        <span aria-hidden="true" className="absolute top-0 left-0 h-[16%] w-[44%] rounded-t-[0.9rem]" style={{ background: back }} />
        <span aria-hidden="true" className="absolute inset-x-0 top-[9%] bottom-0 rounded-[1.1rem] rounded-tl-none" style={{ background: back }} />
        {/* what's inside, peeking out */}
        {sheets.slice(0, 3).map((url, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="absolute top-[15%] h-[58%] w-[36%] overflow-hidden rounded-md bg-white shadow-md ring-1 ring-black/5 [transform:rotate(var(--r))] motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-soft motion-safe:group-hover:[transform:translateY(-16%)_rotate(var(--r))]"
            style={{ left: `${12 + i * 22}%`, "--r": `${[-7, 2, 9][i]}deg` } as React.CSSProperties}
          >
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="" loading="lazy" className="size-full object-cover" />
            ) : (
              <span className="block size-full bg-[repeating-linear-gradient(180deg,#fff_0_9px,#e8eaf6_9px_10px)]" />
            )}
          </span>
        ))}
        {/* front flap — tips open on hover */}
        <span
          className={`absolute inset-x-0 bottom-0 flex h-[60%] origin-bottom flex-col justify-end rounded-[1.1rem] p-3.5 shadow-[0_-6px_18px_-10px_rgb(8_22_56/0.5)] motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-soft motion-safe:group-hover:[transform:rotateX(-16deg)] sm:p-4 ${
            auto ? "holo-border" : ""
          }`}
          style={{ background: front }}
        >
          {auto && (
            <span className="absolute top-3 right-3 rounded-full bg-white/10 px-2 py-0.5 text-[0.6rem] font-semibold tracking-[0.12em] text-white/80 uppercase ring-1 ring-white/15">
              ✦ Automatic
            </span>
          )}
          <span className={`block truncate text-[1.02rem] leading-tight font-semibold ${auto || !darkText ? "text-white" : "text-midnight"}`}>{name}</span>
          <span className={`mt-0.5 block text-xs ${auto || !darkText ? "text-white/70" : "text-midnight/70"}`}>
            {plural(count, "pattern")}
            {subfolders ? ` · ${plural(subfolders, "folder")}` : ""}
          </span>
        </span>
      </Link>
    </li>
  );
}

/** Small glyph used in folder chips and lists. */
export function FolderGlyph({ color }: { color?: string | null }) {
  const hex = color ? FOLDER_COLOR_HEX[color as FolderColor] : "#ae8aff";
  return (
    <svg viewBox="0 0 32 24" className="h-6 w-8" aria-hidden="true">
      <path d="M2 4a2 2 0 0 1 2-2h8l3 3h13a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2Z" fill={hex} />
      <path d="M2 9h28v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2Z" fill="#081638" fillOpacity=".18" />
    </svg>
  );
}

/* --------------------------------------------------------- in progress */

export function InProgress({ projects }: { projects: ActiveProject[] }) {
  return (
    <section aria-labelledby="in-progress" className="mt-12 md:mt-14">
      <SectionHead
        n={2}
        id="in-progress"
        title="In"
        accent="progress"
        aside={projects.length > 1 ? <span className="eyebrow">{projects.length} on the go</span> : undefined}
      />
      {projects.length === 0 ? (
        <div className="relative mt-5 overflow-hidden rounded-card bg-gradient-to-r from-[#fde7f6] via-[#ece9ff] to-[#dff8ff] px-6 py-6 ring-1 ring-white/70">
          <div aria-hidden="true" className="absolute -top-10 -right-6 size-40 rounded-full bg-pink/30 blur-2xl" />
          <p className="relative max-w-xl text-body">
            <span className="block font-display-tight text-2xl text-strong">Nothing on the needles.</span>
            Open any pattern and choose <strong className="text-strong">Start a project</strong> — it&rsquo;ll be waiting here, one tap from Work Mode.
          </p>
        </div>
      ) : projects.length === 1 ? (
        <FeaturedProject p={projects[0]} />
      ) : (
        <ul
          className="no-scrollbar -mx-[var(--gutter)] mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-[var(--gutter)] px-[var(--gutter)] pt-1 pb-4 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 xl:grid-cols-3"
          data-testid="in-progress-list"
        >
          {projects.map((p) => (
            <li key={p.id} className="w-[84%] max-w-[22rem] shrink-0 snap-start md:w-auto md:max-w-none">
              <ProjectCard p={p} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Stats({ p, dark = false }: { p: ActiveProject; dark?: boolean }) {
  const items = [
    p.trackedSeconds > 0 ? `${formatDuration(p.trackedSeconds)} tracked` : null,
    p.sessionCount > 0 ? plural(p.sessionCount, "session") : null,
    p.last_worked_at ? `Last worked ${sinceLabel(p.last_worked_at)}` : "Not started yet",
  ].filter(Boolean);
  return (
    <p className={`flex flex-wrap gap-x-3 gap-y-1 text-sm ${dark ? "text-white/70" : "text-muted"}`}>
      {items.map((t, i) => (
        <span key={i} className="whitespace-nowrap">
          {i > 0 && <span aria-hidden="true" className="mr-3 opacity-40">·</span>}
          {t}
        </span>
      ))}
    </p>
  );
}

/** One active project: a composed feature, not a stretched widget. */
function FeaturedProject({ p }: { p: ActiveProject }) {
  return (
    <article className="tone-midnight relative isolate mt-5 grid overflow-hidden rounded-panel bg-midnight sm:grid-cols-[minmax(0,13rem)_1fr] lg:grid-cols-[minmax(0,15rem)_1fr_auto]" data-testid="featured-project">
      <FoilStrip className="col-span-full" left="Now making" right={p.progress !== null ? `${p.progress}% complete` : "Just started"} />
      <div aria-hidden="true" className="absolute -top-20 right-1/4 -z-10 size-72 rounded-full bg-cobalt/40 blur-[90px]" />
      <div aria-hidden="true" className="absolute -right-10 -bottom-24 -z-10 size-64 rounded-full bg-pink/25 blur-[90px]" />
      <div className="aspect-[16/10] sm:aspect-auto sm:min-h-[15rem]">
        <CoverArt url={p.coverUrl} title={p.name} craft={p.pattern?.craft} />
      </div>
      <div className="flex min-w-0 flex-col p-6 sm:p-7">
        {p.pattern && <p className="eyebrow truncate">{p.pattern.title}</p>}
        <h3 className="mt-2 font-display-tight text-[clamp(1.6rem,3.2vw,2.4rem)] leading-tight text-white [overflow-wrap:anywhere]">{p.name}</h3>
        <div className="mt-4 lg:hidden">
          <Bar value={p.progress} dark />
        </div>
        <div className="mt-3">
          <Stats p={p} dark />
        </div>
        <div className="mt-auto flex flex-wrap gap-3 pt-6">
          <Link href={`/projects/${p.id}/work`} className="btn btn-primary press" aria-label={`Continue ${p.name}`}>
            Continue making →
          </Link>
          <Link href={`/projects/${p.id}`} className="btn btn-secondary press">
            Project details
          </Link>
        </div>
      </div>
      <div className="hidden items-center pr-8 lg:flex">
        <ProgressRing value={p.progress} size={132} stroke={11} label="complete" tone="dark" />
      </div>
    </article>
  );
}

function Bar({ value, dark = false }: { value: number | null; dark?: boolean }) {
  const v = value ?? 0;
  return (
    <div>
      <div
        role="progressbar"
        aria-valuenow={v}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progress"
        className={`h-2.5 overflow-hidden rounded-full ${dark ? "bg-white/15" : "bg-midnight/10"}`}
      >
        <div className={`h-full rounded-full ${dark ? "bg-neon" : "bg-cobalt"}`} style={{ width: `${v}%` }} />
      </div>
      <p className={`mt-1 font-mono text-xs ${dark ? "text-white/70" : "text-muted"}`}>{value === null ? "No progress yet" : `${v}% complete`}</p>
    </div>
  );
}

function ProjectCard({ p }: { p: ActiveProject }) {
  return (
    <article className="card-plain lift flex h-full flex-col overflow-hidden rounded-card">
      <div className="relative aspect-[16/10] overflow-hidden">
        <CoverArt url={p.coverUrl} title={p.name} craft={p.pattern?.craft} />
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-midnight/70 to-transparent" />
        {p.pattern && <p className="absolute right-3 bottom-2.5 left-3 truncate text-xs font-semibold text-white/90">{p.pattern.title}</p>}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 text-lg leading-snug font-semibold text-strong [overflow-wrap:anywhere]">{p.name}</h3>
        <div className="mt-3">
          <Bar value={p.progress} />
        </div>
        <div className="mt-2">
          <Stats p={p} />
        </div>
        <Link href={`/projects/${p.id}/work`} className="btn btn-ink press mt-auto self-start !min-h-10 !px-4" aria-label={`Continue ${p.name}`} style={{ marginTop: "1rem" }}>
          Continue →
        </Link>
      </div>
    </article>
  );
}

/** Kept for other pages (pattern detail). */
export function Progress({ value, className = "" }: { value: number | null; className?: string }) {
  return (
    <div className={className}>
      <Bar value={value} />
    </div>
  );
}

/* ------------------------------------------------------- recently added */

export function RecentShelf({ patterns }: { patterns: RecentPattern[] }) {
  if (!patterns.length) return null;
  return (
    <section aria-labelledby="recent" className="mt-12 md:mt-14">
      <SectionHead
        n={3}
        id="recent"
        title="Recently"
        accent="added"
        aside={
          <Link href="/patterns/all" className="text-sm font-semibold text-accent hover:underline">
            All patterns →
          </Link>
        }
      />
      <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" data-testid="recent-grid">
        {patterns.map((p) => (
          <li key={p.id}>
            <PatternTile p={p} />
          </li>
        ))}
        {patterns.length < 4 && (
          <li>
            <Link
              href="/patterns/new"
              className="holo-border press flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-card bg-white/50 p-4 text-center hover:bg-white/80"
            >
              <span className="grid size-11 place-items-center rounded-full bg-midnight text-xl text-neon">＋</span>
              <span className="font-semibold text-strong">Add a pattern</span>
              <span className="text-xs text-muted">PDF, website, photos or video</span>
            </Link>
          </li>
        )}
      </ul>
    </section>
  );
}

/** Editorial pattern card: cover first, then title and quiet metadata. */
export function PatternTile({ p }: { p: RecentPattern }) {
  return (
    <Link href={`/patterns/${p.id}`} className="group block" data-testid="pattern-tile">
      <div className="card-plain lift relative overflow-hidden rounded-card p-1.5">
        <ViewTransition name={`cover-${p.id}`} share="morph" default="none">
          <div className="relative aspect-[3/4] overflow-hidden rounded-[1.1rem]">
            <div className="size-full motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-soft motion-safe:group-hover:scale-[1.03]">
              <CoverArt url={p.coverUrl} title={p.title} craft={p.craft} />
            </div>
          </div>
        </ViewTransition>
        {p.favorite && (
          <span className="absolute top-3.5 right-3.5 grid size-8 place-items-center rounded-full bg-white/95 text-sm text-[#c01f97] shadow" aria-label="Favourite" title="Favourite">
            ★
          </span>
        )}
        {p.active_count > 0 && (
          <span className="absolute bottom-3.5 left-3.5 rounded-full bg-midnight/90 px-2.5 py-1 text-[0.7rem] font-semibold text-neon">
            {p.active_count} in progress
          </span>
        )}
      </div>
      <h3 className="mt-3 line-clamp-2 leading-snug font-semibold text-strong [overflow-wrap:anywhere]">{p.title}</h3>
      <p className="mt-0.5 truncate text-sm text-muted">
        <span className="capitalize">{p.craft.replace("-", " ")}</span>
        {p.designer ? ` · ${p.designer}` : ""}
        {p.project_count > 0 && p.active_count === 0 ? ` · ${plural(p.project_count, "make")}` : ""}
      </p>
    </Link>
  );
}
