/**
 * Cloudflare Worker – reverse proxy PDF từ S3 public bucket.
 * User scan QR → link dạng https://pdf.springsummer2026margiela.com/pdfs/xxx.pdf
 * Worker fetch từ S3 public URL và stream lại, giữ nguyên domain.
 *
 * Free plan: 100,000 requests/ngày.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response("ok", { headers: { "Content-Type": "text/plain" } });
    }

    if (!url.pathname.startsWith("/pdfs/")) {
      return new Response("Not Found", { status: 404 });
    }

    const filename = decodeURIComponent(
      url.pathname.slice("/pdfs/".length).replace(/^\/+/, "")
    );
    if (!filename || filename.includes("..")) {
      return new Response("Bad Request", { status: 400 });
    }

    const bucket = env.S3_BUCKET;
    const region = env.AWS_REGION || "ap-southeast-1";
    const prefix = (env.S3_PREFIX || "pdfs/").replace(/\/?$/, "/");

    if (!bucket) {
      return new Response("Proxy not configured", { status: 503 });
    }

    const s3Url = `https://${bucket}.s3.${region}.amazonaws.com/${prefix}${filename}`;

    try {
      const s3Response = await fetch(s3Url, {
        method: request.method,
        cf: { cacheTtl: 86400, cacheEverything: true },
      });

      if (!s3Response.ok) {
        const status = s3Response.status === 403 ? 404 : s3Response.status;
        return new Response(status === 404 ? "Not Found" : "Upstream error", { status });
      }

      const headers = new Headers();
      headers.set("Content-Type", "application/pdf");
      headers.set("Content-Disposition", `inline; filename="${filename}"`);
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
      Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));

      const contentLength = s3Response.headers.get("Content-Length");
      if (contentLength) headers.set("Content-Length", contentLength);

      return new Response(s3Response.body, { status: 200, headers });
    } catch {
      return new Response("Internal Error", { status: 500 });
    }
  },
};
