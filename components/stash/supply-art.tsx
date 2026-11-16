/**
 * Category art for supplies without a photo — drawn in the item's own
 * swatch colours, so even an unphotographed stash looks like a boutique.
 */
export function SupplyArt({ family, colors, className = "" }: { family: string; colors: string[]; className?: string }) {
  const c = colors.length ? colors : ["#ae8aff", "#f477d3"];
  const a = c[0];
  const b = c[1] ?? shade(a, -0.18);
  const bg = `linear-gradient(160deg, ${mix(a, 0.82)} 0%, ${mix(b, 0.7)} 100%)`;
  return (
    <div className={`relative grid size-full place-items-center overflow-hidden ${className}`} style={{ background: bg }} aria-hidden="true">
      <svg viewBox="0 0 120 120" className="h-3/4 w-3/4 drop-shadow-[0_10px_18px_rgb(8_22_56/0.25)]">
        {family === "yarn" && <Yarn colors={c} />}
        {family === "thread" && <Floss colors={c} />}
        {family === "fabric" && <Fabric color={a} />}
        {family === "notion" && <Buttons colors={c} />}
        {family === "tool" && <Tool />}
        {family === "other" && <circle cx="60" cy="60" r="34" fill={a} />}
      </svg>
    </div>
  );
}

function Yarn({ colors }: { colors: string[] }) {
  const id = `y${colors.join("").replace(/#/g, "")}`.slice(0, 40);
  return (
    <>
      <defs>
        <clipPath id={id}>
          <circle cx="60" cy="60" r="40" />
        </clipPath>
        <radialGradient id={`${id}g`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#000" stopOpacity="0.25" />
        </radialGradient>
      </defs>
      <g clipPath={`url(#${id})`}>
        <rect x="0" y="0" width="120" height="120" fill={colors[0]} />
        {Array.from({ length: 14 }, (_, i) => (
          <path
            key={i}
            d={`M${-10 + i * 10} 0 Q ${30 + i * 6} 60 ${-10 + i * 10} 130`}
            stroke={colors[i % colors.length]}
            strokeWidth="7"
            fill="none"
            opacity={colors.length > 1 ? 0.95 : 0.35}
          />
        ))}
        {Array.from({ length: 6 }, (_, i) => (
          <path key={`h${i}`} d={`M0 ${30 + i * 12} Q 60 ${10 + i * 14} 120 ${36 + i * 12}`} stroke="#fff" strokeOpacity="0.18" strokeWidth="3" fill="none" />
        ))}
        <rect x="0" y="0" width="120" height="120" fill={`url(#${id}g)`} />
      </g>
      <path d="M92 86 q 14 10 22 4" stroke={colors[0]} strokeWidth="4" fill="none" strokeLinecap="round" />
    </>
  );
}

function Floss({ colors }: { colors: string[] }) {
  return (
    <>
      <rect x="22" y="18" width="76" height="84" rx="8" fill="#fff" />
      <rect x="22" y="18" width="76" height="20" rx="8" fill="#081638" />
      <circle cx="60" cy="28" r="4" fill="#fff" />
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x="30" y={44 + i * 6} width="60" height="5" rx="2.5" fill={colors[i % colors.length]} />
      ))}
    </>
  );
}

function Fabric({ color }: { color: string }) {
  return (
    <>
      <rect x="14" y="20" width="92" height="80" rx="6" fill={color} />
      {Array.from({ length: 12 }, (_, i) => (
        <line key={`v${i}`} x1={20 + i * 7.5} y1="20" x2={20 + i * 7.5} y2="100" stroke="#000" strokeOpacity="0.12" />
      ))}
      {Array.from({ length: 10 }, (_, i) => (
        <line key={`h${i}`} x1="14" y1={26 + i * 7.5} x2="106" y2={26 + i * 7.5} stroke="#000" strokeOpacity="0.12" />
      ))}
      <path d="M100 20 l6 0 l0 10 z" fill="#fff" opacity="0.5" />
    </>
  );
}

function Buttons({ colors }: { colors: string[] }) {
  const pos = [
    [40, 44, 20],
    [80, 50, 16],
    [56, 82, 18],
  ];
  return (
    <>
      {pos.map(([x, y, r], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={r} fill={colors[i % colors.length]} />
          <circle cx={x} cy={y} r={r * 0.72} fill="none" stroke="#fff" strokeOpacity="0.4" strokeWidth="2" />
          {[-1, 1].flatMap((dx) => [-1, 1].map((dy) => <circle key={`${dx}${dy}`} cx={x + dx * r * 0.22} cy={y + dy * r * 0.22} r={r * 0.09} fill="#081638" opacity="0.5" />))}
        </g>
      ))}
    </>
  );
}

function Tool() {
  return (
    <>
      <line x1="30" y1="96" x2="88" y2="22" stroke="#081638" strokeWidth="7" strokeLinecap="round" />
      <line x1="46" y1="100" x2="98" y2="34" stroke="#c9ccd8" strokeWidth="7" strokeLinecap="round" />
      <circle cx="88" cy="22" r="6" fill="#b6ff00" />
      <circle cx="98" cy="34" r="6" fill="#f477d3" />
    </>
  );
}

function rgb(hex: string) {
  const n = Number.parseInt(hex.replace("#", ""), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(hex: string, towardsWhite: number) {
  const [r, g, b] = rgb(hex);
  const m = (v: number) => Math.round(v + (255 - v) * towardsWhite);
  return `rgb(${m(r)} ${m(g)} ${m(b)})`;
}
function shade(hex: string, amount: number) {
  const [r, g, b] = rgb(hex);
  const m = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 + amount))));
  return `#${[m(r), m(g), m(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Small swatch row (variegated yarn shows several). */
export function Swatches({ colors, size = "sm" }: { colors: string[]; size?: "sm" | "md" }) {
  if (!colors.length) return null;
  const s = size === "md" ? "size-6" : "size-4";
  return (
    <span className="flex -space-x-1" aria-hidden="true">
      {colors.slice(0, 5).map((c, i) => (
        <span key={`${c}${i}`} className={`${s} rounded-full ring-2 ring-white`} style={{ background: c }} />
      ))}
    </span>
  );
}
