/* Ultimate Speed Test — service worker
   Strategy:
   - HTML / navigations: network-first (always show latest UI on refresh; cache fallback for offline).
   - Other shell assets (CSS/JS/icons): stale-while-revalidate (instant load, refreshed in background).
   - Cross-origin / speed test traffic: passthrough, never cached. */
const VERSION = "ust-v56-canvas-bleed";
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

  // Never cache cross-origin (incl. speed test traffic, fonts, CDNs).
  if (url.origin !== self.location.origin) return;

  // Navigation / HTML requests → network-first.
  // This avoids the "two refreshes to see updates" problem: each load
  // hits the network for fresh markup, falls back to cache only when offline.
  const isHTML =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  if (isHTML) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html"))),
    );
    return;
  }

  // Other same-origin assets → stale-while-revalidate.
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
