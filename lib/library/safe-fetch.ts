import "server-only";
import { lookup } from "node:dns/promises";
import { isPrivateAddress } from "./url";

/**
 * Fetches a public web resource for link previews, with SSRF protections:
 * http(s) only on standard ports, DNS-checked against private/internal
 * ranges (re-checked on every redirect), no credentials, strict timeout,
 * size cap and content-type allow-list.
 */
export async function safeFetch(
  input: string,
  { accept, maxBytes, timeoutMs = 6000 }: { accept: RegExp; maxBytes: number; timeoutMs?: number },
): Promise<{ url: string; contentType: string; body: Buffer }> {
  let url = new URL(input);
  const deadline = AbortSignal.timeout(timeoutMs);

  for (let hop = 0; hop <= 3; hop++) {
    await assertPublicUrl(url);
    const response = await fetch(url, {
      redirect: "manual",
      signal: deadline,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; MakerieLinkPreview/1.0)",
        accept: "text/html,application/xhtml+xml,image/*;q=0.8,*/*;q=0.5",
      },
      cache: "no-store",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Redirect without a location");
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) throw new Error(`The site responded with ${response.status}`);

    const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
    if (!accept.test(contentType)) throw new Error(`Unexpected content type ${contentType || "unknown"}`);
    const declared = Number(response.headers.get("content-length"));
    if (declared > maxBytes) throw new Error("Response too large");

    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        // HTML: the <head> we need is at the start; keep what we have.
        if (accept.source.includes("html")) break;
        throw new Error("Response too large");
      }
      chunks.push(value);
    }
    return { url: url.toString(), contentType, body: Buffer.concat(chunks) };
  }
  throw new Error("Too many redirects");
}

async function assertPublicUrl(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only http(s) links");
  if (url.username || url.password) throw new Error("Credentials in URL");
  if (url.port && url.port !== "80" && url.port !== "443") throw new Error("Non-standard port");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new Error("Private host");
  }
  const addresses = await lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) throw new Error("Private address");
}
