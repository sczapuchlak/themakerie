import Link from "next/link";
import { ConcentricRings } from "@/components/motifs/concentric-rings";
import { NavIcon } from "@/components/shell/nav-icon";
import { sections, type StudioSection } from "@/lib/sections";

/** Tertiary destinations — a compact editorial index bar, not ad cards. */
export function StudioIndex() {
  return (
    <nav
      aria-label="More of the studio"
      className="surface-panel mt-8 grid overflow-hidden rounded-card lg:grid-cols-2"
    >
      <Row number="04" section={sections.stash} />
      <Row number="05" section={sections.gallery} className="border-t border-line lg:border-t-0 lg:border-l" />
    </nav>
  );
}

function Row({
  number,
  section,
  className,
}: {
  number: string;
  section: StudioSection;
  className?: string;
}) {
  return (
    <Link
      href={section.href}
      className={`group flex min-h-20 items-center gap-4 px-5 py-4 transition-colors duration-200 hover:bg-midnight/[0.03] ${className ?? ""}`}
    >
      <span aria-hidden="true" className="font-mono text-[0.7rem] text-muted">
        {number}
      </span>
      <span className="relative grid size-11 shrink-0 place-items-center">
        <ConcentricRings
          tint={section.tint}
          className="absolute inset-0 size-full transition-transform duration-500 ease-soft group-hover:rotate-45"
        />
        <NavIcon name={section.icon} className="relative size-5 text-midnight" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display-tight text-[1.5rem] text-strong">{section.title}</span>
        <span className="mt-0.5 block text-sm leading-snug text-muted">{section.summary}</span>
      </span>
      <span
        aria-hidden="true"
        className="grid size-9 shrink-0 place-items-center rounded-full bg-midnight text-white transition-colors duration-200 group-hover:bg-neon group-hover:text-midnight"
      >
        →
      </span>
    </Link>
  );
}
