import type { Metadata } from "next";
import Link from "next/link";
import { InstructionsEditor } from "@/components/library/instructions-editor";
import { getPattern } from "@/lib/library/data";

export const metadata: Metadata = { title: "Instructions" };

export default async function InstructionsPage({ params }: PageProps<"/patterns/[patternId]/instructions">) {
  const { patternId } = await params;
  const { pattern, sections, sources } = await getPattern(patternId);
  const pdf = sources.find((s) => s.kind === "pdf" && s.fileUrl);

  return (
    <div className="gutter mx-auto w-full max-w-[56rem]">
      <nav aria-label="Breadcrumb" className="mt-4 text-sm md:mt-8">
        <Link href={`/patterns/${pattern.id}`} className="font-semibold text-accent hover:underline">
          ← {pattern.title}
        </Link>
      </nav>
      <h1 className="mt-3 font-display-tight text-[clamp(2.1rem,5vw,3.2rem)]">Instructions</h1>
      <p className="mt-2 max-w-prose text-body">
        Type the sections and steps you want to tick off while you make. Your original pattern
        {pdf ? " PDF" : ""} is never changed — this is your own working copy.
        {pdf?.fileUrl && (
          <>
            {" "}
            <a href={pdf.fileUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent underline underline-offset-4">
              Open the PDF
            </a>{" "}
            alongside.
          </>
        )}
      </p>
      <InstructionsEditor patternId={pattern.id} initial={sections} />
    </div>
  );
}
