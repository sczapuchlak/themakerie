/**
 * Pattern / project cover. Real covers come from short-lived signed URLs
 * (private storage). Without one, a craft-tinted editorial fallback keeps
 * the collection visually varied instead of showing blank blocks.
 */
const TINT: Record<string, string> = {
  knitting: "#ae8aff",
  crochet: "#f477d3",
  "cross-stitch": "#48d7f5",
  needlepoint: "#ffbc91",
};

export function CoverArt({
  url,
  title,
  craft,
  className = "",
  priority = false,
}: {
  url: string | null;
  title: string;
  craft?: string | null;
  className?: string;
  priority?: boolean;
}) {
  if (url) {
    return (
      // Signed private URLs: plain <img> (next/image would need the storage host whitelisted).
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className={`size-full object-cover ${className}`}
      />
    );
  }
  const tint = TINT[craft ?? ""] ?? "#494af4";
  const initial = title.trim().charAt(0).toUpperCase() || "M";
  return (
    <div
      aria-hidden="true"
      className={`relative grid size-full place-items-center overflow-hidden bg-midnight ${className}`}
      style={{
        backgroundImage: `radial-gradient(80% 70% at 85% 10%, ${tint}aa, transparent 70%), radial-gradient(70% 60% at 0% 100%, #494af488, transparent 70%)`,
      }}
    >
      <div className="tech-grid absolute inset-0 text-white/[0.08]" />
      <span className="relative font-serif text-[clamp(3rem,40%,6rem)] leading-none text-white/90 italic">{initial}</span>
    </div>
  );
}

export function craftTint(craft: string | null | undefined) {
  return TINT[craft ?? ""] ?? "#494af4";
}
