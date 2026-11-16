import { Suspense } from "react";

/**
 * Work Mode: full-screen crafting workspace without the studio navigation,
 * leaving the screen to the pattern and its controls. Pages authorize
 * themselves (requireOwner) — this layout holds no private data.
 */
export default function WorkLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="tone-midnight fixed inset-0 grid place-items-center bg-midnight">
          <p className="eyebrow" role="status">
            Opening your workspace…
          </p>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
