/**
 * The app canvas — level 2 of the visual hierarchy. Broad, saturated colour
 * fields that blend into each other (a CSS mesh), a soft holographic sheen,
 * fine grain to keep the gradients from banding, and a faint technical grid.
 * No detailed imagery: the liquid-chrome material is reserved for the hero.
 * Fixed and static — cheap on iPhone.
 */
const fields = [
  "radial-gradient(72vmax 62vmax at -4% -10%, rgb(73 74 244 / 0.5), transparent 66%)", // cobalt
  "radial-gradient(62vmax 50vmax at 52% -14%, rgb(174 138 255 / 0.62), transparent 68%)", // ultraviolet
  "radial-gradient(58vmax 58vmax at 104% 30%, rgb(244 119 211 / 0.52), transparent 66%)", // holo pink
  "radial-gradient(50vmax 46vmax at -2% 76%, rgb(142 240 211 / 0.62), transparent 66%)", // aqua
  "radial-gradient(58vmax 48vmax at 94% 106%, rgb(255 188 145 / 0.66), transparent 66%)", // solar peach
  "radial-gradient(50vmax 42vmax at 50% 70%, rgb(72 215 245 / 0.34), transparent 68%)", // laser
].join(",");

const base = "linear-gradient(160deg, #e9e7ff 0%, #f4eeff 46%, #fdf0f2 100%)";

const sheen =
  "linear-gradient(118deg, transparent 30%, rgb(255 255 255 / 0.32) 46%, transparent 58%)";

const grain =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.03 0 0 0 0 0.09 0 0 0 0 0.22 0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

export function Atmosphere() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-canvas"
      style={{ backgroundImage: `${sheen}, ${fields}, ${base}` }}
    >
      <div className="absolute inset-0 opacity-[0.18]" style={{ backgroundImage: grain }} />
      <div className="tech-grid absolute inset-0 text-midnight/[0.05]" />
    </div>
  );
}
