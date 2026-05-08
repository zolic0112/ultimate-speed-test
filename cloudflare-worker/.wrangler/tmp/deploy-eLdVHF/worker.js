// worker.js
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-store"
};
var worker_default = {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: CORS });
    }
    const upUrl = "https://speed.cloudflare.com/__up" + new URL(request.url).search;
    try {
      const upstream = await fetch(upUrl, {
        method: "POST",
        body: request.body
      });
      return new Response("ok", {
        status: upstream.ok ? 200 : upstream.status,
        headers: CORS
      });
    } catch (err) {
      return new Response("upstream error: " + err.message, {
        status: 502,
        headers: CORS
      });
    }
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
