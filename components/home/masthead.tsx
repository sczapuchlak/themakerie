import { Starburst } from "@/components/motifs/starburst";
import { crafts } from "@/lib/crafts";

/**
 * Compact editorial masthead — brand presence without a welcome hero.
 * Glass over the foil; opaque enough for small type.
 */
export function Masthead() {
  return (
    <header className="surface-glass mt-4 flex items-center justify-between gap-6 rounded-card px-5 py-3.5 md:mt-8">
      <div className="flex items-baseline gap-3">
        <h1 id="home-title" className="font-display-tight text-[1.75rem] leading-none">
          <span className="mr-[0.15em] font-serif font-normal tracking-normal italic">Your</span>
          studio
        </h1>
        <span className="eyebrow hidden sm:inline">The Makerie</span>
      </div>

      <ul aria-label="Crafts" className="hidden items-center gap-3 xl:flex">
        {crafts.map((craft, i) => (
          <li key={craft.slug} className="flex items-center gap-3">
            {i > 0 && <Starburst className="size-2 text-accent" />}
            <span className="eyebrow text-strong">{craft.name}</span>
          </li>
        ))}
      </ul>

      <p className="hidden font-serif text-lg leading-none text-body italic md:block">
        A little surreal. A little rebellious.
      </p>
    </header>
  );
}
