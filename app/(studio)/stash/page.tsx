import type { Metadata } from "next";
import { ComingSoon } from "@/components/shell/coming-soon";
import { sections } from "@/lib/sections";

export const metadata: Metadata = { title: "Stash" };

export default function StashPage() {
  return <ComingSoon section={sections.stash} />;
}
