import { Wordmark } from "@/components/brand/wordmark";
import { PrimaryNav } from "./primary-nav";
import { SidebarToggle } from "./sidebar-toggle";

/**
 * Desktop sidebar (md and up) — the midnight structural anchor. A spectrum
 * sliver runs down its edge to tie it into the canvas. Sticky,
 * full height, collapsible to an icon rail for future crafting screens.
 */
export function Sidebar() {
  return (
    <aside
      id="app-sidebar"
      className="tone-midnight surface-midnight sticky top-0 hidden h-dvh flex-col overflow-hidden px-3 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] md:flex"
    >
      {/* Holographic edge */}
      <div aria-hidden="true" className="holo-spectrum absolute inset-y-0 right-0 w-[3px]" />

      {/* Fine orbital linework anchoring the brand */}
      <svg
        viewBox="0 0 200 200"
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-20 size-64 text-laser opacity-30 sidebar-collapsed:opacity-0"
      >
        <g fill="none" stroke="currentColor" strokeWidth="0.7">
          <circle cx="100" cy="100" r="38" />
          <circle cx="100" cy="100" r="60" />
          <ellipse cx="100" cy="100" rx="96" ry="30" transform="rotate(-24 100 100)" />
        </g>
      </svg>

      <div className="relative flex h-12 items-center px-2 sidebar-collapsed:justify-center sidebar-collapsed:px-0">
        <Wordmark collapsible />
      </div>

      <p className="eyebrow relative mt-8 px-3 sidebar-collapsed:sr-only">Studio</p>
      <div className="relative mt-3">
        <PrimaryNav variant="sidebar" />
      </div>

      <div className="relative mt-auto flex flex-col gap-3">
        <p className="eyebrow px-3 leading-relaxed sidebar-collapsed:hidden">
          A creative world
          <br />
          by Muse
        </p>
        <SidebarToggle />
      </div>
    </aside>
  );
}
