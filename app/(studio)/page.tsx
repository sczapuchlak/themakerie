import { Collection } from "@/components/home/collection";
import { ContinueCreating } from "@/components/home/continue-creating";
import { Masthead } from "@/components/home/masthead";
import { StudioIndex } from "@/components/home/studio-index";
import { getHome } from "@/lib/library/data";

export default async function Home() {
  const { featured, inProgress, recent } = await getHome();
  const newest = recent[0]?.id ?? null;
  return (
    <div className="gutter mx-auto w-full max-w-[80rem]">
      <Masthead />
      <ContinueCreating featured={featured} newestPatternId={newest} />

      <div className="mt-10 grid gap-6 lg:grid-cols-12 xl:mt-14">
        <div className="lg:col-span-7">
          <Collection
            id="active-projects"
            number="02"
            title="Active projects"
            href="/patterns"
            viewAllLabel="Pattern Library"
            emptyTitle="No active projects yet"
            message="Projects you start appear here with their photo, pattern and progress."
            actionLabel="Start a project"
            actionHref={newest ? `/patterns/${newest}` : "/patterns"}
            variant="projects"
            projects={inProgress}
          />
        </div>
        <div className="lg:col-span-5">
          <Collection
            id="recent-patterns"
            number="03"
            title="Recent patterns"
            href="/patterns"
            viewAllLabel="Library"
            emptyTitle="No patterns yet"
            message="Patterns you add or open recently appear here."
            actionLabel="Add a pattern"
            actionHref="/patterns/new"
            variant="patterns"
            patterns={recent}
          />
        </div>
      </div>

      <StudioIndex />
    </div>
  );
}
