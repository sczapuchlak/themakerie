import type { Metadata } from "next";
import { ComingSoon } from "@/components/shell/coming-soon";
import { requireOwner } from "@/lib/auth/dal";
import { sections } from "@/lib/sections";

export const metadata: Metadata = { title: "Stash" };

export default async function StashPage() {
  await requireOwner();
  return <ComingSoon section={sections.stash} />;
}
