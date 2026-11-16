import type { Metadata } from "next";
import { PatternReader } from "@/components/workspace/pattern-reader";
import { getPattern } from "@/lib/library/data";
import type { Source } from "@/lib/workspace/model";

export const metadata: Metadata = { title: "Read pattern" };

export default async function ReadPatternPage({ params }: PageProps<"/patterns/[patternId]/read">) {
  const { patternId } = await params;
  const { pattern, sources, projects, coverUrl } = await getPattern(patternId);
  const files: Source[] = sources
    .filter((s) => (s.kind === "pdf" || s.kind === "image") && s.storage_path)
    .map((s) => ({
      id: s.id,
      kind: s.kind as Source["kind"],
      title: s.title,
      url: s.url,
      storage_path: s.storage_path,
      file_name: s.file_name,
      mime_type: s.mime_type,
      size_bytes: s.size_bytes,
      page_count: s.page_count,
      sha256: s.sha256,
      fileUrl: s.fileUrl,
    }));
  const active = projects.filter((p) => p.status === "in_progress").map((p) => ({ id: p.id, name: p.name }));
  return <PatternReader pattern={{ id: pattern.id, title: pattern.title, coverPath: pattern.cover_path }} coverUrl={coverUrl} sources={files} active={active} />;
}
