"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActivePath, primaryNav } from "@/lib/navigation";
import { NavIcon } from "./nav-icon";

type PrimaryNavProps = {
  /**
   * `sidebar` — vertical list in the desktop sidebar (md and up).
   * `tabs` — compact bar docked to the bottom on phones (below md).
   * Only one is visible at a time.
   */
  variant: "sidebar" | "tabs";
};

export function PrimaryNav({ variant }: PrimaryNavProps) {
  const pathname = usePathname();

  if (variant === "sidebar") {
    return (
      <nav aria-label="Primary">
        <ul className="flex flex-col gap-1">
          {primaryNav.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={item.label}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex h-11 items-center gap-3 rounded-tile px-3 text-sm font-medium transition-colors duration-200 sidebar-collapsed:justify-center sidebar-collapsed:px-0 ${
                    active
                      ? "bg-selected text-strong"
                      : "text-body hover:bg-(--control) hover:text-strong"
                  }`}
                >
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-2.5 -left-3 w-[3px] rounded-r-full bg-neon shadow-[0_0_12px_var(--neon-glow)]"
                    />
                  )}
                  <NavIcon
                    name={item.icon}
                    className={`size-5 shrink-0 ${active ? "text-neon" : ""}`}
                  />
                  <span className="truncate sidebar-collapsed:sr-only">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <nav
      aria-label="Primary"
      className="tone-midnight fixed inset-x-0 bottom-0 z-40 border-t border-line bg-midnight pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] backdrop-blur-xl md:hidden"
    >
      <ul className="mx-auto grid h-(--tabbar-height) max-w-lg grid-cols-5">
        {primaryNav.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.href} className="flex">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[0.65rem] font-medium tracking-wide transition-colors duration-200 ${
                  active ? "text-strong" : "text-muted hover:text-strong"
                }`}
              >
                <span
                  className={`grid h-7 w-12 place-items-center rounded-full transition-colors duration-200 ${
                    active ? "bg-neon text-midnight shadow-[0_0_16px_var(--neon-glow)]" : ""
                  }`}
                >
                  <NavIcon name={item.icon} className="size-5" />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
