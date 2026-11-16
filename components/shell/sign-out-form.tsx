"use client";

import { signOut } from "@/app/auth/actions";
import { idb } from "@/lib/workspace/idb";
import { clearOfflineData } from "@/lib/workspace/offline";

/**
 * Signing out removes every private offline copy (files, snapshots, saved
 * pages) from this device — but warns first if Work Mode changes haven't
 * synced yet, since those would be lost.
 */
export function SignOutForm({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <form
      className={className}
      action={async () => {
        const pending = (await idb.allOutbox()).length;
        if (
          pending > 0 &&
          !window.confirm(`${pending} change${pending === 1 ? " hasn't" : "s haven't"} synced yet. Signing out now deletes ${pending === 1 ? "it" : "them"} from this device. Sign out anyway?`)
        ) {
          return;
        }
        await clearOfflineData();
        await signOut();
      }}
    >
      {children}
    </form>
  );
}
