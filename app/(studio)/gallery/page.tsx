import type { Metadata } from "next";
import { ComingSoon } from "@/components/shell/coming-soon";
import { requireOwner } from "@/lib/auth/dal";
import { sections } from "@/lib/sections";

export const metadata: Metadata = { title: "Gallery" };

export default async function GalleryPage() {
  await requireOwner();
  return <ComingSoon section={sections.gallery} />;
}
