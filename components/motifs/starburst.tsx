/**
 * Starbursts — the Makerie's primary celestial mark.
 *
 *   4 points  a soft, curved spark. Small UI glyph: wordmark, section labels,
 *             list markers.
 *   8 points  a crisp compass burst with long cardinal and short diagonal
 *             rays. Editorial "stamp", used once per composition.
 */

const FOUR =
  "M12 0c.6 6.4 5.6 11.4 12 12-6.4.6-11.4 5.6-12 12-.6-6.4-5.6-11.4-12-12C6.4 11.4 11.4 6.4 12 0Z";

function compassBurst(points: number, rays: readonly number[], inner: number) {
  let d = "";
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI * i) / points - Math.PI / 2;
    const r = i % 2 === 0 ? rays[(i / 2) % rays.length] : inner;
    const x = (12 + r * Math.cos(angle)).toFixed(2);
    const y = (12 + r * Math.sin(angle)).toFixed(2);
    d += `${i === 0 ? "M" : "L"}${x} ${y}`;
  }
  return `${d}Z`;
}

const EIGHT = compassBurst(8, [12, 7.2], 2.4);

type StarburstProps = {
  points?: 4 | 8;
  className?: string;
};

export function Starburst({ points = 4, className }: StarburstProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path fill="currentColor" d={points === 8 ? EIGHT : FOUR} />
    </svg>
  );
}
