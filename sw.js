/* Ultimate Speed Test — service worker
   Strategy:
   - App shell (HTML/CSS/JS/icons/manifest): cache-first, refreshed in the background.
   - Everything else (including speed.cloudflare.com test traffic): network-only,
     so measurements are never served from cache. */
const VERSION = "ust-v49-share-modal-i18n";
const SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app-v2.js",
  "./i18n.js",
  "./shader-renderer.js",
  "./speedtest.js",
  "./medal.js",
  "./share-card.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-apple-180.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never cache speed test traffic or cross-origin requests.
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req).then((hit) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || fetchPromise;
    }),
  );
});
