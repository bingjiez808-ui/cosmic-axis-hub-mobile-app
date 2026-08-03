/* Fate Nexus service worker.
 * Versioned static-shell cache with an offline fallback.
 * Never caches API, auth, Supabase, AI, or any user-scoped response.
 */

const VERSION = "destiny-library-mobile-v2-2026-08-03";
const STATIC_CACHE = `static-${VERSION}`;

// Only the offline shell + brand icons/manifest. App HTML is always
// network-first so users get the latest deploy.
const PRECACHE_URLS = [
  "/offline.html",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
];

// URL substrings that must NEVER be cached (private / dynamic / auth).
const NEVER_CACHE = [
  "/_serverFn/",
  "/api/",
  "/.mcp/",
  "/mcp",
  "/auth",
  "/report",
  "/synthesis",
  "/admin",
  "/delete-account",
  "supabase.co",
  "supabase.in",
  "lovable-api",
  "connector-gateway",
  "/.lovable",
];

function isNeverCache(url) {
  return NEVER_CACHE.some((frag) => url.includes(frag));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Only handle same-origin requests; let cross-origin go directly.
  if (url.origin !== self.location.origin) return;

  if (isNeverCache(url.pathname + url.search)) return;

  // Navigations: network-first, offline fallback to /offline.html.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          return fresh;
        } catch {
          const cache = await caches.open(STATIC_CACHE);
          const offline = await cache.match("/offline.html");
          return offline || new Response("Offline", { status: 503 });
        }
      })(),
    );
    return;
  }

  // Hashed built assets under /assets/ or /_build/ — cache-first.
  const isHashedAsset =
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/_build/") ||
    /\.(?:woff2?|ttf|otf|eot)$/i.test(url.pathname);

  if (isHashedAsset) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const fresh = await fetch(req);
          if (fresh && fresh.ok && fresh.type === "basic") {
            cache.put(req, fresh.clone());
          }
          return fresh;
        } catch {
          return cached || Response.error();
        }
      }),
    );
    return;
  }

  // Same-origin images from /public — stale-while-revalidate.
  if (/\.(?:png|jpg|jpeg|webp|avif|svg|ico)$/i.test(url.pathname)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok && res.type === "basic") cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});
