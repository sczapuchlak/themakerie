import type { Metadata } from "next";
import { ComingSoon } from "@/components/shell/coming-soon";
import { sections } from "@/lib/sections";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return <ComingSoon section={sections.projects} />;
}
