/**
 * Pattern Library vocabulary shared by server and client. Pure module.
 */

export const BUCKET = "makerie-files";

export type CraftSlug = "knitting" | "crochet" | "cross-stitch" | "needlepoint" | (string & {});

export type CraftField = { key: string; label: string; placeholder?: string };

/** Craft-specific optional fields, stored in patterns.craft_details. */
export const CRAFT_FIELDS: Record<string, CraftField[]> = {
  knitting: [
    { key: "gauge", label: "Gauge", placeholder: "22 sts × 30 rows = 10 cm" },
    { key: "needle_sizes", label: "Needle sizes", placeholder: "4 mm, 3.5 mm circular" },
    { key: "yarn_weight", label: "Yarn weight", placeholder: "DK" },
    { key: "yardage", label: "Yardage", placeholder: "900–1200 yds" },
    { key: "construction", label: "Construction", placeholder: "Top-down raglan" },
  ],
  crochet: [
    { key: "gauge", label: "Gauge", placeholder: "16 sc × 18 rows = 10 cm" },
    { key: "hook_sizes", label: "Hook sizes", placeholder: "5 mm (H/8)" },
    { key: "yarn_weight", label: "Yarn weight", placeholder: "Worsted" },
    { key: "yardage", label: "Yardage", placeholder: "600 yds" },
  ],
  "cross-stitch": [
    { key: "stitch_count", label: "Stitch count", placeholder: "120 × 90" },
    { key: "fabric", label: "Fabric & count", placeholder: "14-count Aida" },
    { key: "floss", label: "Floss", placeholder: "DMC, 18 colours" },
    { key: "finished_size", label: "Finished size", placeholder: "22 × 16 cm" },
  ],
  needlepoint: [
    { key: "canvas_mesh", label: "Canvas mesh", placeholder: "13-mesh mono" },
    { key: "threads", label: "Threads", placeholder: "Persian wool" },
    { key: "stitches", label: "Stitches", placeholder: "Tent, basketweave" },
    { key: "finished_size", label: "Finished size", placeholder: "30 × 30 cm" },
  ],
};

export const DIFFICULTY = ["Beginner", "Easy", "Intermediate", "Advanced", "Expert"] as const;
export const difficultyLabel = (value: number | null | undefined) =>
  value ? (DIFFICULTY[value - 1] ?? null) : null;

export const PROJECT_STATUSES = [
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In progress" },
  { value: "paused", label: "Paused" },
  { value: "finished", label: "Finished" },
  { value: "abandoned", label: "Abandoned" },
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]["value"];
export const statusLabel = (value: string) =>
  PROJECT_STATUSES.find((s) => s.value === value)?.label ?? value;

export const FOLDER_COLORS = ["lime", "pink", "laser", "ultraviolet", "aqua", "peach", "cobalt"] as const;
export type FolderColor = (typeof FOLDER_COLORS)[number];
export const FOLDER_COLOR_HEX: Record<FolderColor, string> = {
  lime: "#b6ff00",
  pink: "#f477d3",
  laser: "#48d7f5",
  ultraviolet: "#ae8aff",
  aqua: "#8ef0d3",
  peach: "#ffbc91",
  cobalt: "#494af4",
};

export type SourceKind = "pdf" | "image" | "website" | "video";
export const SOURCE_LABEL: Record<SourceKind, string> = {
  pdf: "PDF",
  image: "Images",
  website: "Website",
  video: "Video",
};

/* Uploads */
export const MAX_PDF_BYTES = 100 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];
export const PDF_TYPES = ["application/pdf"];

export function validateUpload(kind: "pdf" | "image", type: string, size: number): string | null {
  const allowed = kind === "pdf" ? PDF_TYPES : IMAGE_TYPES;
  if (!allowed.includes(type)) {
    return kind === "pdf" ? "That file isn't a PDF." : "Use a JPEG, PNG, WebP, GIF or HEIC image.";
  }
  const max = kind === "pdf" ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
  if (size > max) return `Files can be up to ${Math.round(max / 1024 / 1024)} MB.`;
  if (size === 0) return "That file is empty.";
  return null;
}

/** Storage paths always start with the owner id (enforced by storage RLS). */
export function storagePath(
  ownerId: string,
  scope: "patterns" | "projects",
  parentId: string,
  fileName: string,
  unique: string,
) {
  const safe = fileName
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // drop accents split off by NFKD
    .replace(/[^\w.-]+/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|-+$/g, "")
    .slice(-80) || "file";
  return `${ownerId}/${scope}/${parentId}/${unique}-${safe}`;
}

export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export const formatBytes = (bytes: number | null | undefined) => {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

/** Today as YYYY-MM-DD in the viewer's own time zone (not UTC). */
export const todayLocal = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
