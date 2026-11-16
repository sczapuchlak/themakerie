import type { Metadata } from "next";
import { CollectionView } from "@/components/library/collection-view";

export const metadata: Metadata = { title: "Unsorted patterns" };

export default function UnsortedPatternsPage({ searchParams }: PageProps<"/patterns/unsorted">) {
  return <CollectionView scope={{ kind: "unsorted" }} searchParams={searchParams} />;
}
