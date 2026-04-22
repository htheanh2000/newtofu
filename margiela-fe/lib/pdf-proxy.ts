/**
 * Rewrite S3 URL → same-domain proxy URL so the link keeps springsummer2026margiela.com domain
 * when users scan QR / view PDF.
 *
 * S3 URL pattern: https://<bucket>.s3.<region>.amazonaws.com/pdfs/<filename>.pdf
 * Proxy URL:      /api/pdf-proxy/<filename>.pdf  (same origin, served by Next.js API route)
 */

const S3_HOST_PATTERN =
  /^https:\/\/[^/]+\.s3(\.[a-z0-9-]+)?\.amazonaws\.com\//i;

export function toProxyPdfUrl(s3OrAnyUrl: string): string {
  if (!S3_HOST_PATTERN.test(s3OrAnyUrl)) return s3OrAnyUrl;

  try {
    const u = new URL(s3OrAnyUrl);
    const filename = u.pathname.split("/").pop();
    if (!filename) return s3OrAnyUrl;
    return `/api/pdf-proxy/${filename}`;
  } catch {
    return s3OrAnyUrl;
  }
}
