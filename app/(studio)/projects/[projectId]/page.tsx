import type { Metadata } from "next";
import Link from "next/link";
import { CoverArt } from "@/components/library/cover-art";
import { DeleteProject, Photos, ProjectDetails, ProjectTracker } from "@/components/library/project-panel";
import { Journal, ProjectInsights } from "@/components/workspace/journal";
import { StatusPill } from "@/components/library/status-pill";
import { getProject } from "@/lib/library/data";
import { buildSnapshot, workspaceClient } from "@/lib/workspace/server";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({ params }: PageProps<"/projects/[projectId]">) {
  const { projectId } = await params;
  const { project, coverUrl, pattern, photos, sources } = await getProject(projectId);
  const { supabase } = await workspaceClient();
  const snapshot = (await buildSnapshot(supabase, projectId))!;
  const pdf = sources.find((s) => s.kind === "pdf" && s.fileUrl);
  const otherLinks = sources.filter((s) => s.kind === "website" || s.kind === "video");

  return (
    <div className="gutter mx-auto w-full max-w-[72rem]">
      <nav aria-label="Breadcrumb" className="mt-4 md:mt-8">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
          <li>
            <Link href="/patterns" className="font-semibold text-accent hover:underline">
              Pattern Library
            </Link>
          </li>
          {pattern && (
            <li className="flex items-center gap-1">
              <span aria-hidden="true">/</span>
              <Link href={`/patterns/${pattern.id}`} className="font-semibold text-accent hover:underline">
                {pattern.title}
              </Link>
            </li>
          )}
        </ol>
      </nav>

      <header className="tone-midnight surface-midnight mt-3 grid overflow-hidden rounded-panel sm:grid-cols-[12rem_1fr]">
        <div className="aspect-[16/9] sm:aspect-auto sm:min-h-52">
          <CoverArt url={coverUrl} title={project.name} craft={pattern?.craft} priority />
        </div>
        <div className="relative p-6 sm:p-8">
          <div className="tech-grid pointer-events-none absolute inset-0 text-white/[0.04]" />
          <div className="relative flex flex-wrap items-center gap-2">
            <StatusPill status={project.status} />
            {project.size_colorway && <span className="eyebrow">{project.size_colorway}</span>}
          </div>
          <h1 className="relative mt-3 font-display-tight text-[clamp(2rem,5vw,3.2rem)]">{project.name}</h1>
          {pattern && (
            <p className="relative mt-1 text-body">
              From <Link href={`/patterns/${pattern.id}`} className="font-semibold text-strong underline underline-offset-4">{pattern.title}</Link>
              {pattern.designer ? ` by ${pattern.designer}` : ""}
            </p>
          )}
          <div className="relative mt-5 flex flex-wrap gap-3">
            <Link href={`/projects/${project.id}/work`} className="btn btn-primary" data-testid="open-work-mode">
              Open Work Mode
            </Link>
            {pdf?.fileUrl && (
              <a href={pdf.fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                Open pattern PDF
              </a>
            )}
            {otherLinks.slice(0, 2).map((s) => (
              <a key={s.id} href={s.url ?? "#"} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                {s.kind === "video" ? "Watch tutorial" : "Pattern page"}
              </a>
            ))}
          </div>
        </div>
      </header>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-4">
          <ProjectTracker project={project} />
          <ProjectInsights snapshot={snapshot} />
          <Journal snapshot={snapshot} />
        </div>
        <div className="space-y-4">
          <ProjectDetails project={project} />
          <Photos project={project} photos={photos} />
        </div>
      </div>

      <div className="mt-4 border-t border-line pt-4">
        <DeleteProject project={project} />
      </div>
    </div>
  );
}
