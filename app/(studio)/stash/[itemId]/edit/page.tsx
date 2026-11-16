import type { Metadata } from "next";
import Link from "next/link";
import { ItemEditor } from "@/components/stash/item-editor";
import type { Family } from "@/lib/stash/catalog";
import { getStashItem } from "@/lib/stash/data";

export const metadata: Metadata = { title: "Edit supply" };

const trim = (n: number) => String(Math.round(n * 10) / 10);

export default async function EditSupplyPage({ params }: PageProps<"/stash/[itemId]/edit">) {
  const { itemId } = await params;
  const { item, photos, options } = await getStashItem(itemId);
  return (
    <div className="gutter mx-auto w-full max-w-[64rem]">
      <nav aria-label="Breadcrumb" className="mt-4 text-sm md:mt-8">
        <Link href={`/stash/${item.id}`} className="font-semibold text-accent hover:underline">
          ← {item.name}
        </Link>
      </nav>
      <h1 className="mt-3 font-display-tight text-[clamp(2.1rem,5vw,3rem)]">Edit supply</h1>
      <ItemEditor
        options={options}
        initial={{
          id: item.id!,
          isNew: false,
          family: item.family as Family,
          category: item.category!,
          name: item.name!,
          brand: item.brand ?? "",
          productLine: item.product_line ?? "",
          colorCode: item.color_code ?? "",
          colorName: item.color_name ?? "",
          colorHexes: item.color_hexes ?? [],
          specs: (item.specs ?? {}) as Record<string, string>,
          unitLabel: item.unit_label ?? "unit",
          unitMass: item.unit_mass_dg ? trim(item.unit_mass_dg / 10) : "",
          unitMassUnit: "g",
          unitLength: item.unit_length_cm ? trim(item.unit_length_cm / 100) : "",
          unitLengthUnit: "m",
          lowStock: item.low_stock_threshold != null ? String(item.low_stock_threshold) : "",
          collectionId: item.collection_id ?? "",
          tags: (item.tags ?? []).join(", "),
          favorite: Boolean(item.favorite),
          notes: item.notes ?? "",
          photos: photos.map((p) => ({ id: p.id, url: p.url })),
        }}
      />
    </div>
  );
}
