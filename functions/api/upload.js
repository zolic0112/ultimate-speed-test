/**
 * Cloudflare Pages Function — upload measurement sink
 *
 * Accepts arbitrary POST bodies, drains them via streaming
 * (never buffers into memory), and returns 200.
 *
 * Used by speedtest.js as a same-origin (no CORS preflight)
 * upload endpoint. Replaces the Netlify edge function that
 * handled this when the app was hosted on Netlify.
 *
 * Path:    /api/upload   (auto-mapped from functions/api/upload.js)
 * Methods: POST (binary body) | OPTIONS (CORS preflight)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestPost({ request }) {
  // Drain the request body without accumulating it.
  // CF Workers support the standard ReadableStream API, so we
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

  return new Response(String(bytes), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Cache-Control": "no-store",
      "Content-Type": "text/plain;charset=utf-8",
    },
  });
}

// Reject other methods cleanly.
export async function onRequest({ request }) {
  return new Response("Method Not Allowed", {
    status: 405,
    headers: { ...corsHeaders, Allow: "POST, OPTIONS" },
  });
}
