/**
 * The four crafts The Makerie supports. This is static product copy,
 * not user data.
 */
export type CraftSlug = "knitting" | "crochet" | "cross-stitch" | "needlepoint";

export type Craft = {
  slug: CraftSlug;
  name: string;
  /** Short line describing the structure of the craft. */
  dek: string;
  /** What a maker typically works with. */
  tools: string;
};

export const crafts: readonly Craft[] = [
  {
    slug: "knitting",
    name: "Knitting",
    dek: "Loops pulled through loops, row after row — into sweaters, socks and soft sculpture.",
    tools: "Needles · Yarn · Charts",
  },
  {
    slug: "crochet",
    name: "Crochet",
    dek: "One hook, endless structure. Work in rows or rounds and build almost any shape.",
    tools: "Hook · Yarn · Rounds",
  },
  {
    slug: "cross-stitch",
    name: "Cross-Stitch",
    dek: "Pixel-perfect pictures, one tiny X at a time, counted out across an even-weave grid.",
    tools: "Aida · Floss · Grids",
  },
  {
    slug: "needlepoint",
    name: "Needlepoint",
    dek: "Dense, saturated stitches over open canvas — bold color, built to last.",
    tools: "Canvas · Wool · Tent stitch",
  },
];
