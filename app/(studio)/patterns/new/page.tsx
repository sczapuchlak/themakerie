import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { PatternEditor } from "@/components/library/pattern-editor";
import { getCrafts, getFolders } from "@/lib/library/data";
import { isUuid, type SourceKind } from "@/lib/library/constants";

export const metadata: Metadata = { title: "Add pattern" };

const CHOICES: { source: SourceKind | "manual"; title: string; hint: string; glyph: string }[] = [
  { source: "pdf", title: "Upload a PDF", hint: "Kept privately, exactly as you add it", glyph: "PDF" },
  { source: "website", title: "Paste a website", hint: "We'll read the title and cover when we can", glyph: "WWW" },
  { source: "image", title: "Upload images", hint: "Charts, photos, scans — from Files or Photos", glyph: "IMG" },
  { source: "video", title: "Add a video", hint: "A tutorial link — nothing is downloaded", glyph: "▶" },
  { source: "manual", title: "Start blank", hint: "Write it yourself; add sources any time", glyph: "✎" },
];

export default async function NewPatternPage({ searchParams }: PageProps<"/patterns/new">) {
  const params = await searchParams;
  const source = typeof params.source === "string" ? params.source : null;
  const folderId = typeof params.folder === "string" && isUuid(params.folder) ? params.folder : null;
  const [folders, crafts] = await Promise.all([getFolders(), getCrafts()]);
  const choice = CHOICES.find((c) => c.source === source);
  const folderQuery = folderId ? `&folder=${folderId}` : "";

  return (
    <div className="gutter mx-auto w-full max-w-[56rem]">
      <nav aria-label="Breadcrumb" className="mt-4 text-sm md:mt-8">
        <Link href="/patterns" className="font-semibold text-accent hover:underline">
          Pattern Library
        </Link>
      </nav>
      <h1 className="mt-3 font-display-tight text-[clamp(2.1rem,5vw,3.2rem)]">
        Add a <span className="font-serif font-normal tracking-normal italic">pattern</span>
      </h1>

      {!choice ? (
        <>
          <p className="mt-2 text-body">Start from wherever the pattern lives. You can attach more sources afterwards.</p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {CHOICES.map((c) => (
              <li key={c.source}>
                <Link
                  href={`/patterns/new?source=${c.source}${folderQuery}`}
                  className="surface-panel flex min-h-20 items-center gap-4 rounded-card p-4 transition-transform duration-200 ease-soft hover:-translate-y-0.5"
                >
                  <span className="tone-midnight surface-midnight grid size-12 shrink-0 place-items-center rounded-tile font-mono text-xs font-bold text-white">
                    {c.glyph}
                  </span>
                  <span>
                    <span className="block font-semibold text-strong">{c.title}</span>
                    <span className="text-sm text-muted">{c.hint}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <PatternEditor
          key={choice.source}
          startWith={choice.source}
          folders={folders}
          crafts={crafts}
          initial={{
            id: randomUUID(),
            isNew: true,
            title: "",
            craft: "",
            folderId,
            designer: "",
            sourceName: "",
            description: "",
            category: "",
            difficulty: null,
            techniques: "",
            materials: "",
            tools: "",
            sizes: "",
            dimensions: "",
            craftDetails: {},
            tags: "",
            notes: "",
            favorite: false,
            coverPath: null,
            coverUrl: null,
            sources: [],
          }}
        />
      )}
    </div>
  );
}
