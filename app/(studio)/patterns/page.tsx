import type { Metadata } from "next";
import { ComingSoon } from "@/components/shell/coming-soon";
import { sections } from "@/lib/sections";

export const metadata: Metadata = { title: "Patterns" };

export default function PatternsPage() {
  return <ComingSoon section={sections.patterns} />;
}
