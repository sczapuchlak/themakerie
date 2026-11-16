import type { Metadata } from "next";
import Link from "next/link";
import { ItemFavorite, ItemManage, StockPanel } from "@/components/stash/stock-panel";
import { SupplyArt, Swatches } from "@/components/stash/supply-art";
import { LocalTime } from "@/components/ui/local-time";
import { describeStock, familyLabel, fromBase, SPEC_FIELDS, totalLengthCm, totalMassDg, type Family, type Measure } from "@/lib/stash/catalog";
import { getStashItem } from "@/lib/stash/data";

export const metadata: Metadata = { title: "Supply" };

const KIND_LABEL: Record<string, string> = {
  add: "Added",
  use: "Used",
  return: "Leftover returned",
  adjust: "Corrected",
  remove: "Removed",
  reserve: "Reserved",
  release: "Released",
  tool_assign: "Assigned to project",
  tool_return: "Unassigned",
};

export default async function SupplyPage({ params }: PageProps<"/stash/[itemId]">) {
  const { itemId } = await params;
  const { item, coverUrl, photos, lots, movements, allocations, kits, options } = await getStashItem(itemId);
  const unit = item.unit_label ?? "unit";
  const summary = {
    full_units: item.full_units ?? 0,
    partial_units: item.partial_units ?? 0,
    has_unknown_partials: Boolean(item.has_unknown_partials),
    loose_mass_dg: item.loose_mass_dg ?? 0,
    loose_length_cm: item.loose_length_cm ?? 0,
    pieces: item.pieces ?? 0,
    reserved_total: item.reserved_total ?? 0,
    quantity_total: item.quantity_total ?? 0,
  };
  const len = totalLengthCm(summary, item.unit_length_cm);
  const mass = totalMassDg(summary, item.unit_mass_dg);
  const specs = SPEC_FIELDS[item.family as Family]
    .map((f) => [f.label, ((item.specs ?? {}) as Record<string, string>)[f.key]] as const)
    .filter(([, v]) => v);
  const activeAllocations = allocations.filter((a) => a.status === "planned" || a.status === "active");

  return (
    <div className="gutter mx-auto w-full max-w-[72rem] pb-10">
      <nav aria-label="Breadcrumb" className="mt-4 md:mt-8">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
          <li>
            <Link href="/stash" className="font-semibold text-accent hover:underline">
              Stash
            </Link>
          </li>
          <li className="flex items-center gap-1">
            <span aria-hidden="true">/</span>
            <Link href={`/stash/browse?family=${item.family}`} className="font-semibold text-accent hover:underline">
              {familyLabel(item.family!)}
            </Link>
          </li>
        </ol>
      </nav>

      <header className="tone-midnight relative isolate mt-3 overflow-hidden rounded-panel bg-midnight" data-testid="supply-hero">
        {/* Signature: the supply's own colours, not the shared foil. */}
        {(item.color_hexes ?? []).slice(0, 3).map((c, i) => (
          <div
            key={`${c}${i}`}
            aria-hidden="true"
            className="pointer-events-none absolute -z-10 size-80 rounded-full opacity-45 blur-[90px]"
            style={{ background: c, top: ["-30%", "40%", "-10%"][i], right: ["-8%", "20%", "40%"][i] }}
          />
        ))}
        <div className="grid sm:grid-cols-[minmax(0,15rem)_1fr]">
          <div className="aspect-[4/3] sm:aspect-auto sm:min-h-[17rem]">
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverUrl} alt={item.name ?? ""} className="size-full object-cover" />
            ) : (
              <SupplyArt family={item.family!} colors={item.color_hexes ?? []} />
            )}
          </div>
          <div className="relative min-w-0 p-5 sm:p-7">
            <div className="absolute top-4 right-4 flex gap-2">
              <ItemFavorite id={item.id!} favorite={Boolean(item.favorite)} />
              <Link href={`/stash/${item.id}/edit`} className="press grid size-11 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/20" aria-label="Edit supply">
                <svg viewBox="0 0 20 20" className="size-[1.1rem]" aria-hidden="true">
                  <path d="M13.6 3.2a2 2 0 0 1 2.8 2.8l-8.6 8.6-3.6.8.8-3.6Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
            <p className="text-xs font-semibold tracking-[0.16em] text-white/60 uppercase">
              {familyLabel(item.family!)}
              {item.category && item.category.toLowerCase() !== familyLabel(item.family!).toLowerCase() ? ` · ${item.category}` : ""}
              {item.archived_at ? " · Archived" : ""}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 pr-24">
              {item.color_code && <span className="rounded-md bg-white px-2 py-0.5 font-mono text-sm font-semibold text-midnight" data-testid="supply-code">#{item.color_code}</span>}
              <Swatches colors={item.color_hexes ?? []} size="md" />
            </div>
            <h1 className="mt-3 pr-24 font-display-tight text-[clamp(1.9rem,4.2vw,2.9rem)] leading-[1.02] text-white [overflow-wrap:anywhere]">{item.name}</h1>
            <p className="mt-1.5 text-white/75">{[item.brand, item.product_line, item.color_name].filter(Boolean).join(" · ") || item.category}</p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold tracking-[0.14em] text-white/60 uppercase">{item.kind === "tool" ? "Owned" : "In stock"}</p>
                <p className="chrome-text mt-1 font-display-tight text-[1.6rem] leading-tight" data-testid="supply-stock">
                  {item.kind === "tool" ? `${summary.quantity_total}` : describeStock(summary, unit)}
                </p>
                {item.kind !== "tool" && (len || mass) && (
                  <p className="mt-1 text-sm text-white/70">
                    {len && len.cm > 0 ? `${len.exact ? "" : "at least "}${fromBase(len.cm, "length", "m")} (${fromBase(len.cm, "length", "yd")})` : ""}
                    {len && len.cm > 0 && mass && mass.dg > 0 ? " · " : ""}
                    {mass && mass.dg > 0 ? `${mass.exact ? "" : "at least "}${fromBase(mass.dg, "mass", "g")}` : ""}
                  </p>
                )}
              </div>
              {summary.reserved_total > 0 && (
                <div>
                  <p className="text-xs font-semibold tracking-[0.14em] text-white/60 uppercase">Reserved</p>
                  <p className="mt-1 text-lg font-semibold text-pink" data-testid="supply-reserved">
                    {activeAllocations.length} project{activeAllocations.length === 1 ? "" : "s"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-10">
          <StockPanel
            itemId={item.id!}
            kind={item.kind!}
            family={item.family!}
            unitLabel={unit}
            lots={lots}
            locations={options.locations}
            projects={options.projects}
          />

          {photos.length > 1 && (
            <section aria-label="Photos">
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {photos.map((p) => (
                  <li key={p.id} className="aspect-square overflow-hidden rounded-tile">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.url && <img src={p.url} alt="" loading="lazy" className="size-full object-cover" />}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="history-title">
            <h2 id="history-title" className="font-display-tight text-[clamp(1.4rem,2.6vw,1.75rem)]">
              History
            </h2>
            {movements.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No changes yet.</p>
            ) : (
              <ol className="mt-3 divide-y divide-line overflow-hidden rounded-card card-plain" data-testid="history">
                {movements.map((m) => {
                  const q = m.delta_quantity !== 0 ? m.delta_quantity : m.delta_reserved;
                  const amount = m.measure && q ? fromBase(Math.abs(q), m.measure as Measure, m.measure === "length" ? "m" : "g", unit) : "";
                  return (
                    <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm">
                      <LocalTime iso={m.created_at} preset="shortDate" className="w-14 shrink-0 font-mono text-xs text-muted" />
                      <span className="font-semibold text-strong">{KIND_LABEL[m.kind] ?? m.kind}</span>
                      {amount && <span className="text-body">{amount}</span>}
                      {m.project && (
                        <Link href={`/projects/${m.project.id}`} className="text-accent hover:underline">
                          {m.project.name}
                        </Link>
                      )}
                      {m.note && <span className="w-full pl-[4.25rem] text-muted">{m.note}</span>}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          {specs.length > 0 && (
            <section className="card-plain rounded-card p-5" aria-label="Details">
              <dl className="divide-y divide-line text-sm">
                {specs.map(([k, v]) => (
                  <div key={k} className="flex gap-4 py-2">
                    <dt className="w-28 shrink-0 text-muted">{k}</dt>
                    <dd className="min-w-0 text-strong">{v}</dd>
                  </div>
                ))}
                {item.unit_mass_dg || item.unit_length_cm ? (
                  <div className="flex gap-4 py-2">
                    <dt className="w-28 shrink-0 text-muted">Per {unit}</dt>
                    <dd className="text-strong">
                      {[item.unit_mass_dg ? fromBase(item.unit_mass_dg, "mass", "g") : null, item.unit_length_cm ? `${fromBase(item.unit_length_cm, "length", "m")} / ${fromBase(item.unit_length_cm, "length", "yd")}` : null].filter(Boolean).join(" · ")}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </section>
          )}

          <section className="card-plain rounded-card p-5" data-testid="used-in">
            <h2 className="font-semibold text-strong">Used in projects</h2>
            {allocations.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Not linked to a project yet.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {allocations.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2">
                    <Link href={`/projects/${a.project?.id}`} className="font-semibold text-strong hover:underline">
                      {a.project?.name}
                    </Link>
                    <span className="text-muted">
                      {a.kind === "tool"
                        ? a.status === "done" || a.status === "returned"
                          ? "returned"
                          : "in use"
                        : [a.reserved_quantity ? `${fromBase(a.reserved_quantity, (a.measure ?? "count") as Measure, "g", unit)} reserved` : null, a.used_quantity ? `${fromBase(a.used_quantity, (a.measure ?? "count") as Measure, "g", unit)} used` : null]
                            .filter(Boolean)
                            .join(" · ") || "planned"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {kits.length > 0 && (
            <section className="card-plain rounded-card p-5">
              <h2 className="font-semibold text-strong">In kits</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {kits.map((k) => (
                  <li key={k.id}>
                    <Link href={`/stash/kits#kit-${k.kit?.id}`} className="font-semibold text-accent hover:underline">
                      🧺 {k.kit?.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(item.tags?.length || item.notes) && (
            <section className="card-plain rounded-card p-5">
              {item.tags && item.tags.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {item.tags.map((t) => (
                    <li key={t} className="rounded-full bg-selected px-2.5 py-1 text-xs font-semibold text-strong">
                      #{t}
                    </li>
                  ))}
                </ul>
              )}
              {item.notes && <p className="mt-3 text-sm whitespace-pre-wrap text-body">{item.notes}</p>}
            </section>
          )}
        </aside>
      </div>

      <div className="mt-12 border-t border-line pt-5">
        <ItemManage id={item.id!} archived={Boolean(item.archived_at)} usedByProjects={allocations.length > 0} />
      </div>
    </div>
  );
}
