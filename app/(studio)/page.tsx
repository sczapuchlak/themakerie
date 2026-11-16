import { Collection } from "@/components/home/collection";
import { ContinueCreating } from "@/components/home/continue-creating";
import { Masthead } from "@/components/home/masthead";
import { StudioIndex } from "@/components/home/studio-index";
import { requireOwner } from "@/lib/auth/dal";

export default async function Home() {
  await requireOwner();
  return (
    <div className="gutter mx-auto w-full max-w-[80rem]">
      <Masthead />
      <ContinueCreating />

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
            variant="projects"
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
            variant="patterns"
          />
        </div>
      </div>

      <StudioIndex />
    </div>
  );
}
