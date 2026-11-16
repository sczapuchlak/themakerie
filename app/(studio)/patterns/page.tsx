import type { Metadata } from "next";
import { FolderTiles, InProgress, LibraryMasthead, RecentShelf } from "@/components/library/library-landing";
import { getLibraryHome } from "@/lib/library/data";

export const metadata: Metadata = { title: "Pattern Library" };

export default async function PatternLibraryPage() {
  const { folders, allCount, unsortedCount, inProgress, recent, previews } = await getLibraryHome();
  return (
    <div className="gutter mx-auto w-full max-w-[80rem] pb-8">
      <LibraryMasthead total={allCount} active={inProgress.length} covers={recent} />
      {/* Folders first: your own organisation sits right under the masthead. */}
      <FolderTiles folders={folders} allCount={allCount} unsortedCount={unsortedCount} previews={previews} />
      <InProgress projects={inProgress} />
      <RecentShelf patterns={recent} />
    </div>
  );
}
