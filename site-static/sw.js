/* Temporary service-worker kill switch for mobile release hardening.
 * It replaces older app service workers, clears stale shell caches, then
 * unregisters itself so all future navigations come from the network.
 */

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.clients.claim();
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      await self.registration.unregister();
      for (const client of clients) {
        client.postMessage({ type: "lod-sw-disabled" });
      }
    })(),
  );
});

self.addEventListener("fetch", () => {
  // Intentionally do not intercept requests.
});
