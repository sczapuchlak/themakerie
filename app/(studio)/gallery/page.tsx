import type { Metadata } from "next";
import { ComingSoon } from "@/components/shell/coming-soon";
import { sections } from "@/lib/sections";

export const metadata: Metadata = { title: "Gallery" };

export default function GalleryPage() {
  return <ComingSoon section={sections.gallery} />;
}
