import { NextRequest, NextResponse } from "next/server";
import { withApiErrorNotify } from "@/lib/with-api-error-notify";

const S3_BUCKET = "margiela-pdfs";
const S3_PREFIX = "pdfs/";
const AWS_REGION = "ap-southeast-1";

/**
 * GET /api/pdf-proxy/:filename
 * Reverse proxy: fetch PDF from S3 public bucket, stream to client.
 * Device gate happens upstream at /view/[id] → /api/view-sheet/[id].
 */
async function getHandler(
  request: NextRequest,
  context?: { params?: Promise<{ filename: string }> }
) {
  const { filename } = await (context?.params ?? Promise.resolve({ filename: "" }));

  if (!filename || filename.includes("..") || !filename.endsWith(".pdf")) {
    return new NextResponse("Bad Request", { status: 400 });
  }

  const s3Url = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${S3_PREFIX}${encodeURIComponent(filename)}`;

  try {
    const s3Response = await fetch(s3Url);

    if (!s3Response.ok) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const headers = new Headers();
    headers.set("Content-Type", "application/pdf");
    headers.set("Content-Disposition", `inline; filename="${filename}"`);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.set("Access-Control-Allow-Origin", "*");

    const contentLength = s3Response.headers.get("Content-Length");
    if (contentLength) headers.set("Content-Length", contentLength);

    return new NextResponse(s3Response.body, { status: 200, headers });
  } catch {
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export const GET = withApiErrorNotify(getHandler);
