/**
 * Netlify Edge Function – upload measurement sink
 *
 * Accepts arbitrary POST bodies, drains them via streaming
 * (never buffers into memory), and returns 200.
 *
 * Used by speedtest.js as a CORS-safe upload endpoint when
 * the app is deployed on Netlify. Because it is an Edge Function
 * it runs at the nearest Netlify PoP, giving a realistic
 * "last-mile → Netlify edge" upload measurement.
 *
 * Path:    /api/upload   (declared in netlify.toml)
 * Methods: POST (binary body) | OPTIONS (CORS preflight)
 */
export default async (request) => {
  // ── CORS preflight ──────────────────────────────────────────────
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // ── Drain the request body without accumulating it ───────────────
  // Edge Functions support the standard ReadableStream API, so we
  // can iterate chunk-by-chunk regardless of total body size.
  let bytes = 0;
  if (request.body) {
    const reader = request.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value?.byteLength ?? 0;
    }
  }

  // Return the byte count as a plain-text body (informational only;
  // speedtest.js doesn't read the response body, just checks status).
  return new Response(String(bytes), {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
      "Content-Type": "text/plain;charset=utf-8",
    },
  });
};

// Tell Netlify which URL path this function handles.
export const config = {
  path: "/api/upload",
};
