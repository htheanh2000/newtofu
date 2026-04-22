/**
 * Cloudflare Worker – reverse proxy admin static site from S3 website.
 * admin.springsummer2026margiela.com → S3 bucket (static website hosting).
 * Handles SPA routing: unknown paths fallback to /index.html.
 */

export default {
  async fetch(request, env) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const url = new URL(request.url);
    const s3Host = env.S3_WEBSITE_HOST;
    const s3Origin = `http://${s3Host}`;

    const s3Url = `${s3Origin}${url.pathname}${url.search}`;

    let response = await fetch(s3Url, {
      method: request.method,
      headers: { Host: s3Host },
      cf: { cacheTtl: 300, cacheEverything: true },
    });

    if (response.status === 404 || response.status === 403) {
      response = await fetch(`${s3Origin}/index.html`, {
        method: request.method,
        headers: { Host: s3Host },
        cf: { cacheTtl: 60 },
      });

      if (!response.ok) {
        return new Response("Not Found", { status: 404 });
      }

      const headers = new Headers(response.headers);
      headers.set("Content-Type", "text/html; charset=utf-8");
      return new Response(response.body, { status: 200, headers });
    }

    return response;
  },
};
