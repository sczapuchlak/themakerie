import type { Metadata } from "next";
import Link from "next/link";
import { compareProjects, formatDuration } from "@/lib/workspace/model";
import { CoverArt } from "@/components/library/cover-art";
import { ArchivePattern, ContinueChooser, DeletePattern, FavoriteToggle, MovePattern, StartProject } from "@/components/library/pattern-actions";
import { Progress } from "@/components/library/library-landing";
import { StatusPill } from "@/components/library/status-pill";
import { CRAFT_FIELDS, difficultyLabel, formatBytes } from "@/lib/library/constants";
import { folderPath, getCrafts, getFolders, getPattern } from "@/lib/library/data";

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
  const active = projects.filter((pr) => pr.status === "in_progress");
  const stepCount = sections.reduce((n, s) => n + s.steps.length, 0);
  const details = (p.craft_details ?? {}) as Record<string, string>;
  const specs: [string, string | null][] = [
    ["Craft", craft],
    ["Difficulty", difficultyLabel(p.difficulty)],
    ["Item type", p.category],
    ["Sizes", p.sizes],
    ["Dimensions", p.dimensions],
    ...(CRAFT_FIELDS[p.craft] ?? []).map((f): [string, string | null] => [f.label, details[f.key] ?? null]),
  ];

  return (
    <div className="gutter mx-auto w-full max-w-[72rem]">
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

      {/* 1–3: identity and primary actions */}
      <header className="tone-midnight surface-midnight relative mt-3 grid overflow-hidden rounded-panel md:grid-cols-[18rem_1fr]">
        <div className="aspect-[4/3] md:aspect-auto md:min-h-[22rem]">
          <CoverArt url={coverUrl} title={p.title} craft={p.craft} priority />
        </div>
        <div className="relative p-6 sm:p-8">
          <div className="tech-grid pointer-events-none absolute inset-0 text-white/[0.04]" />
          <p className="eyebrow relative">
            {craft}
            {difficultyLabel(p.difficulty) ? ` · ${difficultyLabel(p.difficulty)}` : ""}
            {p.archived_at ? " · Archived" : ""}
          </p>
          <h1 className="relative mt-3 font-display-tight text-[clamp(2.2rem,5vw,3.6rem)]">{p.title}</h1>
          {(p.designer || p.source_name) && (
            <p className="relative mt-2 text-body">
              {p.designer && <>by <strong className="text-strong">{p.designer}</strong></>}
              {p.designer && p.source_name ? " · " : ""}
              {p.source_name}
            </p>
          )}
          <div className="relative mt-6 flex flex-wrap gap-3">
            {active.length === 1 && (
              <Link href={`/projects/${active[0].id}/work`} className="btn btn-primary">
                Continue {active[0].name}
              </Link>
            )}
            {active.length > 1 && <ContinueChooser projects={active} />}
            {pdfs[0]?.fileUrl && (
              <a href={pdfs[0].fileUrl} target="_blank" rel="noopener noreferrer" className={active.length ? "btn btn-secondary" : "btn btn-primary"}>
                Open PDF{pdfs.length > 1 ? ` (${pdfs.length})` : ""}
              </a>
            )}
            {stepCount > 0 && (
              <a href="#instructions" className="btn btn-secondary">
                Instructions
              </a>
            )}
            {images.length > 0 && (
              <a href="#sources" className="btn btn-secondary">
                Photos ({images.length})
              </a>
            )}
          </div>
        </div>
      </header>

      {/* 4: projects */}
      <section aria-labelledby="projects" className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="projects" className="font-display-tight text-[1.7rem]">
            Projects <span className="font-mono text-base text-muted">{projects.length}</span>
          </h2>
          <StartProject patternId={p.id} patternTitle={p.title} />
        </div>
        {projects.length === 0 ? (
          <p className="surface-panel mt-3 rounded-card px-5 py-4 text-sm text-body">
            You haven&rsquo;t made this yet. Start a project to track progress, notes and photos — you can run several at once.
          </p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {projects.map((pr) => (
              <li key={pr.id}>
                <Link href={`/projects/${pr.id}`} className="surface-panel flex gap-4 rounded-card p-3 transition-transform duration-200 ease-soft hover:-translate-y-0.5">
                  <div className="aspect-square w-20 shrink-0 overflow-hidden rounded-tile">
                    <CoverArt url={pr.coverUrl ?? coverUrl} title={pr.name} craft={p.craft} />
                  </div>
                  <div className="min-w-0 flex-1 py-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="truncate font-semibold text-strong">{pr.name}</h3>
                      <StatusPill status={pr.status} />
                    </div>
                    {pr.size_colorway && <p className="truncate text-xs text-muted">{pr.size_colorway}</p>}
                    <Progress value={pr.progress} className="mt-2" />
                    <p className="text-xs text-muted">
                      {pr.last_worked_at ? `Last worked ${new Date(pr.last_worked_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : "Not worked on yet"}
                      {pr.sessionCount > 0 && ` · ${formatDuration(pr.trackedSeconds)} tracked`}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <ProjectComparison projects={projects} />

      {/* 5: structured instructions */}
      <section id="instructions" aria-labelledby="instructions-title" className="mt-10 scroll-mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="instructions-title" className="font-display-tight text-[1.7rem]">
            Instructions
          </h2>
          <Link href={`/patterns/${p.id}/instructions`} className="btn btn-secondary !min-h-10">
            {sections.length ? "Edit steps" : "Add steps"}
          </Link>
        </div>
        {sections.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            Optional: organize the pattern into sections and steps. The original {pdfs.length ? "PDF" : "source"} always stays untouched.
          </p>
        ) : (
          <ol className="mt-3 space-y-3">
            {sections.map((s) => (
              <li key={s.id} className="surface-panel rounded-card p-5">
                <h3 className="font-semibold text-strong">{s.title}</h3>
                {s.notes && <p className="mt-1 text-sm whitespace-pre-line text-body">{s.notes}</p>}
                {s.steps.length > 0 && (
                  <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-body marker:font-mono marker:text-muted">
                    {s.steps.map((st) => (
                      <li key={st.id}>
                        {st.row_start && (
                          <span className="mr-1 font-mono text-xs text-muted">
                            {st.row_end && st.row_end !== st.row_start ? `Rows ${st.row_start}–${st.row_end}` : `Row ${st.row_start}`}
                            {st.repeat_count ? ` ×${st.repeat_count}` : ""}:
                          </span>
                        )}
                        <span className="whitespace-pre-line">{st.body}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* 6: details, sources, notes */}
      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="specs" className="surface-panel rounded-card p-5 sm:p-6">
          <h2 id="specs" className="eyebrow">
            Details
          </h2>
          {p.description && <p className="mt-3 whitespace-pre-line text-body">{p.description}</p>}
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            {specs
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-strong">{v}</dd>
                </div>
              ))}
          </dl>
          {p.techniques.length > 0 && <TagList label="Techniques" items={p.techniques} />}
          {p.materials && <TextBlock label="Materials" text={p.materials} />}
          {p.tools && <TextBlock label="Tools" text={p.tools} />}
        </section>

        <section id="sources" aria-labelledby="sources-title" className="surface-panel scroll-mt-6 rounded-card p-5 sm:p-6">
          <h2 id="sources-title" className="eyebrow">
            Sources
          </h2>
          {sources.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No files or links yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {[...pdfs, ...links].map((s) => (
                <li key={s.id}>
                  <a
                    href={s.fileUrl ?? s.url ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-12 items-center gap-3 rounded-tile border border-line bg-white px-3 py-2 hover:border-line-strong"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-midnight font-mono text-[0.6rem] font-bold text-white uppercase">
                      {s.kind === "pdf" ? "PDF" : s.kind === "video" ? "▶" : "WWW"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-strong">{s.title || s.file_name || s.url}</span>
                      <span className="block truncate text-xs text-muted">
                        {s.kind === "pdf"
                          ? [formatBytes(s.size_bytes), s.page_count ? `${s.page_count} pages` : null, "Open / download"].filter(Boolean).join(" · ")
                          : s.url}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          {images.length > 0 && (
            <ul className="mt-3 grid grid-cols-3 gap-2">
              {images.map((s) => (
                <li key={s.id}>
                  <a href={s.fileUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="block aspect-square overflow-hidden rounded-tile bg-midnight/10">
                    {s.fileUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.fileUrl} alt={s.title ?? s.file_name ?? "Pattern image"} loading="lazy" className="size-full object-cover" />
                    )}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">Files are private to you. Downloading a PDF does not make it available offline in the app yet.</p>
        </section>
      </div>

      {(p.tags.length > 0 || p.notes) && (
        <section aria-label="Notes and tags" className="surface-panel mt-4 rounded-card p-5 sm:p-6">
          {p.tags.length > 0 && <TagList label="Tags" items={p.tags.map((t) => `#${t}`)} />}
          {p.notes && <TextBlock label="Notes" text={p.notes} />}
        </section>
      )}

      {/* 7: edit & organize */}
      <section aria-label="Organize" className="mt-8 flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <Link href={`/patterns/${p.id}/edit`} className="btn btn-ink">
          Edit pattern
        </Link>
        <FavoriteToggle id={p.id} favorite={p.favorite} />
        <MovePattern id={p.id} folderId={p.folder_id} folders={folders} />
        <ArchivePattern id={p.id} archived={Boolean(p.archived_at)} />
        <DeletePattern id={p.id} title={p.title} projectCount={projects.length} />
      </section>
    </div>
  );
}

function TagList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="mt-4">
      <p className="eyebrow">{label}</p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
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
      <p className="eyebrow">{label}</p>
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
    <section aria-labelledby="compare" className="surface-panel mt-4 rounded-card p-5 sm:p-6" data-testid="project-comparison">
      <h2 id="compare" className="eyebrow">
        Comparing your makes · tracked time
      </h2>
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
      <p className="mt-2 text-xs text-muted">Only timed sessions count; untimed work isn&rsquo;t included, so differences may not reflect all the effort.</p>
    </section>
  );
}
