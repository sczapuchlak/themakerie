/** Circular progress — rewarding but restrained. */
export function ProgressRing({
  value,
  size = 96,
  stroke = 9,
  label,
  tone = "light",
}: {
  value: number | null;
  size?: number;
  stroke?: number;
  label?: string;
  tone?: "light" | "dark";
}) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const track = tone === "dark" ? "rgb(255 255 255 / 0.14)" : "rgb(8 22 56 / 0.09)";
  const fill = tone === "dark" ? "#B6FF00" : "#494AF4";
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${v}% complete`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={fill}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
          className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-center leading-none">
        <span>
          <span className={`block font-mono font-semibold ${tone === "dark" ? "text-white" : "text-strong"}`} style={{ fontSize: size * 0.24 }}>
            {v}%
          </span>
          {label && <span className={`mt-1 block text-[0.6rem] font-semibold tracking-[0.12em] uppercase ${tone === "dark" ? "text-white/60" : "text-muted"}`}>{label}</span>}
        </span>
      </span>
    </div>
  );
}
