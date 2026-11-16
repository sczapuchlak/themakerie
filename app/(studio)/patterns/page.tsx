import type { Metadata } from "next";
import { FolderTiles, InProgress, LibraryMasthead } from "@/components/library/library-landing";
import { getLibraryHome } from "@/lib/library/data";

export const metadata: Metadata = { title: "Pattern Library" };

export default async function PatternLibraryPage() {
  const { folders, allCount, unsortedCount, inProgress } = await getLibraryHome();
  return (
    <div className="gutter mx-auto w-full max-w-[80rem]">
      <LibraryMasthead total={allCount} />
      <InProgress projects={inProgress} />
      <FolderTiles folders={folders} allCount={allCount} unsortedCount={unsortedCount} />
    </div>
  );
}
