import { Starburst } from "@/components/motifs/starburst";

/** Mono eyebrow led by a small starburst — the recurring section marker. */
export function SectionLabel({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <p id={id} className="eyebrow flex items-center gap-2">
      <Starburst className="size-2.5 shrink-0 text-spark" />
      {children}
    </p>
  );
}
