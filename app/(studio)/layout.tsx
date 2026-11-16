import { MobileHeader } from "@/components/shell/mobile-header";
import { PrimaryNav } from "@/components/shell/primary-nav";
import { Sidebar } from "@/components/shell/sidebar";

/**
 * App shell for the browsable studio areas.
 *   md and up — collapsible left sidebar + content column.
 *   below md  — slim header + compact tab bar docked to the bottom.
 *
 * A future crafting workspace (reader, counters, timer) should live in its
 * own route group so it can drop the tab bar entirely and keep the sidebar
 * collapsed, leaving the screen to the pattern and its controls.
 */
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="sidebar-transition flex flex-1 flex-col md:grid md:grid-cols-[var(--sidebar-w)_minmax(0,1fr)]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader />
        <main
          id="main"
          className="flex-1 pb-[calc(var(--tabbar-height)+env(safe-area-inset-bottom)+1.5rem)] md:pb-12"
        >
          {children}
        </main>
      </div>
      <PrimaryNav variant="tabs" />
    </div>
  );
}
