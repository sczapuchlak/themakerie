import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Workspace } from "@/components/workspace/workspace";
import { buildSnapshot, workspaceClient } from "@/lib/workspace/server";

export const metadata: Metadata = { title: "Work Mode" };

export default async function WorkPage({ params }: PageProps<"/projects/[projectId]/work">) {
  const { projectId } = await params;
  const { supabase } = await workspaceClient();
  const snapshot = await buildSnapshot(supabase, projectId);
  if (!snapshot) notFound();
  return <Workspace initial={snapshot} />;
}
