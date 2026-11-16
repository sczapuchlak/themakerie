/**
 * A tinted orb inscribed with concentric rings — the marker for each studio
 * area. `tint` is any CSS color (usually a section's pastel).
 */
export function ConcentricRings({ tint, className }: { tint: string; className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true" focusable="false">
      <circle cx="20" cy="20" r="19.5" style={{ fill: tint }} />
      <g fill="none" stroke="#050a1f" strokeOpacity="0.32" strokeWidth="1">
        <circle cx="20" cy="20" r="15" />
        <circle cx="20" cy="20" r="10.5" />
        <circle cx="20" cy="20" r="6" />
      </g>
      <circle cx="20" cy="20" r="2" fill="#050a1f" fillOpacity="0.6" />
    </svg>
  );
}
