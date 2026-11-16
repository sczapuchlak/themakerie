/**
 * Only same-site, relative destinations are allowed after sign-in, so a
 * crafted `next` parameter can't send the owner to another site.
 */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  if (value.startsWith("/auth/") || value.startsWith("/sign-in")) return "/";
  return value;
}

/** Cookie that carries the post-sign-in destination through the OAuth round trip. */
export const NEXT_PATH_COOKIE = "makerie-next";
