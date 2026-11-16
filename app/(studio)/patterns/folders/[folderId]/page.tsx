import type { Metadata } from "next";
import { CollectionView } from "@/components/library/collection-view";

export const metadata: Metadata = { title: "Folder" };

export default async function FolderPage({ params, searchParams }: PageProps<"/patterns/folders/[folderId]">) {
  const { folderId } = await params;
  return <CollectionView scope={{ kind: "folder", id: folderId }} searchParams={searchParams} />;
}
