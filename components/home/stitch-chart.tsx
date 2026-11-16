/**
 * A charted colourwork motif drawn the way real knitting and cross-stitch
 * charts are: one square per stitch, heavier rules every five stitches, row
 * numbers on the right (charts are read right to left, bottom to top), a
 * colour key — and a neon row highlighter, the Makerie reader's signature
 * tool. Decorative illustration of the product, not user data.
 * Server-rendered SVG; no client JS.
 */

const COLS = 23;
const ROWS = 15;
const CELL = 10;
const GUTTER = 22; // room for row numbers / column numbers
const HIGHLIGHT_ROW = 5; // 0-based from the top

export const chartKey = [
  { name: "Solar peach", color: "#ffbc91" },
  { name: "Holo pink", color: "#f477d3" },
  { name: "Ultraviolet", color: "#ae8aff" },
  { name: "Laser blue", color: "#48d7f5" },
  { name: "Aqua", color: "#8ef0d3" },
] as const;

function cellColor(col: number, row: number): string | null {
  // Seed-stitch border rows in aqua
  if (row === 0 || row === ROWS - 1) return (col + row) % 2 === 0 ? chartKey[4].color : null;
  const dx = col - Math.floor(COLS / 2);
  const dy = row - Math.floor(ROWS / 2);
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const inStar =
    ax + ay <= 3 ||
    (dy === 0 && ax <= 9) ||
    (dx === 0 && ay <= 5) ||
    (ax === ay && ax <= 4) ||
    (ax <= 1 && ay <= 2) ||
    (ay <= 1 && ax <= 4);
  if (!inStar) return null;
  const ring = Math.max(ax, ay);
  if (ring <= 1) return chartKey[0].color;
  if (ring <= 3) return chartKey[1].color;
  if (ring <= 6) return chartKey[2].color;
  return chartKey[3].color;
}

export function StitchChart({ className }: { className?: string }) {
  const width = COLS * CELL + GUTTER;
  const height = ROWS * CELL + GUTTER - 6;
  const cells: React.ReactNode[] = [];
  for (let row = 0; row < ROWS; row++)
    for (let col = 0; col < COLS; col++) {
      const fill = cellColor(col, row);
      if (fill)
        cells.push(
          <rect key={`${col}-${row}`} x={col * CELL} y={row * CELL} width={CELL} height={CELL} fill={fill} />,
        );
    }

  const fine: string[] = [];
  const bold: string[] = [];
  for (let c = 0; c <= COLS; c++) ((COLS - c) % 5 === 0 ? bold : fine).push(`M${c * CELL} 0V${ROWS * CELL}`);
  for (let r = 0; r <= ROWS; r++) ((ROWS - r) % 5 === 0 ? bold : fine).push(`M0 ${r * CELL}H${COLS * CELL}`);

  return (
    <svg
      viewBox={`-1 -1 ${width + 2} ${height + 2}`}
      className={className}
      role="img"
      aria-label="Illustration of a colourwork stitch chart with one row highlighted"
    >
      <rect width={COLS * CELL} height={ROWS * CELL} fill="#f3f4fc" />
      {cells}
      <path d={fine.join("")} stroke="#081638" strokeOpacity="0.14" strokeWidth="0.6" fill="none" />
      <path d={bold.join("")} stroke="#081638" strokeOpacity="0.45" strokeWidth="0.9" fill="none" />

      {/* Row highlighter */}
      <rect
        x={-2}
        y={HIGHLIGHT_ROW * CELL - 1}
        width={COLS * CELL + 4}
        height={CELL + 2}
        rx="2"
        fill="#b6ff00"
        fillOpacity="0.38"
        stroke="#081638"
        strokeWidth="1.2"
      />

      {/* Row numbers (right edge, counted from the bottom) */}
      <g fill="#4a5380" fontSize="6" style={{ fontFamily: "var(--font-geist-mono), monospace" }}>
        {Array.from({ length: ROWS }, (_, row) => {
          const n = ROWS - row;
          if (n % 2 === 0 && row !== HIGHLIGHT_ROW) return null;
          return (
            <text
              key={row}
              x={COLS * CELL + 4}
              y={row * CELL + CELL / 2 + 2}
              fill={row === HIGHLIGHT_ROW ? "#081638" : undefined}
              fontWeight={row === HIGHLIGHT_ROW ? 700 : 400}
            >
              {n}
            </text>
          );
        })}
        {/* Column numbers (bottom, counted from the right) */}
        {Array.from({ length: COLS }, (_, col) => {
          const n = COLS - col;
          if (n % 5 !== 0 && n !== 1) return null;
          return (
            <text key={col} x={col * CELL + CELL / 2} y={ROWS * CELL + 9} textAnchor="middle">
              {n}
            </text>
          );
        })}
      </g>
    </svg>
  );
}
