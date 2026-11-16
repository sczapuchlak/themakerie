import type { Metadata } from "next";
import Link from "next/link";
import { ItemGrid, ItemRow } from "@/components/stash/item-card";
import { StashFilters } from "@/components/stash/stash-filters";
import { StashHeader } from "@/components/stash/stash-header";
import { browseStash, getStashHome, parseStashQuery } from "@/lib/stash/data";

export const metadata: Metadata = { title: "Browse stash" };

export default async function BrowseStashPage({ searchParams }: PageProps<"/stash/browse">) {
  const query = parseStashQuery(await searchParams);
  const [{ cards, options }, home] = await Promise.all([browseStash(query), getStashHome()]);
  const counts = { total: home.total, materials: home.materials, tools: home.tools, shopping: home.shoppingOpen, wishlist: home.wishlistOpen };
  return (
    <div className="gutter mx-auto w-full max-w-[80rem] pb-10">
      <StashHeader counts={counts} q={query.q} active={query.view} />
      <div className="mt-6">
        <StashFilters locations={options.locations} collections={options.collections} total={cards.length} />
      </div>
      <div className="mt-5">
        {cards.length === 0 ? (
          <div className="rounded-card border-2 border-dashed border-line px-6 py-10 text-center">
            <p className="font-semibold text-strong">Nothing matches those filters.</p>
            <p className="mt-1 text-sm text-muted">Try fewer filters, or add something new.</p>
            <Link href="/stash/new" className="btn btn-ink press mt-4">
              ＋ Add supply
            </Link>
          </div>
        ) : query.layout === "list" ? (
          <ul className="card-plain divide-y divide-line overflow-hidden rounded-card">
            {cards.map((c) => (
              <li key={c.id}>
                <ItemRow c={c} />
              </li>
            ))}
          </ul>
        ) : (
          <ItemGrid cards={cards} />
        )}
      </div>
    </div>
  );
}
