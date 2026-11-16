export type NavItem = {
  href: "/" | "/patterns" | "/projects" | "/stash" | "/gallery";
  label: string;
  icon: "home" | "patterns" | "projects" | "stash" | "gallery";
};

export const primaryNav: readonly NavItem[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/patterns", label: "Patterns", icon: "patterns" },
  { href: "/projects", label: "Projects", icon: "projects" },
  { href: "/stash", label: "Stash", icon: "stash" },
  { href: "/gallery", label: "Gallery", icon: "gallery" },
];

/** localStorage key for the desktop sidebar's collapsed/expanded state. */
export const SIDEBAR_STORAGE_KEY = "makerie:sidebar";

export function isActivePath(pathname: string, href: NavItem["href"]) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
