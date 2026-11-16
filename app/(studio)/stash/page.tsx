import type { Metadata } from "next";
import Link from "next/link";
import { NumberedHeading } from "@/components/editorial/foil";
import { ItemCard, ItemGrid } from "@/components/stash/item-card";
import { StashHeader } from "@/components/stash/stash-header";
import { SupplyArt } from "@/components/stash/supply-art";
import { COLOR_FAMILIES, familyLabel, fromBase } from "@/lib/stash/catalog";
import { getStashHome } from "@/lib/stash/data";

export const metadata: Metadata = { title: "Stash" };

export default async function StashPage() {
  const h = await getStashHome();
  const counts = { total: h.total, materials: h.materials, tools: h.tools, shopping: h.shoppingOpen, wishlist: h.wishlistOpen };
  let n = 0;
  const next = () => ++n;

  return (
    <div className="gutter mx-auto w-full max-w-[80rem] pb-10">
      <StashHeader counts={counts} />

      {h.total === 0 ? (
        <section className="mt-8 grid gap-4 md:grid-cols-[1.2fr_1fr]">
          <div className="holo-border rounded-card bg-white/70 p-6">
            <h2 className="font-display-tight text-2xl">Start your supply studio</h2>
            <p className="mt-2 text-body">Add a yarn, a floss colour, a piece of Aida or your favourite hook. Only a name is needed — add details whenever you like.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {["yarn", "thread", "fabric", "tool"].map((f) => (
                <Link key={f} href={`/stash/new?family=${f}`} className="btn btn-secondary press !min-h-10">
                  ＋ {familyLabel(f)}
                </Link>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2" aria-hidden="true">
            {[
              ["yarn", ["#f477d3", "#ae8aff", "#48d7f5"]],
              ["thread", ["#d63a3a", "#f5d33f", "#3b6fe0"]],
              ["fabric", ["#efe7d7"]],
            ].map(([f, c]) => (
              <div key={f as string} className="aspect-[4/5] overflow-hidden rounded-card opacity-80">
                <SupplyArt family={f as string} colors={c as string[]} />
              </div>
            ))}
          </div>
        </section>
      ) : (
        <>
          {/* Colour shelf — browse by approximate colour family */}
          {h.colors.length > 0 && (
            <section aria-label="Browse by colour" className="mt-8">
              <ul className="no-scrollbar -mx-[var(--gutter)] flex gap-3 overflow-x-auto px-[var(--gutter)] pb-2" data-testid="colour-shelf">
                {h.colors.map(([family, count]) => {
                  const f = COLOR_FAMILIES.find((x) => x.value === family);
                  return (
                    <li key={family}>
                      <Link href={`/stash/browse?color=${family}`} className="press flex shrink-0 flex-col items-center gap-1.5" aria-label={`${f?.label ?? family}: ${count}`}>
                        <span
                          className="size-14 rounded-full shadow-[inset_0_-6px_12px_rgb(0_0_0/0.18),0_10px_20px_-10px_rgb(8_22_56/0.6)] ring-2 ring-white"
                          style={{ background: f?.hex === "conic" ? "conic-gradient(#d63a3a,#f5d33f,#4caf50,#3b6fe0,#8b55d6,#d63a3a)" : f?.hex }}
                        />
                        <span className="text-xs font-semibold text-strong">{f?.label ?? family}</span>
                        <span className="-mt-1 font-mono text-[0.65rem] text-muted">{count}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <div className="mt-8 grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="min-w-0 space-y-12">
              <section aria-labelledby="recent">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <NumberedHeading n={next()} id="recent">
                    Recently <span className="font-serif font-normal tracking-normal text-vivid italic">added</span>
                  </NumberedHeading>
                  <Link href="/stash/browse" className="text-sm font-semibold text-accent hover:underline">
                    Browse everything →
                  </Link>
                </div>
                <div className="mt-5">
                  <ItemGrid cards={h.recent} />
                </div>
              </section>

              {h.reserved.length > 0 && (
                <section aria-labelledby="reserved" data-testid="reserved-section">
                  <NumberedHeading n={next()} id="reserved">
                    Set aside <span className="font-serif font-normal tracking-normal text-vivid italic">for makes</span>
                  </NumberedHeading>
                  <ul className="mt-4 divide-y divide-line overflow-hidden rounded-card card-plain">
                    {h.reserved.slice(0, 12).map((a) => (
                      <li key={a.id}>
                        <Link href={`/stash/${a.item_id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-midnight/[0.03]">
                          <span className="size-11 shrink-0 overflow-hidden rounded-tile">
                            {a.item?.coverUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={a.item.coverUrl} alt="" className="size-full object-cover" />
                            ) : (
                              <SupplyArt family={a.item?.family ?? "other"} colors={a.item?.color_hexes ?? []} />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold text-strong">{a.item?.name}</span>
                            <span className="block truncate text-sm text-muted">for {a.project?.name ?? "a project"}</span>
                          </span>
                          <span className="shrink-0 rounded-full bg-pink/20 px-2.5 py-1 text-xs font-semibold text-[#8a1466]">
                            {a.kind === "tool" ? "Tool in use" : `${a.measure ? fromBase(a.reserved_quantity, a.measure as "count", "unit", a.item?.unit_label ?? "unit") : a.reserved_quantity} reserved`}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {h.favorites.length > 0 && (
                <section aria-labelledby="favourites">
                  <NumberedHeading n={next()} id="favourites">
                    Favourites
                  </NumberedHeading>
                  <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
                    {h.favorites.map((c) => (
                      <li key={c.id}>
                        <ItemCard c={c} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            <aside className="space-y-4">
              {(h.lowStock.length > 0 || h.shoppingOpen > 0) && (
                <section className="rounded-card bg-[#fff6dc] p-5 ring-1 ring-[#c98a00]/30" data-testid="needs">
                  <h2 className="font-semibold text-[#5c4000]">Needs attention</h2>
                  {h.lowStock.length > 0 && (
                    <>
                      <p className="mt-2 text-sm text-[#5c4000]">Running low:</p>
                      <ul className="mt-1 space-y-1">
                        {h.lowStock.slice(0, 5).map((c) => (
                          <li key={c.id}>
                            <Link href={`/stash/${c.id}`} className="text-sm font-semibold text-[#5c4000] underline">
                              {c.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {h.shoppingOpen > 0 && (
                    <Link href="/stash/shopping" className="btn press mt-3 !min-h-10 bg-[#5c4000] text-white">
                      {h.shoppingOpen} on the shopping list →
                    </Link>
                  )}
                </section>
              )}

              <section className="card-plain rounded-card p-5" aria-label="Collection totals" data-testid="totals">
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-xs text-muted">Materials</dt>
                    <dd className="iridescent-text font-display-tight text-[1.8rem] leading-none">{h.materials}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Tools</dt>
                    <dd className="iridescent-text font-display-tight text-[1.8rem] leading-none">{h.tools}</dd>
                  </div>
                  {h.yarn.colourways > 0 && (
                    <div className="col-span-2">
                      <dt className="text-xs text-muted">Yarn with known length</dt>
                      <dd className="font-semibold text-strong">
                        {h.yarn.lengthCm ? `${fromBase(h.yarn.lengthCm, "length", "m")} (${fromBase(h.yarn.lengthCm, "length", "yd")})` : "—"}
                        {h.yarn.skeinsWithoutLength > 0 && (
                          <span className="block text-xs font-normal text-muted">
                            + {h.yarn.skeinsWithoutLength} yarn{h.yarn.skeinsWithoutLength === 1 ? "" : "s"} without a known length or with partial skeins — not guessed.
                          </span>
                        )}
                      </dd>
                    </div>
                  )}
                </dl>
              </section>

              <section className="card-plain rounded-card p-5">
                <h2 className="font-semibold text-strong">Categories</h2>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {h.categories.map((c) => (
                    <li key={`${c.family}${c.category}`}>
                      <Link href={`/stash/browse?family=${c.family}&category=${encodeURIComponent(c.category)}`} className="chip !min-h-9 !text-xs">
                        {c.category} <span className="ml-1 font-mono opacity-60">{c.n}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="card-plain rounded-card p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-strong">Kits & places</h2>
                  <Link href="/stash/organize" className="text-sm font-semibold text-accent hover:underline">
                    Organise
                  </Link>
                </div>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {h.kits.slice(0, 4).map((k) => (
                    <li key={k.id}>
                      <Link href={`/stash/kits#kit-${k.id}`} className="font-semibold text-strong hover:underline">
                        🧺 {k.name}
                      </Link>
                    </li>
                  ))}
                  <li>
                    <Link href="/stash/kits" className="text-accent hover:underline">
                      {h.kits.length ? "All kits →" : "Make a project bag or kit →"}
                    </Link>
                  </li>
                  <li>
                    <Link href="/stash/browse?location=none" className="text-accent hover:underline">
                      Supplies without a place →
                    </Link>
                  </li>
                </ul>
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

