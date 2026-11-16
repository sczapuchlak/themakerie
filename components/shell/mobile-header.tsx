import { Suspense } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { AccountMenu } from "./account-menu";

/** Slim midnight brand bar for phones; the sidebar replaces it from md up. */
export function MobileHeader() {
  return (
    <header className="tone-midnight relative bg-midnight pt-[env(safe-area-inset-top)] md:hidden">
      <div className="gutter flex h-14 items-center justify-between">
        <Wordmark />
        <Suspense fallback={<p className="eyebrow">by Muse</p>}>
          <AccountMenu variant="compact" />
        </Suspense>
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[2px] bg-linear-to-r from-ultraviolet via-pink to-laser"
      />
    </header>
  );
}
