/* The Makerie service worker.
 *
 * - Hashed build assets (/_next/static) are cached as they load.
 * - Pages are cached ONLY for projects explicitly made available offline
 *   (the page asks via postMessage), and refreshed whenever they load online.
 * - Navigations go to the network first; offline, a saved page or the
 *   offline index is served instead.
 * - Private files are not cached here: Work Mode keeps them in IndexedDB.
 */
const STATIC = "makerie-static-v1";
const PAGES = "makerie-pages-v1";
const KEEP = [STATIC, PAGES];

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (!KEEP.includes(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

const isStatic = (url) => url.origin === self.location.origin && url.pathname.startsWith("/_next/static/");
const pageKey = (url) => new URL(url.pathname, self.location.origin).toString();

async function savedPage(url) {
  const cache = await caches.open(PAGES);
  return (await cache.match(pageKey(url))) || (await cache.match(pageKey(new URL("/offline", self.location.origin))));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isStatic(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC);
        const hit = await cache.match(request, { ignoreSearch: false });
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      })(),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          // Keep saved offline pages fresh; never cache redirects (signed out).
          if (res.ok && !res.redirected) {
            const cache = await caches.open(PAGES);
            if (await cache.match(pageKey(url))) cache.put(pageKey(url), res.clone());
          }
          return res;
        } catch {
          const saved = await savedPage(url);
          if (saved) return saved;
          return new Response(
            "<!doctype html><meta name=viewport content='width=device-width'><title>Offline</title><body style='font-family:system-ui;padding:2rem;background:#081638;color:#fff'><h1>You're offline</h1><p>This page hasn't been saved for offline use. Projects you make available offline open without a connection.</p>",
            { status: 503, headers: { "content-type": "text/html; charset=utf-8" } },
          );
        }
      })(),
    );
  }
});

self.addEventListener("message", (event) => {
  const { type, urls = [] } = event.data || {};
  const reply = (msg) => event.ports[0] && event.ports[0].postMessage(msg);
  event.waitUntil(
    (async () => {
      try {
        if (type === "cache-pages") {
          const cache = await caches.open(PAGES);
          const assets = new Set();
          for (const u of urls) {
            const res = await fetch(u, { credentials: "same-origin", redirect: "manual" });
            if (!res.ok || res.type === "opaqueredirect") throw new Error(`Couldn't save ${new URL(u).pathname} (${res.status || "redirect"})`);
            // Every build asset the page references must work offline too.
            const html = await res.clone().text();
            for (const m of html.matchAll(/\/_next\/static\/[^"'\s)\\]+/g)) assets.add(new URL(m[0], self.location.origin).toString());
            await cache.put(pageKey(new URL(u)), res);
          }
          const statics = await caches.open(STATIC);
          for (const a of assets) {
            if (await statics.match(a)) continue;
            const r = await fetch(a);
            if (r.ok) await statics.put(a, r);
          }
          reply({ ok: true });
        } else if (type === "cache-static") {
          const cache = await caches.open(STATIC);
          for (const u of urls) {
            if (await cache.match(u)) continue;
            const res = await fetch(u);
            if (res.ok) await cache.put(u, res);
          }
          reply({ ok: true });
        } else if (type === "uncache-pages") {
          const cache = await caches.open(PAGES);
          for (const u of urls) await cache.delete(pageKey(new URL(u)));
          reply({ ok: true });
        } else if (type === "clear") {
          for (const key of await caches.keys()) await caches.delete(key);
          reply({ ok: true });
        }
      } catch (e) {
        reply({ ok: false, error: String((e && e.message) || e) });
      }
    })(),
  );
});
