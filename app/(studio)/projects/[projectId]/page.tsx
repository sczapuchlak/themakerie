import type { Metadata } from "next";
import { LocalTime } from "@/components/ui/local-time";
import Link from "next/link";
import { CoverArt } from "@/components/library/cover-art";
import { CoverAura } from "@/components/library/cover-palette";
import { ProgressRing } from "@/components/library/progress-ring";
import { DeleteProject } from "@/components/library/project-panel";
import { EditProject, FloatingWorkButton, PhotoGallery, ProgressCard, StatusMenu } from "@/components/project/project-dashboard";
import { Journal, ProjectInsights } from "@/components/workspace/journal";
import { getProject } from "@/lib/library/data";
import { computeProgress, NOTE_KINDS } from "@/lib/workspace/model";
import { buildSnapshot, workspaceClient } from "@/lib/workspace/server";
import { ProjectSuppliesSection } from "@/components/stash/project-supplies";
import { getPickableStock, getProjectSupplies } from "@/lib/stash/data";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({ params }: PageProps<"/projects/[projectId]">) {
  const { projectId } = await params;
  const { project, coverUrl, pattern, photos } = await getProject(projectId);
  const { supabase } = await workspaceClient();
  const [snapshot, supplies, pickable] = await Promise.all([
    buildSnapshot(supabase, projectId).then((x) => x!),
    getProjectSupplies(projectId, project.pattern_id),
    getPickableStock(),
  ]);
  const summary = computeProgress(snapshot);
  const open = snapshot.sessions.find((s) => s.status !== "finished");
  const latestPhoto = [...photos].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.url ?? null;
  const heroImage = coverUrl ?? latestPhoto ?? snapshot.pattern?.coverUrl ?? null;
  const active = project.status === "in_progress" || project.status === "planned" || project.status === "paused";
  const noteGroups = NOTE_KINDS.map((k) => ({ ...k, notes: snapshot.notes.filter((n) => n.kind === k.value) })).filter((g) => g.notes.length);

  return (
    <div className="gutter mx-auto w-full max-w-[72rem] pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-10">
      <nav aria-label="Breadcrumb" className="mt-4 md:mt-8">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
          <li>
            <Link href="/patterns" className="font-semibold text-accent hover:underline">
              Pattern Library
            </Link>
          </li>
          {pattern && (
            <li className="flex min-w-0 items-center gap-1">
              <span aria-hidden="true">/</span>
              <Link href={`/patterns/${pattern.id}`} className="truncate font-semibold text-accent hover:underline">
                {pattern.title}
              </Link>
            </li>
          )}
        </ol>
      </nav>

      {/* Hero: the make itself, with momentum */}
      <header id="project-hero" className="tone-midnight relative isolate mt-3 overflow-hidden rounded-panel bg-midnight shadow-[0_30px_70px_-34px_rgb(8_22_56/0.65)]" data-testid="project-hero">
        <CoverAura src={snapshot.pattern?.coverUrl ?? null} cacheKey={snapshot.pattern?.cover_path ?? null} className="opacity-80" />
        <div className="grid sm:grid-cols-[minmax(0,14rem)_1fr] lg:grid-cols-[minmax(0,16rem)_1fr_auto]">
          <div className="aspect-[16/9] sm:aspect-auto sm:min-h-[16rem]">
            <CoverArt url={heroImage} title={project.name} craft={pattern?.craft} priority />
          </div>
          <div className="flex min-w-0 flex-col p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-2">
              <StatusMenu projectId={project.id} status={project.status} finishedOn={project.finished_on} />
              {project.size_colorway && <span className="text-sm text-white/70">{project.size_colorway}</span>}
            </div>
            <h1 className="mt-3 font-display-tight text-[clamp(1.9rem,4.4vw,3rem)] leading-[1.02] text-white [overflow-wrap:anywhere]">{project.name}</h1>
            {pattern && (
              <p className="mt-1.5 text-white/75">
                from{" "}
                <Link href={`/patterns/${pattern.id}`} className="font-semibold text-white underline decoration-white/30 underline-offset-4 hover:decoration-white">
                  {pattern.title}
                </Link>
              </p>
            )}
            <div className="mt-4 lg:hidden">
              <div className="h-2.5 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuenow={summary.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
                <div className="h-full rounded-full bg-neon" style={{ width: `${summary.percent}%` }} />
              </div>
              <p className="mt-1 font-mono text-xs text-white/70">{summary.percent}% complete</p>
            </div>
            <p className="mt-3 text-sm text-white/70">
              {open
                ? open.status === "active"
                  ? "● Session running now"
                  : "Session paused"
                : project.last_worked_at
                  ? <LocalTime iso={project.last_worked_at} preset="since" prefix="Last worked " />
                  : project.status === "finished"
                    ? "Finished — well done."
                    : "Ready when you are."}
            </p>
            <div className="mt-auto flex flex-wrap gap-3 pt-5">
              <Link href={`/projects/${project.id}/work`} className={`btn press ${active ? "btn-primary" : "btn-secondary"}`} data-testid="open-work-mode">
                {project.status === "in_progress" ? "Continue making →" : "Open Work Mode"}
              </Link>
              <EditProject project={project} />
            </div>
          </div>
          <div className="hidden items-center pr-8 lg:flex">
            <ProgressRing value={summary.percent} size={136} stroke={11} label="complete" tone="dark" />
          </div>
        </div>
      </header>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-10">
          <PhotoGallery projectId={project.id} coverPath={project.cover_path} photos={photos} n={1} />
          <ProjectSuppliesSection n={photos.length ? 2 : 1} projectId={project.id} projectName={project.name} supplies={supplies} pickable={pickable} />
          <Journal snapshot={snapshot} n={photos.length ? 3 : 2} />
        </div>
        <aside className="space-y-4">
          <ProgressCard snapshot={snapshot} />
          <ProjectInsights snapshot={snapshot} />

          <section aria-labelledby="notes-title" className="card-plain rounded-card p-5" data-testid="notes">
            <div className="flex items-center justify-between gap-3">
              <h2 id="notes-title" className="font-semibold text-strong">
                Notes
              </h2>
              <EditProject project={project} trigger="notes" />
            </div>
            {project.notes ? (
              <p className="mt-2 text-sm whitespace-pre-wrap text-body" data-testid="notes-body">
                {project.notes}
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted">Nothing yet — yarn swaps, needle sizes, what you changed.</p>
            )}
            {noteGroups.map((g) => (
              <div key={g.value} className="mt-4">
                <h3 className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">{g.label}</h3>
                <ul className="mt-1.5 space-y-1.5">
                  {g.notes.map((n) => (
                    <li key={n.id} className="rounded-tile bg-selected px-3 py-2 text-sm whitespace-pre-wrap text-body">
                      {n.pinned && <span aria-label="Pinned">📌 </span>}
                      {n.body}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        </aside>
      </div>

      <section aria-label="Manage project" className="mt-12 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-5 text-sm">
        <span className="eyebrow mr-1">Manage</span>
        <DeleteProject project={project} />
      </section>

      {/* Phone: the way back into making once the hero has scrolled away. */}
      {active && (
        <FloatingWorkButton href={`/projects/${project.id}/work`} label={project.status === "in_progress" ? "Continue making →" : "Open Work Mode"} targetId="project-hero" />
      )}
    </div>
  );
}
