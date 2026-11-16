import type { Metadata } from "next";
import { FolderTiles, InProgress, LibraryMasthead, RecentShelf } from "@/components/library/library-landing";
import { getLibraryHome } from "@/lib/library/data";

export const metadata: Metadata = { title: "Pattern Library" };

export default async function PatternLibraryPage() {
  const { folders, allCount, unsortedCount, inProgress, recent } = await getLibraryHome();
  return (
    <div className="gutter mx-auto w-full max-w-[80rem]">
      <LibraryMasthead total={allCount} covers={recent} />
      <InProgress projects={inProgress} />
      <RecentShelf patterns={recent} />
      <FolderTiles folders={folders} allCount={allCount} unsortedCount={unsortedCount} />
    </div>
  );
}
