import Link from "next/link";
import { LocalTime } from "@/components/ui/local-time";
import { HeroFoil } from "@/components/art/holo-art";
import { SectionLabel } from "@/components/editorial/section-label";
import { CoverArt } from "@/components/library/cover-art";
import type { HomeFeatured } from "@/lib/library/data";
import { LiveTimer } from "./live-timer";
import { chartKey, StitchChart } from "./stitch-chart";

/**
 * Continue Creating — the focal point of Home.
 * Left: midnight editorial block with the primary actions.
 * Right: a "pattern page" showing what making looks like here — a charted
 * motif with a row highlighter — under a slim strip of holographic foil.
 *
 * Empty for now. When projects exist, the right half becomes the active
 * project's cover photo (or its open pattern page), and the Row / Timer /
 * Pattern strip fills with that project's live values.
 */
export function ContinueCreating({ featured, newestPatternId }: { featured: HomeFeatured | null; newestPatternId: string | null }) {
  if (featured) return <Featured p={featured} />;
  // No project yet: "Start a project" goes to your newest pattern (where the button lives).
  const startHref = newestPatternId ? (`/patterns/${newestPatternId}` as const) : ("/patterns/new" as const);
  return (
    <section
      aria-labelledby="continue-title"
      className="mt-6 grid overflow-hidden rounded-panel shadow-[0_32px_64px_-32px_rgb(8_22_56/0.55)] md:mt-8 lg:grid-cols-12"
    >
      {/* Editorial block */}
      <div className="tone-midnight surface-midnight relative p-6 sm:p-8 lg:col-span-7 xl:p-12">
        <div className="tech-grid pointer-events-none absolute inset-0 text-white/[0.04]" />
        <div className="relative flex items-end gap-4">
          <span aria-hidden="true" className="chrome-text font-display-tight text-[3.25rem] xl:text-[4.5rem]">
            01
          </span>
          <div className="pb-1.5">
            <SectionLabel>Continue creating</SectionLabel>
          </div>
        </div>

        <h2
          id="continue-title"
          className="relative mt-5 max-w-[26rem] font-display-tight text-[clamp(2.4rem,5vw,4rem)]"
        >
          Nothing on the needles{" "}
          <span className="font-serif font-normal tracking-normal text-vivid italic">— yet.</span>
        </h2>
        <p className="relative mt-5 max-w-[28rem] leading-relaxed text-body">
          Start a project and it waits for you here: the pattern you had open, the row you were
          on, the timer you paused.
        </p>

        <div className="relative mt-7 flex flex-wrap gap-3">
          <Link href={startHref} className="btn btn-primary press">
            <Plus />
            Start a project
          </Link>
          <Link href="/patterns/new" className="btn btn-secondary press">
            <Plus />
            Add a pattern
          </Link>
        </div>

        {/* Session meta — the slots a live project will fill */}
        <dl className="relative mt-9 grid max-w-[30rem] grid-cols-3 border-t border-line pt-4">
          {[
            ["Row", "—"],
            ["Timer", "--:--"],
            ["Pattern", "—"],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="eyebrow">{label}</dt>
              <dd className="mt-1 font-mono text-lg text-strong">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Pattern page */}
      <figure className="flex flex-col bg-paper lg:col-span-5">
        <div className="relative flex h-11 items-center justify-between overflow-hidden px-4">
          <HeroFoil sizes="(min-width: 1024px) 40vw, 100vw" />
          <span className="relative rounded-md bg-midnight px-2 py-1 font-mono text-[0.62rem] tracking-[0.14em] text-white uppercase">
            Fig. 01 — Charted motif
          </span>
          <span className="relative hidden rounded-md bg-midnight px-2 py-1 font-mono text-[0.62rem] tracking-[0.14em] text-white uppercase sm:inline">
            Reader preview
          </span>
        </div>

        <div className="flex flex-1 flex-col justify-center gap-5 p-5 sm:p-6 xl:p-8">
          <StitchChart className="mx-auto w-full max-w-[26rem] lg:max-w-none" />
          <ul aria-label="Colour key" className="hidden flex-wrap gap-x-4 gap-y-2 sm:flex">
            {chartKey.map((k) => (
              <li key={k.name} className="flex items-center gap-1.5 text-xs font-medium text-body">
                <span
                  aria-hidden="true"
                  className="size-3 rounded-[3px] ring-1 ring-midnight/15"
                  style={{ backgroundColor: k.color }}
                />
                {k.name}
              </li>
            ))}
          </ul>
          <figcaption className="text-sm leading-relaxed text-muted">
            Your patterns open here — with a row highlighter you move as you work.
          </figcaption>
        </div>
      </figure>
    </section>
  );
}

function Plus() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** The live version: your most recent project, exactly where you left it. */
function Featured({ p }: { p: HomeFeatured }) {
  return (
    <section
      aria-labelledby="continue-title"
      className="mt-6 grid overflow-hidden rounded-panel shadow-[0_32px_64px_-32px_rgb(8_22_56/0.55)] md:mt-8 lg:grid-cols-12"
      data-testid="home-featured"
    >
      <div className="tone-midnight surface-midnight relative flex flex-col p-6 sm:p-8 lg:col-span-7 xl:p-12">
        <div className="tech-grid pointer-events-none absolute inset-0 text-white/[0.04]" />
        <div className="relative flex items-end gap-4">
          <span aria-hidden="true" className="chrome-text font-display-tight text-[3.25rem] xl:text-[4.5rem]">
            01
          </span>
          <div className="pb-1.5">
            <SectionLabel>Continue creating</SectionLabel>
          </div>
        </div>

        <h2 id="continue-title" className="relative mt-5 font-display-tight text-[clamp(2.2rem,4.6vw,3.6rem)] leading-[1.02] [overflow-wrap:anywhere]">
          {p.name}
        </h2>
        <p className="relative mt-3 max-w-[30rem] text-body">
          {p.pattern && (
            <>
              from{" "}
              <Link href={`/patterns/${p.pattern.id}`} className="font-semibold text-strong underline decoration-white/30 underline-offset-4 hover:decoration-white">
                {p.pattern.title}
              </Link>
              {" · "}
            </>
          )}
          {p.last_worked_at ? <LocalTime iso={p.last_worked_at} preset="since" prefix="last worked " /> : "ready when you are"}
        </p>

        <div className="relative mt-5 max-w-[30rem]">
          <div className="h-2.5 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuenow={p.progress ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
            <div className="h-full rounded-full bg-neon" style={{ width: `${p.progress ?? 0}%` }} />
          </div>
          <p className="mt-1 font-mono text-xs text-muted">{p.progress ?? 0}% complete</p>
        </div>

        <div className="relative mt-7 flex flex-wrap gap-3">
          <Link href={`/projects/${p.id}/work`} className="btn btn-primary press">
            Continue making →
          </Link>
          <Link href={`/projects/${p.id}`} className="btn btn-secondary press">
            Project details
          </Link>
        </div>

        <dl className="relative mt-auto grid max-w-[34rem] grid-cols-3 gap-3 border-t border-line pt-4" style={{ marginTop: "2.25rem" }}>
          <div>
            <dt className="eyebrow">{p.rowLabel}</dt>
            <dd className="mt-1 font-mono text-lg text-strong">{p.row}</dd>
          </div>
          <div>
            <dt className="eyebrow">Timer</dt>
            <dd className="mt-1 font-mono text-lg text-strong">
              <LiveTimer session={p.session} trackedSeconds={p.trackedSeconds} />
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="eyebrow">Pattern</dt>
            <dd className="mt-1 truncate text-lg text-strong">{p.pattern?.title ?? "—"}</dd>
          </div>
        </dl>
      </div>

      <figure className="relative flex min-h-[16rem] flex-col bg-paper lg:col-span-5">
        <div className="relative flex h-11 items-center justify-between overflow-hidden px-4">
          <HeroFoil sizes="(min-width: 1024px) 40vw, 100vw" />
          <span className="relative rounded-md bg-midnight px-2 py-1 font-mono text-[0.62rem] tracking-[0.14em] text-white uppercase">Fig. 01 — Now making</span>
          <span className="relative hidden rounded-md bg-midnight px-2 py-1 font-mono text-[0.62rem] tracking-[0.14em] text-white uppercase sm:inline">
            {p.sessionCount ? `${p.sessionCount} session${p.sessionCount === 1 ? "" : "s"}` : "Project"}
          </span>
        </div>
        <Link href={`/projects/${p.id}/work`} className="group relative block min-h-[14rem] flex-1 overflow-hidden" aria-label={`Open ${p.name} in Work Mode`}>
          <div className="absolute inset-0 motion-safe:transition-transform motion-safe:duration-700 motion-safe:group-hover:scale-[1.03]">
            <CoverArt url={p.coverUrl} title={p.name} craft={p.pattern?.craft} />
          </div>
        </Link>
      </figure>
    </section>
  );
}
