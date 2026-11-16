"use client";

import { useLayoutEffect, useRef } from "react";
import { SIDEBAR_STORAGE_KEY } from "@/lib/navigation";

/**
 * Collapses the desktop sidebar to an icon rail. State lives on
 * <html data-sidebar>, restored before paint by the root layout's inline
 * script, so this component keeps no React state and never mismatches the
 * server-rendered HTML.
 */
export function SidebarToggle() {
  const button = useRef<HTMLButtonElement>(null);

  // Re-apply the stored state (development Strict Mode remounts reset <html>
  // attributes) and sync aria-expanded with it.
  useLayoutEffect(() => {
    let collapsed = false;
    try {
      collapsed = localStorage.getItem(SIDEBAR_STORAGE_KEY) === "collapsed";
    } catch {}
    document.documentElement.setAttribute("data-sidebar", collapsed ? "collapsed" : "expanded");
    button.current?.setAttribute("aria-expanded", String(!collapsed));
  }, []);

  function toggle() {
    const root = document.documentElement;
    const collapsed = root.getAttribute("data-sidebar") !== "collapsed";
    root.setAttribute("data-sidebar", collapsed ? "collapsed" : "expanded");
    button.current?.setAttribute("aria-expanded", String(!collapsed));
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "collapsed" : "expanded");
    } catch {}
  }

  return (
    <button
      ref={button}
      type="button"
      onClick={toggle}
      aria-controls="app-sidebar"
      aria-expanded="true"
      className="flex h-11 w-full items-center gap-3 rounded-tile px-3 text-sm font-medium text-muted transition-colors duration-200 hover:bg-(--control) hover:text-strong sidebar-collapsed:justify-center sidebar-collapsed:px-0"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-5 shrink-0 transition-transform duration-300 sidebar-collapsed:rotate-180"
        aria-hidden="true"
      >
        <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
        <path d="M9 4.5v15M15.5 10l-2 2 2 2" />
      </svg>
      <span className="sidebar-collapsed:hidden">Collapse sidebar</span>
      <span className="sr-only hidden sidebar-collapsed:inline">Expand sidebar</span>
    </button>
  );
}
