/**
 * Cloudflare Worker — upload measurement passthrough proxy
 *
 * Why a passthrough (not a drain-and-discard sink):
 *   The browser's xhr.upload.onprogress listener forces the request to be
 *   a CORS non-simple request, so a preflight is always sent. Cloudflare's
 *   /__up endpoint refuses preflight from non-cloudflare origins.
 *   This Worker handles the preflight + adds CORS, then forwards the
 *   upload body to /__up via fetch() with `body: request.body` — which
 *   streams the bytes through Cloudflare's runtime (no JS drain loop,
 *   no per-chunk await overhead). Throughput approaches wire speed.
 *
 * Topology:
 *
 *   Browser  ──HTTPS──►  Worker  ──CF internal──►  /__up
 *           (cross-origin,        (same network,
 *            CORS handled here)    near line speed)
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-store",
};

export default {
  async fetch(request) {
    // ── CORS preflight ───────────────────────────────────────────
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: CORS });
    }

    // ── Stream-forward upload body to Cloudflare /__up ──────────
    // Passing request.body directly tells Cloudflare to stream the body
    // through to the upstream — bytes never accumulate in memory and we
    // never spend JS CPU time draining chunks. This is the fast path.
    const upUrl =
      "https://speed.cloudflare.com/__up" + new URL(request.url).search;

    try {
      const upstream = await fetch(upUrl, {
        method: "POST",
        body: request.body,
      });
      // Don't bother reading the upstream response body — speedtest.js
      // doesn't read it either, it just needs a 2xx status to signal "done".
      return new Response("ok", {
        status: upstream.ok ? 200 : upstream.status,
        headers: CORS,
      });
    } catch (err) {
      return new Response("upstream error: " + err.message, {
        status: 502,
        headers: CORS,
      });
    }
  },
};
