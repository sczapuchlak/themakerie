import type { Metadata } from "next";
import Link from "next/link";
import { KitsView } from "@/components/stash/kits-view";
import { getKits, getPickableStock } from "@/lib/stash/data";

export const metadata: Metadata = { title: "Kits & project bags" };

export default async function KitsPage() {
  const [{ kits, options }, pickable] = await Promise.all([getKits(), getPickableStock()]);
  return (
    <div className="gutter mx-auto w-full max-w-[72rem] pb-10">
      <nav aria-label="Breadcrumb" className="mt-4 text-sm md:mt-8">
        <Link href="/stash" className="font-semibold text-accent hover:underline">
          Stash
        </Link>
      </nav>
      <h1 className="mt-3 font-display-tight text-[clamp(2.1rem,5vw,3rem)]">
        Kits &amp; <span className="font-serif font-normal tracking-normal text-vivid italic">project bags</span>
      </h1>
      <KitsView kits={kits} pickable={pickable} projects={options.projects} locations={options.locations} />
    </div>
  );
}
