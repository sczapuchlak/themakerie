import type { NavItem } from "./navigation";

/**
 * The four studio areas behind the primary navigation. Static product copy
 * shared by the Home overview and each section's placeholder page.
 * Each area owns a single pastel tint.
 */
export type SectionSlug = "patterns" | "stash" | "gallery";

export type StudioSection = {
  slug: SectionSlug;
  href: Exclude<NavItem["href"], "/">;
  icon: Exclude<NavItem["icon"], "home">;
  title: string;
  kicker: string;
  summary: string;
  description: string;
  plans: readonly string[];
  /** CSS color used for this section's icon chip and motif. */
  tint: string;
};

export const sections: Record<SectionSlug, StudioSection> = {
  patterns: {
    slug: "patterns",
    href: "/patterns",
    icon: "patterns",
    title: "Patterns",
    kicker: "Your library of possibility.",
    summary: "PDFs, charts and images, organized by craft.",
    description:
      "A home for every pattern you own or dream about — PDFs, charts and images, organized by craft and ready to open in a focused reader.",
    plans: ["Pattern library by craft", "Interactive PDF & chart reader", "Row highlighters and notes"],
    tint: "var(--color-ultraviolet)",
  },
  stash: {
    slug: "stash",
    href: "/stash",
    icon: "stash",
    title: "Stash",
    kicker: "Every color you’ve collected.",
    summary: "Yarn, floss, canvas and tools.",
    description:
      "Yarn, floss, canvas and tools — catalogued, searchable and linked to the projects that use them.",
    plans: ["Yarn, floss and canvas inventory", "Tools and notions", "Materials linked to projects"],
    tint: "var(--color-peach)",
  },
  gallery: {
    slug: "gallery",
    href: "/gallery",
    icon: "gallery",
    title: "Gallery",
    kicker: "Finished, and fabulous.",
    summary: "Everything you’ve made, in the spotlight.",
    description:
      "An image-led archive of everything you’ve made — the spotlight every finished piece deserves.",
    plans: ["Finished-project gallery", "Photos, notes and pattern credits", "Collections by craft or year"],
    tint: "var(--color-laser)",
  },
};
