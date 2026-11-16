import type { Metadata } from "next";
import { ShoppingList } from "@/components/stash/shopping-list";
import { StashHeader } from "@/components/stash/stash-header";
import { getStashHome, getWants } from "@/lib/stash/data";

export const metadata: Metadata = { title: "Shopping & wishlist" };

export default async function ShoppingPage({ searchParams }: PageProps<"/stash/shopping">) {
  const list = (await searchParams).list === "wishlist" ? "wishlist" : "shopping";
  const [{ wants, options }, home] = await Promise.all([getWants(), getStashHome()]);
  const counts = { total: home.total, materials: home.materials, tools: home.tools, shopping: home.shoppingOpen, wishlist: home.wishlistOpen };
  return (
    <div className="gutter mx-auto w-full max-w-[64rem] pb-10">
      <StashHeader counts={counts} active={list} />
      <ShoppingList list={list} wants={wants} projects={options.projects} locations={options.locations} />
    </div>
  );
}
