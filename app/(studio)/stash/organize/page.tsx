import type { Metadata } from "next";
import Link from "next/link";
import { OrganiseView } from "@/components/stash/organise-view";
import { getOrganisation } from "@/lib/stash/data";

export const metadata: Metadata = { title: "Organise stash" };

export default async function OrganisePage() {
  const { locations, collections } = await getOrganisation();
  return (
    <div className="gutter mx-auto w-full max-w-[72rem] pb-10">
      <nav aria-label="Breadcrumb" className="mt-4 text-sm md:mt-8">
        <Link href="/stash" className="font-semibold text-accent hover:underline">
          Stash
        </Link>
      </nav>
      <h1 className="mt-3 font-display-tight text-[clamp(2.1rem,5vw,3rem)]">
        Places &amp; <span className="font-serif font-normal tracking-normal text-vivid italic">collections</span>
      </h1>
      <OrganiseView locations={locations} collections={collections} />
    </div>
  );
}
