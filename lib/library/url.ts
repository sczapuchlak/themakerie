/**
 * URL helpers for pattern sources. Pure module (no Node/Next imports).
 */

const TRACKING = /^(utm_|fbclid$|gclid$|mc_|ref$|ref_src$|igshid$|si$)/i;

/** Canonical form used to spot duplicate links. */
export function normalizeUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase().replace(/^www\.|^m\./, "");
  // youtu.be/<id> and youtube.com/watch?v=<id> are the same video
  const yt = youtubeId(url);
  if (yt) return `youtube.com/watch?v=${yt}`;
  const params = [...url.searchParams.entries()]
    .filter(([key]) => !TRACKING.test(key))
    .sort(([a], [b]) => a.localeCompare(b));
  const query = params.length ? `?${new URLSearchParams(params).toString()}` : "";
  const path = url.pathname.replace(/\/+$/, "") || "";
  return `${host}${path}${query}`;
}

export function youtubeId(input: string | URL): string | null {
  let url: URL;
  try {
    url = typeof input === "string" ? new URL(input) : input;
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\.|^m\./, "");
  if (host === "youtu.be") return url.pathname.slice(1).split("/")[0] || null;
  if (host === "youtube.com" || host === "music.youtube.com") {
    if (url.pathname === "/watch") return url.searchParams.get("v");
    const match = url.pathname.match(/^\/(shorts|embed|live)\/([\w-]+)/);
    return match?.[2] ?? null;
  }
  return null;
}

/** Validates a user-supplied link; returns a normalized absolute URL or an error. */
export function parseHttpUrl(input: string): { url: string } | { error: string } {
  const value = input.trim();
  if (!value) return { error: "Paste a link." };
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`);
  } catch {
    return { error: "That doesn't look like a web address." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { error: "Only web links (http/https) can be saved." };
  if (!url.hostname.includes(".")) return { error: "That doesn't look like a web address." };
  if (url.username || url.password) return { error: "Links with embedded credentials aren't allowed." };
  return { url: url.toString() };
}

/**
 * True for addresses a server-side fetch must never reach: loopback,
 * private, link-local, CGNAT, multicast, reserved, unspecified (IPv4 & v6).
 */
export function isPrivateAddress(address: string): boolean {
  const ip = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (ip.includes(":")) {
    if (ip === "::" || ip === "::1") return true;
    const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return /^(fc|fd|fe8|fe9|fea|feb|ff|2001:db8|64:ff9b)/.test(ip);
  }
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

export type LinkMetadata = {
  title: string | null;
  description: string | null;
  siteName: string | null;
  author: string | null;
  imageUrl: string | null;
};

const decode = (value: string) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ")
    .trim();

/** Extracts Open Graph / standard metadata from page HTML. Never throws. */
export function parseMetadata(html: string, pageUrl: string): LinkMetadata {
  const head = html.slice(0, 300_000);
  const metas = new Map<string, string>();
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = tag.match(/\b(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    const content = tag.match(/\bcontent\s*=\s*"([^"]*)"|\bcontent\s*=\s*'([^']*)'/i);
    const value = content?.[1] ?? content?.[2];
    if (key && value && !metas.has(key)) metas.set(key, decode(value));
  }
  const pick = (...keys: string[]) => keys.map((k) => metas.get(k)).find((v) => v && v.length > 0) ?? null;
  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];

  let imageUrl = pick("og:image:secure_url", "og:image", "twitter:image", "twitter:image:src");
  if (imageUrl) {
    try {
      const resolved = new URL(imageUrl, pageUrl);
      imageUrl = resolved.protocol === "https:" || resolved.protocol === "http:" ? resolved.toString() : null;
    } catch {
      imageUrl = null;
    }
  }

  return {
    title: clip(pick("og:title", "twitter:title") ?? (titleTag ? decode(titleTag) : null), 200),
    description: clip(pick("og:description", "description", "twitter:description"), 1000),
    siteName: clip(pick("og:site_name", "application-name"), 120),
    author: clip(pick("author", "article:author", "twitter:creator"), 120),
    imageUrl,
  };
}

const clip = (value: string | null, max: number) => (value ? value.slice(0, max) : null);

/** Lower-case, punctuation-free title used to warn about likely duplicates. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
