import type { Metadata } from "next";
import { OfflineIndex } from "@/components/workspace/offline-index";
import { requireOwner } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Offline projects" };

/** Served by the service worker when a page isn't available offline. */
export default async function OfflinePage() {
  await requireOwner();
  return <OfflineIndex />;
}
