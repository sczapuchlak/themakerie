import Link from "next/link";
import { ViewTransition } from "react";
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
    <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {rows.map((p, i) => {
        const activity = activitySummary(p);
        return (
          <li key={p.id}>
            <Link href={`/patterns/${p.id}`} className="group block rounded-card focus-visible:outline-offset-4">
              <div className="card-plain lift relative overflow-hidden rounded-card p-1.5">
                <ViewTransition name={`cover-${p.id}`} share="morph" default="none">
                  <div className="relative aspect-[3/4] overflow-hidden rounded-[1.1rem]">
                    <div className="size-full motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-soft motion-safe:group-hover:scale-[1.03]">
                      <CoverArt url={p.coverUrl} title={p.title} craft={p.craft} priority={i < 4} />
                    </div>
                  </div>
                </ViewTransition>
                {p.favorite && (
                  <span className="absolute top-3.5 right-3.5 grid size-8 place-items-center rounded-full bg-white/95 text-sm text-[#c01f97] shadow" aria-label="Favourite">
                    ★
                  </span>
                )}
                {activity && (
                  <span className="absolute bottom-3.5 left-3.5 max-w-[calc(100%-1.75rem)] truncate rounded-full bg-midnight/90 px-2.5 py-1 text-[0.7rem] font-semibold text-white">
                    {activity}
                  </span>
                )}
              </div>
              <h3 className="mt-3 line-clamp-2 font-semibold leading-snug text-strong [overflow-wrap:anywhere]">{p.title}</h3>
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
    <ul className="card-plain mt-5 divide-y divide-line overflow-hidden rounded-card">
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
