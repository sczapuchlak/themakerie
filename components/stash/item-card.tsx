import Link from "next/link";
import { describeStock } from "@/lib/stash/catalog";
import type { StashCard } from "@/lib/stash/data";
import { SupplyArt, Swatches } from "./supply-art";

const stock = (c: StashCard) =>
  describeStock(
    {
      full_units: c.full_units ?? 0,
      partial_units: c.partial_units ?? 0,
      has_unknown_partials: Boolean(c.has_unknown_partials),
      loose_mass_dg: c.loose_mass_dg ?? 0,
      loose_length_cm: c.loose_length_cm ?? 0,
      pieces: c.pieces ?? 0,
      reserved_total: c.reserved_total ?? 0,
      quantity_total: c.quantity_total ?? 0,
    },
    c.unit_label ?? "unit",
  );

const subtitle = (c: StashCard) => [c.brand, c.color_code ? `#${c.color_code}` : null, c.color_name].filter(Boolean).join(" · ") || c.category;

/** Boutique card: the material is the star, the facts are quiet. */
export function ItemCard({ c }: { c: StashCard }) {
  const low = c.low_stock_threshold != null && (c.quantity_total ?? 0) - (c.reserved_total ?? 0) <= c.low_stock_threshold;
  return (
    <Link href={`/stash/${c.id}`} className="group block" data-testid="stash-card">
      <div className="card-plain lift relative overflow-hidden rounded-card p-1.5">
        <div className="relative aspect-[4/5] overflow-hidden rounded-[1.1rem]">
          <div className="size-full motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-soft motion-safe:group-hover:scale-[1.04]">
            {c.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.coverUrl} alt="" loading="lazy" className="size-full object-cover" />
            ) : (
              <SupplyArt family={c.family!} colors={c.color_hexes ?? []} />
            )}
          </div>
        </div>
        <div className="absolute top-3.5 right-3.5 left-3.5 flex items-start justify-between gap-2">
          <span className="flex flex-wrap gap-1">
            {(c.reserved_total ?? 0) > 0 && <span className="rounded-full bg-pink px-2 py-0.5 text-[0.65rem] font-semibold text-midnight">Reserved</span>}
            {c.kind === "tool" && (c.active_allocations ?? 0) > 0 && <span className="rounded-full bg-laser px-2 py-0.5 text-[0.65rem] font-semibold text-midnight">In a project</span>}
            {low && <span className="rounded-full bg-peach px-2 py-0.5 text-[0.65rem] font-semibold text-midnight">Low</span>}
          </span>
          {c.favorite && <span className="grid size-7 place-items-center rounded-full bg-white/95 text-xs text-[#c01f97] shadow" aria-label="Favourite">★</span>}
        </div>
      </div>
      <div className="mt-2.5 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 leading-snug font-semibold text-strong [overflow-wrap:anywhere]">{c.name}</h3>
          <p className="truncate text-sm text-muted">{subtitle(c)}</p>
        </div>
        <Swatches colors={c.color_hexes ?? []} />
      </div>
      <p className="mt-1 text-sm font-medium text-body" data-testid="stash-card-stock">
        {c.kind === "tool" ? `${c.quantity_total ?? 0} owned` : stock(c)}
      </p>
      {c.locationNames.length > 0 && <p className="mt-0.5 truncate text-xs text-muted">⌖ {c.locationNames.join(", ")}</p>}
    </Link>
  );
}

export function ItemRow({ c }: { c: StashCard }) {
  return (
    <Link href={`/stash/${c.id}`} className="flex min-h-18 items-center gap-4 px-4 py-3 hover:bg-midnight/[0.03]" data-testid="stash-row">
      <span className="size-12 shrink-0 overflow-hidden rounded-tile">
        {c.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.coverUrl} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <SupplyArt family={c.family!} colors={c.color_hexes ?? []} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-strong">
          {c.name} {c.favorite && <span className="text-[#c01f97]">★</span>}
        </span>
        <span className="block truncate text-sm text-muted">{subtitle(c)}</span>
      </span>
      <span className="hidden min-w-0 shrink-0 text-right text-sm sm:block">
        <span className="block font-medium text-strong">{c.kind === "tool" ? `${c.quantity_total ?? 0} owned` : stock(c)}</span>
        {(c.reserved_total ?? 0) > 0 && <span className="text-xs font-semibold text-[#a3126f]">some reserved</span>}
        {c.locationNames[0] && <span className="block truncate text-xs text-muted">⌖ {c.locationNames[0]}</span>}
      </span>
    </Link>
  );
}

export function ItemGrid({ cards }: { cards: StashCard[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" data-testid="stash-grid">
      {cards.map((c) => (
        <li key={c.id}>
          <ItemCard c={c} />
        </li>
      ))}
    </ul>
  );
}
