import type { Metadata } from "next";
import Link from "next/link";
import { PatternEditor } from "@/components/library/pattern-editor";
import { getCrafts, getFolders, getPattern } from "@/lib/library/data";

export const metadata: Metadata = { title: "Edit pattern" };

export default async function EditPatternPage({ params }: PageProps<"/patterns/[patternId]/edit">) {
  const { patternId } = await params;
  const [{ pattern: p, coverUrl, sources }, folders, crafts] = await Promise.all([getPattern(patternId), getFolders(), getCrafts()]);

  return (
    <div className="gutter mx-auto w-full max-w-[56rem]">
      <nav aria-label="Breadcrumb" className="mt-4 text-sm md:mt-8">
        <Link href={`/patterns/${p.id}`} className="font-semibold text-accent hover:underline">
          ← {p.title}
        </Link>
      </nav>
      <h1 className="mt-3 font-display-tight text-[clamp(2.1rem,5vw,3.2rem)]">Edit pattern</h1>
      <PatternEditor
        folders={folders}
        crafts={crafts}
        initial={{
          id: p.id,
          isNew: false,
          title: p.title,
          craft: p.craft,
          folderId: p.folder_id,
          designer: p.designer ?? "",
          sourceName: p.source_name ?? "",
          description: p.description ?? "",
          category: p.category ?? "",
          difficulty: p.difficulty,
          techniques: p.techniques.join(", "),
          materials: p.materials ?? "",
          tools: p.tools ?? "",
          sizes: p.sizes ?? "",
          dimensions: p.dimensions ?? "",
          craftDetails: (p.craft_details ?? {}) as Record<string, string>,
          tags: p.tags.join(", "),
          notes: p.notes ?? "",
          favorite: p.favorite,
          coverPath: p.cover_path,
          coverUrl,
          sources: sources.map((s) => ({
            id: s.id,
            kind: s.kind as "pdf" | "image" | "website" | "video",
            title: s.title,
            url: s.url,
            storagePath: s.storage_path,
            fileName: s.file_name,
            mimeType: s.mime_type,
            sizeBytes: s.size_bytes,
            pageCount: s.page_count,
            previewUrl: s.kind === "image" ? s.fileUrl : ((s.metadata as { imageUrl?: string })?.imageUrl ?? null),
          })),
        }}
      />
    </div>
  );
}
