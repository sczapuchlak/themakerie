import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { ItemEditor } from "@/components/stash/item-editor";
import { CATEGORIES, FAMILIES, UNIT_LABELS, type Family } from "@/lib/stash/catalog";
import { getStashOptions } from "@/lib/stash/data";

export const metadata: Metadata = { title: "Add supply" };

export default async function NewSupplyPage({ searchParams }: PageProps<"/stash/new">) {
  const params = await searchParams;
  const famParam = typeof params.family === "string" ? params.family : null;
  const family = FAMILIES.some((f) => f.value === famParam) ? (famParam as Family) : null;
  const options = await getStashOptions();
  return (
    <div className="gutter mx-auto w-full max-w-[64rem]">
      <nav aria-label="Breadcrumb" className="mt-4 text-sm md:mt-8">
        <Link href="/stash" className="font-semibold text-accent hover:underline">
          Stash
        </Link>
      </nav>
      <h1 className="mt-3 font-display-tight text-[clamp(2.1rem,5vw,3rem)]">
        Add a <span className="font-serif font-normal tracking-normal text-vivid italic">supply</span>
      </h1>
      <ItemEditor
        options={options}
        initial={{
          id: randomUUID(),
          isNew: true,
          family,
          category: family ? CATEGORIES[family][0] : "",
          name: "",
          brand: "",
          productLine: "",
          colorCode: "",
          colorName: "",
          colorHexes: family && family !== "tool" ? ["#ae8aff"] : [],
          specs: {},
          unitLabel: family ? UNIT_LABELS[family][0] : "unit",
          unitMass: "",
          unitMassUnit: "g",
          unitLength: "",
          unitLengthUnit: "m",
          lowStock: "",
          collectionId: "",
          tags: "",
          favorite: false,
          notes: "",
          photos: [],
        }}
      />
    </div>
  );
}
