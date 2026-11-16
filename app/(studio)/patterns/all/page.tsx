import type { Metadata } from "next";
import { CollectionView } from "@/components/library/collection-view";

export const metadata: Metadata = { title: "All Patterns" };

export default function AllPatternsPage({ searchParams }: PageProps<"/patterns/all">) {
  return <CollectionView scope={{ kind: "all" }} searchParams={searchParams} />;
}
