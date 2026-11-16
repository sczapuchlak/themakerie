/**
 * Stash vocabulary and exact quantity maths. Pure; shared by server and client.
 *
 * Quantities are integers in exact base units — counts, decigrams (0.1 g),
 * centimetres, pieces — so additions and deductions never drift. Entry
 * units (oz, yd, in) are converted once on the way in and shown back in
 * the unit the user chose.
 */

export const FAMILIES = [
  { value: "yarn", label: "Yarn", kind: "material", hint: "Skeins, balls, cakes, cones, leftovers" },
  { value: "thread", label: "Thread & floss", kind: "material", hint: "Embroidery floss, pearl cotton, tapestry wool" },
  { value: "fabric", label: "Fabric & canvas", kind: "material", hint: "Aida, evenweave, linen, needlepoint canvas" },
  { value: "notion", label: "Notions", kind: "material", hint: "Buttons, zips, beads, stuffing, markers" },
  { value: "tool", label: "Tools", kind: "tool", hint: "Needles, hooks, hoops, frames, scissors" },
  { value: "other", label: "Other supplies", kind: "material", hint: "Anything else you use up" },
] as const;
export type Family = (typeof FAMILIES)[number]["value"];
export const familyLabel = (f: string) => FAMILIES.find((x) => x.value === f)?.label ?? f;
export const familyKind = (f: string): "material" | "tool" => (f === "tool" ? "tool" : "material");

/** Built-in categories; users can add their own per family. */
export const CATEGORIES: Record<Family, string[]> = {
  yarn: ["Yarn", "Leftovers & scraps"],
  thread: ["Embroidery floss", "Pearl cotton", "Tapestry wool", "Specialty thread"],
  fabric: ["Aida", "Evenweave", "Linen", "Needlepoint canvas", "Other fabric"],
  notion: ["Buttons", "Zippers", "Beads", "Stuffing", "Ribbon", "Stitch markers", "Other notions"],
  tool: [
    "Knitting needles",
    "Crochet hooks",
    "Interchangeable set",
    "Tapestry needles",
    "Embroidery hoops",
    "Frames",
    "Scissors",
    "Blocking tools",
    "Other tools",
  ],
  other: ["Other supplies"],
};

export const UNIT_LABELS: Record<Family, string[]> = {
  yarn: ["skein", "ball", "cake", "cone", "hank"],
  thread: ["skein", "bobbin", "card", "spool", "hank"],
  fabric: ["piece"],
  notion: ["unit", "pack", "bag", "card"],
  tool: ["unit", "pair", "set"],
  other: ["unit", "pack"],
};

export const YARN_WEIGHTS = ["Lace", "Fingering", "Sport", "DK", "Worsted", "Aran", "Chunky", "Super chunky", "Jumbo"];

export type SpecField = { key: string; label: string; placeholder?: string; options?: string[]; advanced?: boolean };

/** Family-specific fields: essentials first, the rest behind "More details". */
export const SPEC_FIELDS: Record<Family, SpecField[]> = {
  yarn: [
    { key: "weight_class", label: "Weight", options: YARN_WEIGHTS },
    { key: "fiber", label: "Fibre", placeholder: "100% acrylic" },
    { key: "needles", label: "Needles / hooks", placeholder: "4 mm needles · 4.5 mm hook", advanced: true },
    { key: "gauge", label: "Gauge", placeholder: "22 sts × 30 rows = 10 cm", advanced: true },
    { key: "care", label: "Care", placeholder: "Machine wash 40°", advanced: true },
  ],
  thread: [
    { key: "thread_type", label: "Thread type", placeholder: "6-strand cotton" },
    { key: "line", label: "Thread line / system", placeholder: "Mouliné Spécial", advanced: true },
    { key: "strands", label: "Strands", placeholder: "6", advanced: true },
  ],
  fabric: [
    { key: "fabric_type", label: "Type", placeholder: "Aida, evenweave, mono canvas" },
    { key: "count", label: "Count / mesh", placeholder: "14 ct · 13 mesh" },
    { key: "composition", label: "Composition", placeholder: "100% cotton", advanced: true },
  ],
  notion: [
    { key: "size", label: "Size", placeholder: "15 mm" },
    { key: "material", label: "Material", placeholder: "Wood, shell, metal", advanced: true },
  ],
  tool: [
    { key: "size", label: "Size", placeholder: "4.0 mm · US 6 · 8 in" },
    { key: "length", label: "Length", placeholder: "80 cm cable" },
    { key: "material", label: "Material", placeholder: "Bamboo, steel", advanced: true },
    { key: "system", label: "Needle system / type", placeholder: "Interchangeable · fixed circular", advanced: true },
    { key: "set_name", label: "Part of set", placeholder: "ChiaoGoo Twist set", advanced: true },
    { key: "condition", label: "Condition", placeholder: "Like new", advanced: true },
  ],
  other: [{ key: "size", label: "Size / details", placeholder: "" }],
};

/* --------------------------------------------------------------- units */

export type Measure = "count" | "mass" | "length" | "piece";
export type EntryUnit = "unit" | "g" | "oz" | "m" | "yd" | "cm" | "in" | "piece";

const DG_PER_G = 10;
const DG_PER_OZ = 283.495;
const CM_PER_M = 100;
const CM_PER_YD = 91.44;

/** User entry → exact integer base units. */
export function toBase(value: number, unit: EntryUnit): { measure: Measure; quantity: number } {
  switch (unit) {
    case "g":
      return { measure: "mass", quantity: Math.round(value * DG_PER_G) };
    case "oz":
      return { measure: "mass", quantity: Math.round(value * DG_PER_OZ) };
    case "m":
      return { measure: "length", quantity: Math.round(value * CM_PER_M) };
    case "yd":
      return { measure: "length", quantity: Math.round(value * CM_PER_YD) };
    case "cm":
      return { measure: "length", quantity: Math.round(value) };
    case "in":
      return { measure: "length", quantity: Math.round(value * 2.54) };
    case "piece":
      return { measure: "piece", quantity: Math.round(value) };
    default:
      return { measure: "count", quantity: Math.round(value) };
  }
}

const trim = (n: number) => (Math.round(n * 10) / 10).toString();

/** Base units → text in the unit the user entered with. */
export function fromBase(quantity: number, measure: Measure, unit: EntryUnit | string = "unit", unitLabel = "unit"): string {
  if (measure === "mass") return unit === "oz" ? `${trim(quantity / DG_PER_OZ)} oz` : `${trim(quantity / DG_PER_G)} g`;
  if (measure === "length") {
    if (unit === "yd") return `${trim(quantity / CM_PER_YD)} yd`;
    if (unit === "cm") return `${quantity} cm`;
    if (unit === "in") return `${trim(quantity / 2.54)} in`;
    return `${trim(quantity / CM_PER_M)} m`;
  }
  if (measure === "piece") return plural(quantity, "piece");
  return plural(quantity, unitLabel);
}

export const plural = (n: number, word: string) => `${n} ${n === 1 ? word : word.endsWith("s") ? word : `${word}s`}`;

/** Grams/metres for one full unit, from what the user knows. */
export const unitMassFrom = (value: number | null, unit: "g" | "oz") => (value && value > 0 ? toBase(value, unit).quantity : null);
export const unitLengthFrom = (value: number | null, unit: "m" | "yd") => (value && value > 0 ? toBase(value, unit).quantity : null);

export type StockSummary = {
  full_units: number;
  partial_units: number;
  has_unknown_partials: boolean;
  loose_mass_dg: number;
  loose_length_cm: number;
  pieces: number;
  reserved_total: number;
  quantity_total: number;
};

/**
 * Human summary that never claims precision it doesn't have:
 * "4 skeins + 38 g", "2 skeins + 1 partial (amount unknown)", "≈ 850 yd".
 */
export function describeStock(s: StockSummary, unitLabel = "unit", prefer: { mass?: "g" | "oz"; length?: "m" | "yd" } = {}) {
  const parts: string[] = [];
  if (s.full_units) parts.push(plural(s.full_units, unitLabel));
  if (s.partial_units) parts.push(`${s.partial_units} partial${s.partial_units === 1 ? "" : "s"}${s.has_unknown_partials ? " (amount unknown)" : ""}`);
  if (s.loose_mass_dg) parts.push(fromBase(s.loose_mass_dg, "mass", prefer.mass ?? "g"));
  if (s.loose_length_cm) parts.push(fromBase(s.loose_length_cm, "length", prefer.length ?? "m"));
  if (s.pieces) parts.push(plural(s.pieces, "piece"));
  return parts.length ? parts.join(" + ") : "None in stock";
}

/**
 * Total length when it can be known: full units × unit length plus measured
 * length. Returns null if any stock can't be converted, so the UI says
 * "at least" or "unknown" instead of inventing a number.
 */
export function totalLengthCm(s: StockSummary, unitLengthCm: number | null): { cm: number; exact: boolean } | null {
  let cm = s.loose_length_cm;
  if (s.full_units) {
    if (!unitLengthCm) return null;
    cm += s.full_units * unitLengthCm;
  }
  const exact = !s.partial_units && !s.loose_mass_dg;
  return { cm, exact };
}

export function totalMassDg(s: StockSummary, unitMassDg: number | null): { dg: number; exact: boolean } | null {
  let dg = s.loose_mass_dg;
  if (s.full_units) {
    if (!unitMassDg) return null;
    dg += s.full_units * unitMassDg;
  }
  return { dg, exact: !s.partial_units && !s.loose_length_cm };
}

/* -------------------------------------------------------------- colours */

export const COLOR_FAMILIES = [
  { value: "red", label: "Red", hex: "#d63a3a" },
  { value: "orange", label: "Orange", hex: "#f28b30" },
  { value: "yellow", label: "Yellow", hex: "#f5d33f" },
  { value: "green", label: "Green", hex: "#4caf50" },
  { value: "teal", label: "Teal", hex: "#1fa5a0" },
  { value: "blue", label: "Blue", hex: "#3b6fe0" },
  { value: "purple", label: "Purple", hex: "#8b55d6" },
  { value: "pink", label: "Pink", hex: "#ec6fb4" },
  { value: "brown", label: "Brown", hex: "#8a5a3b" },
  { value: "neutral", label: "Neutral", hex: "#cbbfae" },
  { value: "black", label: "Black", hex: "#1d1d24" },
  { value: "white", label: "White", hex: "#f7f5ef" },
  { value: "multi", label: "Multicolour", hex: "conic" },
] as const;
export type ColorFamily = (typeof COLOR_FAMILIES)[number]["value"];

/** Approximate family for a chosen swatch — a browsing aid, not a match. */
export function colorFamilyOf(hex: string): ColorFamily | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = Number.parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (l < 0.13) return "black";
  if (l > 0.9 && s < 0.5) return "white";
  if (s < 0.16) return l > 0.55 ? "neutral" : l < 0.25 ? "black" : "neutral";
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  if ((h < 45 && l < 0.42 && s < 0.7) || (h >= 15 && h < 45 && l < 0.35)) return "brown";
  if (h < 12 || h >= 345) return l > 0.72 ? "pink" : "red";
  if (h < 42) return "orange";
  if (h < 68) return "yellow";
  if (h < 160) return "green";
  if (h < 190) return "teal";
  if (h < 255) return "blue";
  if (h < 290) return "purple";
  return "pink";
}

export function familiesFor(hexes: string[]): ColorFamily[] {
  const set = new Set(hexes.map(colorFamilyOf).filter((x): x is ColorFamily => Boolean(x)));
  if (hexes.length > 2 && set.size > 2) set.add("multi");
  return [...set];
}

/* ---------------------------------------------------------------- misc */

export const formatMoney = (cents: number | null | undefined, currency = "USD") =>
  cents == null ? null : new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);

/** Colour codes stay exact strings: "0310", "B5200", "ECRU". */
export const normalizeCode = (code: string | null | undefined) => (code ?? "").trim().toUpperCase() || null;

/** Low stock compares whole units only (never grams + skeins + cm). */
export const isLowStock = (c: { low_stock_threshold: number | null; full_units: number | null; partial_units?: number | null; reserved_units: number | null }) =>
  c.low_stock_threshold != null && (c.full_units ?? 0) + (c.partial_units ?? 0) - (c.reserved_units ?? 0) <= c.low_stock_threshold;
