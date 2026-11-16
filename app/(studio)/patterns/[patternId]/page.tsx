import type { Metadata } from "next";
import Link from "next/link";
import { ViewTransition } from "react";
import { FoilStrip, NumberedHeading } from "@/components/editorial/foil";
import { CoverArt } from "@/components/library/cover-art";
import { CoverAura, PaletteStrip } from "@/components/library/cover-palette";
import { Progress } from "@/components/library/library-landing";
import { ArchivePattern, ContinueChooser, DeletePattern, FavoriteToggle, MovePattern, StartProject } from "@/components/library/pattern-actions";
import { StatusPill } from "@/components/library/status-pill";
import { CRAFT_FIELDS, difficultyLabel, formatBytes } from "@/lib/library/constants";
import { folderPath, getCrafts, getFolders, getPattern } from "@/lib/library/data";
import { plural, sinceLabel } from "@/lib/library/format";
import { compareProjects, formatDuration } from "@/lib/workspace/model";

export const metadata: Metadata = { title: "Pattern" };

export default async function PatternPage({ params }: PageProps<"/patterns/[patternId]">) {
  const { patternId } = await params;
  const [{ pattern: p, coverUrl, sources, sections, projects }, folders, crafts] = await Promise.all([
    getPattern(patternId),
    getFolders(),
    getCrafts(),
  ]);

  const craft = crafts.find((c) => c.slug === p.craft)?.name ?? p.craft;
  const trail = folderPath(folders, p.folder_id);
  const pdfs = sources.filter((s) => s.kind === "pdf");
  const images = sources.filter((s) => s.kind === "image");
  const links = sources.filter((s) => s.kind === "website" || s.kind === "video");
  const readable = pdfs.length > 0 || images.length > 0;
  const active = projects.filter((pr) => pr.status === "in_progress");
  const stepCount = sections.reduce((n, s) => n + s.steps.length, 0);
  const details = (p.craft_details ?? {}) as Record<string, string>;
  // Never present the title (or a source) as if it were the designer.
  const designer = p.designer && p.designer.trim().toLowerCase() !== p.title.trim().toLowerCase() ? p.designer : null;
  const specs: [string, string | null][] = [
    ["Item type", p.category],
    ["Sizes", p.sizes],
    ["Dimensions", p.dimensions],
    ...(CRAFT_FIELDS[p.craft] ?? []).map((f): [string, string | null] => [f.label, details[f.key] ?? null]),
  ].filter((x): x is [string, string] => Boolean(x[1]));

  return (
    <div className="gutter mx-auto w-full max-w-[72rem] pb-10">
      <nav aria-label="Breadcrumb" className="mt-4 md:mt-8">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
          <li>
            <Link href="/patterns" className="font-semibold text-accent hover:underline">
              Pattern Library
            </Link>
          </li>
          {(trail.length ? trail : [{ id: "unsorted", name: "Unsorted" }]).map((f) => (
            <li key={f.id} className="flex items-center gap-1">
              <span aria-hidden="true">/</span>
              <Link href={f.id === "unsorted" ? "/patterns/unsorted" : `/patterns/folders/${f.id}`} className="font-semibold text-accent hover:underline">
                {f.name}
              </Link>
            </li>
          ))}
        </ol>
      </nav>

      {/* Hero: cover anchors, title is expressive but contained. */}
      <header className="tone-midnight relative isolate mt-3 overflow-hidden rounded-panel bg-midnight shadow-[0_30px_70px_-34px_rgb(8_22_56/0.65)]">
        <CoverAura src={coverUrl} cacheKey={p.cover_path} className="opacity-80" />
        <FoilStrip
          left={`Pattern — ${craft}`}
          right={[pdfs[0]?.page_count ? plural(pdfs[0].page_count, "page") : null, plural(projects.length, "make")].filter(Boolean).join(" · ")}
        />
        <div className="absolute top-[3.6rem] right-4 z-10 flex gap-2">
          <FavoriteToggle id={p.id} favorite={p.favorite} variant="icon" />
          <Link
            href={`/patterns/${p.id}/edit`}
            aria-label="Edit pattern details"
            title="Edit pattern details"
            className="press grid size-11 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/20"
          >
            <svg viewBox="0 0 20 20" className="size-[1.1rem]" aria-hidden="true">
              <path d="M13.6 3.2a2 2 0 0 1 2.8 2.8l-8.6 8.6-3.6.8.8-3.6Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
        <div className="grid items-center gap-6 p-5 sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-8 sm:p-8 md:grid-cols-[minmax(0,13.5rem)_1fr]">
          <div className="relative w-full max-w-[9rem] sm:max-w-none">
            <div className="absolute inset-3 translate-y-5 rounded-card bg-black/40 blur-2xl" aria-hidden="true" />
            <ViewTransition name={`cover-${p.id}`} share="morph" default="none">
              <div className="relative aspect-[3/4] -rotate-2 overflow-hidden rounded-card shadow-2xl ring-1 ring-white/25 motion-safe:transition-transform motion-safe:duration-500 motion-safe:hover:rotate-0">
                <CoverArt url={coverUrl} title={p.title} craft={p.craft} priority />
              </div>
            </ViewTransition>
          </div>
          <div className="min-w-0 sm:pr-24">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold tracking-[0.14em] text-white/70 uppercase">
              <span className="inline-flex items-center gap-1.5 text-white">
                <span className="size-2 rounded-full bg-neon shadow-[0_0_10px_var(--neon-glow)]" aria-hidden="true" />
                {craft}
              </span>
              {p.difficulty && (
                <span className="inline-flex items-center gap-1.5" title={`Difficulty ${p.difficulty} of 5`}>
                  <span className="flex gap-0.5" aria-hidden="true">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span key={n} className={`h-2.5 w-1.5 rounded-full ${n <= (p.difficulty ?? 0) ? "bg-pink" : "bg-white/20"}`} />
                    ))}
                  </span>
                  {difficultyLabel(p.difficulty)}
                </span>
              )}
              {p.category && <span>{p.category}</span>}
              {p.archived_at && <span className="rounded-full bg-peach px-2 py-0.5 text-midnight">Archived</span>}
            </p>
            <h1 className="mt-3 font-display-tight text-[clamp(1.9rem,4.2vw,3.1rem)] leading-[1.02] text-white [overflow-wrap:anywhere]">{p.title}</h1>
            {(designer || p.source_name) && (
              <p className="mt-2 text-white/80">
                {designer && (
                  <>
                    by <span className="font-serif text-[1.3em] text-white italic">{designer}</span>
                  </>
                )}
                {designer && p.source_name ? <span className="mx-2 opacity-40">·</span> : ""}
                {p.source_name && <span>{p.source_name}</span>}
              </p>
            )}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {active.length === 1 && (
                <Link href={`/projects/${active[0].id}/work`} className="btn btn-primary press" data-testid="continue-making">
                  Continue making →
                </Link>
              )}
              {active.length > 1 && <ContinueChooser projects={active} />}
              {readable && (
                <Link
                  href={`/patterns/${p.id}/read`}
                  className={active.length ? "btn press bg-white text-midnight hover:bg-white/90" : "btn btn-primary press"}
                  data-testid="read-pattern"
                >
                  Read pattern
                </Link>
              )}
              <StartProject
                patternId={p.id}
                patternTitle={p.title}
                className={readable || active.length ? "btn btn-secondary press" : "btn btn-primary press"}
                label={projects.length ? "＋ New project" : "＋ Start a project"}
              />
            </div>
          </div>
        </div>
      </header>

      {/* My Makes — every project made from this pattern */}
      <section aria-labelledby="makes" className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <NumberedHeading n={1} id="makes">
              My <span className="font-serif font-normal tracking-normal text-vivid italic">makes</span>
            </NumberedHeading>
            <p className="mt-1 text-sm text-muted">
              {projects.length
                ? `${plural(projects.length, "project")} from this pattern — each with its own progress, counters, notes and photos.`
                : "Each time you make this, start a project — they're tracked independently."}
            </p>
          </div>
        </div>
        {projects.length === 0 ? (
          <div className="holo-border mt-4 flex flex-wrap items-center justify-between gap-4 rounded-card bg-white/60 px-5 py-5">
            <p className="text-body">
              <strong className="block text-strong">You haven&rsquo;t made this yet.</strong>
              Start a project to get counters, a timer, progress and a journal.
            </p>
            <StartProject patternId={p.id} patternTitle={p.title} className="btn btn-ink press" label="＋ Start a project" />
          </div>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="makes-list">
            {projects.map((pr) => {
              const isActive = pr.status === "in_progress";
              return (
                <li key={pr.id}>
                  <article className="card-plain lift flex h-full flex-col overflow-hidden rounded-card">
                    <Link href={`/projects/${pr.id}`} className="relative block aspect-[16/9] overflow-hidden" tabIndex={-1} aria-hidden="true">
                      <CoverArt url={pr.coverUrl ?? coverUrl} title={pr.name} craft={p.craft} />
                      <span className="absolute top-3 left-3">
                        <StatusPill status={pr.status} />
                      </span>
                    </Link>
                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="text-lg leading-snug font-semibold text-strong [overflow-wrap:anywhere]">
                        <Link href={`/projects/${pr.id}`} className="hover:underline">
                          {pr.name}
                        </Link>
                      </h3>
                      {pr.size_colorway && <p className="truncate text-sm text-muted">{pr.size_colorway}</p>}
                      <Progress value={pr.progress} className="mt-3" />
                      <p className="mt-1.5 text-sm text-muted">
                        {pr.sessionCount > 0 ? `${formatDuration(pr.trackedSeconds)} tracked · ` : ""}
                        {pr.status === "finished" && pr.finished_on
                          ? `Finished ${new Date(pr.finished_on).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
                          : pr.last_worked_at
                            ? `Last worked ${sinceLabel(pr.last_worked_at)}`
                            : "Not started yet"}
                      </p>
                      <div className="mt-auto flex gap-2 pt-4">
                        {isActive || pr.status === "planned" || pr.status === "paused" ? (
                          <Link href={`/projects/${pr.id}/work`} className={`btn press !min-h-10 !px-4 ${isActive ? "btn-ink" : "btn-secondary"}`} aria-label={`${isActive ? "Continue" : "Open Work Mode for"} ${pr.name}`}>
                            {isActive ? "Continue →" : "Work Mode"}
                          </Link>
                        ) : null}
                        <Link href={`/projects/${pr.id}`} className="btn btn-secondary press !min-h-10 !px-4">
                          Open
                        </Link>
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
        <ProjectComparison projects={projects} />
      </section>

      {/* Reference: sources + details beside the optional instructions */}
      <div className="mt-12 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6 lg:order-2">
          <section id="sources" aria-labelledby="sources-title" className="card-plain scroll-mt-6 rounded-card p-5">
            <h2 id="sources-title" className="font-semibold text-strong">
              Pattern files <span className="font-mono text-sm font-normal text-muted">{sources.length}</span>
            </h2>
            {sources.length === 0 ? (
              <p className="mt-2 text-sm text-muted">
                No files or links yet.{" "}
                <Link href={`/patterns/${p.id}/edit`} className="font-semibold text-accent underline">
                  Add a source
                </Link>
              </p>
            ) : (
              <ul className="mt-3 space-y-2" data-testid="sources">
                {pdfs.map((s) => (
                  <SourceRow
                    key={s.id}
                    icon={<DocIcon kind="pdf" />}
                    title={s.title || s.file_name || "Pattern PDF"}
                    meta={[s.page_count ? plural(s.page_count, "page") : null, formatBytes(s.size_bytes)].filter(Boolean).join(" · ")}
                    primary={{ href: `/patterns/${p.id}/read`, label: "Read" }}
                    secondary={s.fileUrl ? { href: s.fileUrl, label: "Download original", download: true } : undefined}
                  />
                ))}
                {images.length > 0 && (
                  <li className="rounded-tile border border-line p-2.5">
                    <div className="flex items-center gap-3">
                      <DocIcon kind="image" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-strong">{plural(images.length, "image")}</span>
                        <span className="block text-xs text-muted">Charts, photos and scans</span>
                      </span>
                      <Link href={`/patterns/${p.id}/read`} className="btn btn-secondary press !min-h-9 !px-3 !text-xs">
                        View
                      </Link>
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-1.5">
                      {images.slice(0, 4).map((s) =>
                        s.fileUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={s.id} src={s.fileUrl} alt={s.title ?? s.file_name ?? "Pattern image"} loading="lazy" className="aspect-square w-full rounded-md object-cover" />
                        ) : null,
                      )}
                    </div>
                  </li>
                )}
                {links.map((s) => (
                  <SourceRow
                    key={s.id}
                    icon={<DocIcon kind={s.kind as "video" | "website"} />}
                    title={s.title || hostOf(s.url) || "Link"}
                    meta={hostOf(s.url) ?? ""}
                    primary={{ href: s.url ?? "#", label: s.kind === "video" ? "Watch ↗" : "Visit ↗", external: true }}
                  />
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted">Private to you. Originals are never modified. For offline crafting, use a project&rsquo;s Work Mode → Offline.</p>
          </section>

          {(specs.length > 0 || p.description || p.techniques.length || p.materials || p.tools || p.tags.length || p.notes || coverUrl) && (
            <section aria-labelledby="details-title" className="card-plain rounded-card p-5">
              <h2 id="details-title" className="font-semibold text-strong">
                Details
              </h2>
              {p.description && <p className="mt-2 text-sm whitespace-pre-line text-body">{p.description}</p>}
              {specs.length > 0 && (
                <dl className="mt-3 divide-y divide-line text-sm">
                  {specs.map(([k, v]) => (
                    <div key={k} className="flex gap-4 py-2">
                      <dt className="w-28 shrink-0 text-muted">{k}</dt>
                      <dd className="min-w-0 text-strong [overflow-wrap:anywhere]">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {p.techniques.length > 0 && <TagList label="Techniques" items={p.techniques} />}
              {p.materials && <TextBlock label="Materials" text={p.materials} />}
              {p.tools && <TextBlock label="Tools" text={p.tools} />}
              {p.tags.length > 0 && <TagList label="Tags" items={p.tags.map((t) => `#${t}`)} />}
              {p.notes && <TextBlock label="Notes" text={p.notes} />}
              {coverUrl && (
                <div className="tone-midnight mt-4 rounded-tile bg-midnight px-3 py-2.5">
                  <PaletteStrip src={coverUrl} cacheKey={p.cover_path} />
                </div>
              )}
            </section>
          )}
        </div>

        {/* Optional structured instructions — the original stays authoritative */}
        <section id="instructions" aria-labelledby="instructions-title" className="scroll-mt-6 lg:order-1">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <NumberedHeading n={2} id="instructions-title" size="sm">
                Instructions
              </NumberedHeading>
              <p className="mt-1 text-sm text-muted">
                {stepCount ? `${plural(sections.length, "section")} · ${plural(stepCount, "step")} · ` : ""}Your working copy — the original {pdfs.length ? "PDF" : "source"} stays authoritative.
              </p>
            </div>
            <Link href={`/patterns/${p.id}/instructions`} className="btn btn-secondary press !min-h-10">
              {sections.length ? "Edit steps" : "Add steps"}
            </Link>
          </div>
          {sections.length === 0 ? (
            <div className="mt-4 rounded-card border-2 border-dashed border-line px-5 py-6 text-sm text-body">
              <p>
                Optional: type sections and steps you&rsquo;d like to tick off in Work Mode — rounds, repeats, row ranges. Each project keeps its own ticks.
              </p>
            </div>
          ) : (
            <ol className="mt-4 space-y-3" data-testid="instructions">
              {sections.map((s, i) => {
                const rows = s.steps.flatMap((st) => [st.row_start, st.row_end]).filter((n): n is number => typeof n === "number");
                return (
                  <li key={s.id}>
                    <details className="group card-plain overflow-hidden rounded-card" open={sections.length <= 2 || i === 0}>
                      <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
                        <span aria-hidden="true" className="iridescent-text w-9 shrink-0 text-center font-display-tight text-[1.9rem] leading-none">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-strong [overflow-wrap:anywhere]">{s.title}</span>
                          <span className="block text-xs text-muted">
                            {plural(s.steps.length, "step")}
                            {rows.length ? ` · rows ${Math.min(...rows)}–${Math.max(...rows)}` : ""}
                          </span>
                        </span>
                        <span aria-hidden="true" className="text-muted motion-safe:transition-transform group-open:rotate-180">
                          ⌄
                        </span>
                      </summary>
                      <div className="border-t border-line px-5 py-4">
                        {s.notes && <p className="mb-3 text-sm whitespace-pre-line text-muted">{s.notes}</p>}
                        <ol className="space-y-2.5">
                          {s.steps.map((st, k) => (
                            <li key={st.id} className="flex gap-3 text-sm">
                              <span className="w-6 shrink-0 pt-0.5 text-right font-mono text-xs text-muted">{k + 1}.</span>
                              <span className="min-w-0 flex-1 text-body">
                                {st.row_start && (
                                  <span className="mr-2 inline-block rounded-full bg-[#e9e7ff] px-2 py-0.5 font-mono text-[0.7rem] font-semibold text-[#2c2d9e]">
                                    {st.row_end && st.row_end !== st.row_start ? `Rows ${st.row_start}–${st.row_end}` : `Row ${st.row_start}`}
                                    {st.repeat_count ? ` ×${st.repeat_count}` : ""}
                                  </span>
                                )}
                                <span className="whitespace-pre-line">{st.body}</span>
                              </span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      {/* Manage — tertiary, out of the way, confirmations intact */}
      <section aria-label="Manage pattern" className="mt-12 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-5 text-sm">
        <span className="eyebrow mr-1">Manage</span>
        <Link href={`/patterns/${p.id}/edit`} className="min-h-11 content-center font-semibold text-strong hover:underline">
          Edit details
        </Link>
        <MovePattern id={p.id} folderId={p.folder_id} folders={folders} className="min-h-11 font-semibold text-strong hover:underline" />
        <ArchivePattern id={p.id} archived={Boolean(p.archived_at)} className="min-h-11 font-semibold text-strong hover:underline" />
        <DeletePattern id={p.id} title={p.title} projectCount={projects.length} />
      </section>
    </div>
  );
}

const hostOf = (url: string | null) => {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, "") : null;
  } catch {
    return null;
  }
};

function DocIcon({ kind }: { kind: "pdf" | "image" | "video" | "website" }) {
  const map = {
    pdf: { bg: "bg-[#ffe1e8] text-[#a3123f]", label: "PDF" },
    image: { bg: "bg-[#e1f6ff] text-[#0d5f80]", label: "IMG" },
    video: { bg: "bg-[#efe6ff] text-[#5b2bb5]", label: "▶" },
    website: { bg: "bg-[#e4fbef] text-[#18663e]", label: "WWW" },
  }[kind];
  return <span className={`grid size-10 shrink-0 place-items-center rounded-xl font-mono text-[0.62rem] font-bold ${map.bg}`}>{map.label}</span>;
}

function SourceRow({
  icon,
  title,
  meta,
  primary,
  secondary,
}: {
  icon: React.ReactNode;
  title: string;
  meta: string;
  primary: { href: string; label: string; external?: boolean };
  secondary?: { href: string; label: string; download?: boolean };
}) {
  return (
    <li className="flex items-center gap-3 rounded-tile border border-line p-2.5">
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-strong">{title}</span>
        <span className="block truncate text-xs text-muted">{meta}</span>
      </span>
      {secondary && (
        <a
          href={secondary.href}
          download={secondary.download || undefined}
          aria-label={secondary.label}
          title={secondary.label}
          className="press grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-selected hover:text-strong"
        >
          <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true">
            <path d="M10 3v10m0 0-4-4m4 4 4-4M4 16h12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      )}
      {primary.external ? (
        <a href={primary.href} target="_blank" rel="noopener noreferrer" className="btn btn-secondary press shrink-0 !min-h-9 !px-3 !text-xs">
          {primary.label}
        </a>
      ) : (
        <Link href={primary.href} className="btn btn-ink press shrink-0 !min-h-9 !px-3 !text-xs">
          {primary.label}
        </Link>
      )}
    </li>
  );
}

function TagList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((t) => (
          <li key={t} className="rounded-full bg-midnight/[0.06] px-2.5 py-1 text-xs font-semibold text-strong">
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TextBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="mt-1 text-sm whitespace-pre-line text-body">{text}</p>
    </div>
  );
}

function ProjectComparison({ projects }: { projects: { id: string; name: string; status: string; trackedSeconds: number; sessionCount: number }[] }) {
  const withTime = projects.filter((p) => p.sessionCount > 0);
  if (withTime.length < 2) return null;
  const cmp = compareProjects(projects.map((p) => ({ id: p.id, name: p.name, status: p.status, trackedSeconds: p.trackedSeconds, sessions: p.sessionCount })));
  const max = Math.max(...withTime.map((p) => p.trackedSeconds));
  return (
    <section aria-labelledby="compare" className="card-plain mt-4 rounded-card p-5" data-testid="project-comparison">
      <h3 id="compare" className="font-semibold text-strong">
        Comparing your makes <span className="font-normal text-muted">· tracked time</span>
      </h3>
      <ul className="mt-3 space-y-2">
        {withTime.map((p) => (
          <li key={p.id} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm">
            <span className="truncate font-semibold text-strong">{p.name}</span>
            <span className="h-2 overflow-hidden rounded-full bg-selected">
              <span className="block h-full rounded-full bg-cobalt" style={{ width: `${(p.trackedSeconds / max) * 100}%` }} />
            </span>
            <span className="font-mono text-strong">
              {formatDuration(p.trackedSeconds)}
              {p.status !== "finished" && <span className="ml-1 text-xs text-muted">so far</span>}
            </span>
          </li>
        ))}
      </ul>
      {cmp.difference !== null && cmp.fastest && cmp.slowest ? (
        <p className="mt-3 text-sm text-body">
          <strong className="text-strong">{cmp.fastest.name}</strong> took {formatDuration(cmp.difference)} less tracked work than{" "}
          <strong className="text-strong">{cmp.slowest.name}</strong>.
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted">A direct comparison appears once at least two finished projects have tracked sessions.</p>
      )}
      <p className="mt-2 text-xs text-muted">Only timed sessions count; untimed work isn&rsquo;t included.</p>
    </section>
  );
}
