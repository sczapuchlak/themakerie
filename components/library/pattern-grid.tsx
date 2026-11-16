import Link from "next/link";
import { difficultyLabel } from "@/lib/library/constants";
import type { PatternCard } from "@/lib/library/data";
import { CoverArt } from "./cover-art";

const craftName = (slug: string, crafts: Map<string, string>) => crafts.get(slug) ?? slug;

function activitySummary(p: PatternCard) {
  const parts: string[] = [];
  if (p.finished_count) parts.push(`${p.finished_count} finished`);
  if (p.active_count) parts.push(`${p.active_count} active`);
  const other = (p.project_count ?? 0) - (p.finished_count ?? 0) - (p.active_count ?? 0);
  if (other > 0) parts.push(`${other} other`);
  return parts.join(" · ");
}

/** One card per PATTERN, however many projects it has. */
export function PatternGallery({ rows, crafts }: { rows: PatternCard[]; crafts: Map<string, string> }) {
  return (
    <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
      {rows.map((p, i) => {
        const activity = activitySummary(p);
        return (
          <li key={p.id}>
            <Link href={`/patterns/${p.id}`} className="group block rounded-card focus-visible:outline-offset-4">
              <div className="relative aspect-[4/5] overflow-hidden rounded-card shadow-[0_18px_36px_-22px_rgb(8_22_56/0.6)] transition-transform duration-300 ease-soft group-hover:-translate-y-1 group-active:translate-y-0">
                <CoverArt url={p.coverUrl} title={p.title} craft={p.craft} priority={i < 4} />
                {p.favorite && (
                  <span className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-midnight/85 text-neon" aria-label="Favorite">
                    ★
                  </span>
                )}
                {activity && (
                  <span className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-midnight/85 px-2.5 py-1 text-[0.7rem] font-semibold text-white">
                    {activity}
                  </span>
                )}
              </div>
              <h3 className="mt-3 line-clamp-2 font-semibold leading-snug text-strong">{p.title}</h3>
              <p className="mt-0.5 truncate text-sm text-muted">
                {craftName(p.craft, crafts)}
                {p.designer ? ` · ${p.designer}` : ""}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function PatternList({ rows, crafts }: { rows: PatternCard[]; crafts: Map<string, string> }) {
  return (
    <ul className="surface-panel mt-5 divide-y divide-line overflow-hidden rounded-card">
      {rows.map((p) => {
        const activity = activitySummary(p);
        const difficulty = difficultyLabel(p.difficulty);
        return (
          <li key={p.id}>
            <Link href={`/patterns/${p.id}`} className="flex min-h-18 items-center gap-4 px-4 py-3 hover:bg-midnight/[0.03]">
              <div className="aspect-[4/5] w-12 shrink-0 overflow-hidden rounded-lg">
                <CoverArt url={p.coverUrl} title={p.title} craft={p.craft} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-strong">
                  {p.favorite && <span className="mr-1 text-[#6a8f00]" aria-label="Favorite">★</span>}
                  {p.title}
                </p>
                <p className="truncate text-sm text-muted">
                  {craftName(p.craft, crafts)}
                  {p.designer ? ` · ${p.designer}` : ""}
                  {difficulty ? ` · ${difficulty}` : ""}
                </p>
              </div>
              {activity && <span className="hidden shrink-0 text-xs font-semibold text-body sm:block">{activity}</span>}
              <span className="hidden shrink-0 font-mono text-xs text-muted md:block">
                {new Date(p.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
