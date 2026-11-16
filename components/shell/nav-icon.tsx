import type { NavItem } from "@/lib/navigation";

const paths: Record<NavItem["icon"], React.ReactNode> = {
  home: <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1Z" />,
  patterns: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
      <path d="M4 9.5h16M4 14.5h16M9.5 4v16M14.5 4v16" />
    </>
  ),
  projects: (
    <>
      <path d="M5.5 20 18 5.5M18.5 20 6 5.5" />
      <circle cx="18.6" cy="4.8" r="1.4" />
      <circle cx="5.4" cy="4.8" r="1.4" />
    </>
  ),
  stash: (
    <>
      <circle cx="11.5" cy="11.5" r="7.5" />
      <path d="M5.2 7.6c4.2.4 9 4.3 10.7 9.9M8.6 4.6c3.6 1.8 7 6.4 7.6 11.6M4.1 12.6c3.4-.3 7.4 1.9 9.6 6.1M17 17l3.5 3" />
    </>
  ),
  gallery: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
      <path d="m6.5 16 3.6-4 2.9 3 2-2 2.5 3" />
      <path d="M15.5 7.5v3M14 9h3" />
    </>
  ),
};

export function NavIcon({ name, className }: { name: NavItem["icon"]; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
