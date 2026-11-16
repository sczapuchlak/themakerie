import Link from "next/link";
import { SectionLabel } from "@/components/editorial/section-label";
import { ConcentricRings } from "@/components/motifs/concentric-rings";
import { OrbitWord } from "@/components/motifs/orbit-word";
import { Starburst } from "@/components/motifs/starburst";
import type { StudioSection } from "@/lib/sections";
import { NavIcon } from "./nav-icon";

/**
 * Placeholder for a studio area that exists in navigation but not yet in
 * product: a paper editorial page with a midnight "coming soon" column.
 */
export function ComingSoon({ section }: { section: StudioSection }) {
  return (
    <div className="gutter mx-auto w-full max-w-[80rem]">
      <section
        aria-labelledby="page-title"
        className="surface-paper mt-4 grid overflow-hidden rounded-panel md:mt-8 lg:grid-cols-12"
      >
        <div className="p-6 sm:p-10 lg:col-span-7 lg:p-12">
          <div className="flex items-center gap-4">
            <span className="relative grid size-14 place-items-center">
              <ConcentricRings tint={section.tint} className="absolute inset-0 size-full" />
              <NavIcon name={section.icon} className="relative size-6 text-midnight" />
            </span>
            <SectionLabel>In the studio</SectionLabel>
          </div>
          <h1 id="page-title" className="mt-8 font-display-tight text-[clamp(3.25rem,10vw,6.5rem)]">
            <OrbitWord>{section.title}</OrbitWord>
          </h1>
          <p className="mt-6 font-serif text-[clamp(1.5rem,3.4vw,2.1rem)] leading-tight italic">
            <span className="iridescent-text pr-1">{section.kicker}</span>
          </p>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-body">{section.description}</p>
          <Link href="/" className="btn btn-secondary mt-8">
            Back to Home
          </Link>
        </div>

        <aside
          aria-labelledby="plans-title"
          className="tone-midnight surface-midnight relative p-6 sm:p-10 lg:col-span-5 lg:p-12"
        >
          <div className="tech-grid pointer-events-none absolute inset-0 text-white/[0.05]" />
          <p id="plans-title" className="eyebrow relative">
            Opening soon
          </p>
          <ol className="relative mt-5 divide-y divide-line">
            {section.plans.map((plan, i) => (
              <li key={plan} className="flex items-start gap-4 py-4 text-strong">
                <span className="font-mono text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex-1">{plan}</span>
                <Starburst className="mt-1 size-3 shrink-0 text-spark" />
              </li>
            ))}
          </ol>
        </aside>
      </section>
    </div>
  );
}
