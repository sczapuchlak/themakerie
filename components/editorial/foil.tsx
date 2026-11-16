import { HeroFoil } from "@/components/art/holo-art";

/**
 * The holographic foil strip from the home hero ("Fig. 01 — Charted motif"),
 * reusable as the chrome edge of a hero panel. Labels sit on midnight chips
 * so they stay legible over the foil.
 */
export function FoilStrip({
  left,
  right,
  className = "",
  sizes = "(min-width: 1024px) 70vw, 100vw",
  slim = false,
}: {
  left?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
  sizes?: string;
  /** A thin decorative sliver with no labels. */
  slim?: boolean;
}) {
  const position = /\b(absolute|fixed|sticky)\b/.test(className) ? "" : "relative";
  return (
    <div
      className={`${position} flex shrink-0 items-center justify-between gap-3 overflow-hidden ${slim ? "h-1.5" : "h-11 px-4"} ${className}`}
      aria-hidden={slim || undefined}
      data-testid="foil-strip"
    >
      <HeroFoil sizes={sizes} />
      {!slim && left && <FoilChip>{left}</FoilChip>}
      {!slim && right && <FoilChip className="hidden sm:inline-block">{right}</FoilChip>}
    </div>
  );
}

function FoilChip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`relative max-w-[70%] truncate rounded-md bg-midnight px-2 py-1 font-mono text-[0.62rem] tracking-[0.14em] text-white uppercase ${className}`}>
      {children}
    </span>
  );
}

/**
 * Editorial section numeral, as on the home page: liquid chrome on midnight,
 * iridescent ink on paper.
 */
export function Numeral({ n, tone = "paper", className = "" }: { n: number; tone?: "paper" | "midnight"; className?: string }) {
  return (
    <span aria-hidden="true" className={`${tone === "midnight" ? "chrome-text" : "iridescent-text"} font-display-tight leading-none ${className}`}>
      {String(n).padStart(2, "0")}
    </span>
  );
}

/** Section heading with a gradient numeral. */
export function NumberedHeading({
  n,
  id,
  children,
  as: Tag = "h2",
  size = "md",
}: {
  n: number;
  id?: string;
  children: React.ReactNode;
  as?: "h2" | "h3";
  size?: "md" | "sm";
}) {
  return (
    <Tag id={id} className={`flex items-baseline gap-3 font-display-tight ${size === "md" ? "text-[clamp(1.6rem,3vw,2rem)]" : "text-[clamp(1.35rem,2.4vw,1.7rem)]"}`}>
      <Numeral n={n} className={size === "md" ? "text-[1.75em]" : "text-[1.6em]"} />
      <span>{children}</span>
    </Tag>
  );
}
