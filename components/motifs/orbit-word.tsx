import { Starburst } from "./starburst";

/**
 * Wraps a display word in a fine orbital ring that passes behind the letters
 * at the top and in front of them at the bottom — typography interacting
 * with the celestial linework. Use on one headline per screen.
 */
export function OrbitWord({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative inline-block">
      <Ring side="back" />
      <span className="relative z-10">{children}</span>
      <Ring side="front" />
      <Starburst
        points={8}
        className="absolute top-[30%] -right-[0.2em] z-20 size-[0.26em] text-(--vivid)"
      />
    </span>
  );
}

function Ring({ side }: { side: "back" | "front" }) {
  return (
    <svg
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      className={`pointer-events-none absolute -inset-x-[7%] -inset-y-[14%] h-[128%] w-[114%] text-(--vivid) ${
        side === "front" ? "z-20" : "z-0 opacity-50"
      }`}
    >
      <path
        d={side === "back" ? "M1 25A49 14 0 0 1 99 15" : "M99 15A49 14 0 0 1 1 25"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
