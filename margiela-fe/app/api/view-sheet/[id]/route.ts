import { NextRequest, NextResponse } from "next/server";
import { checkDeviceAllowed } from "@/lib/device-guard";
import { getPdfUrlFromDb } from "@/lib/db";
import { toProxyPdfUrl } from "@/lib/pdf-proxy";
import { withApiErrorNotify } from "@/lib/with-api-error-notify";

/**
 * GET /api/view-sheet/[id]
 * Returns { pdfUrl } only if the request has a registered device (X-Device-ID).
 * QR code → /view/[id] page → calls this API with X-Device-ID header → device check.
 */
async function getHandler(
  request: NextRequest,
  context?: { params?: Promise<{ id: string }> }
) {
  const deviceError = await checkDeviceAllowed(request.headers);
  if (deviceError) return deviceError;

  const { id } = await (context?.params ?? Promise.resolve({ id: "" }));
  if (!id) {
    return NextResponse.json({ error: "Missing composition ID" }, { status: 400 });
  }

  const storedUrl = await getPdfUrlFromDb(id);
  if (!storedUrl) {
    return NextResponse.json(
      { error: "PDF not available for this sheet" },
      { status: 404 }
    );
  }

  const pdfUrl = toProxyPdfUrl(storedUrl);
  return NextResponse.json({ pdfUrl });
}

export const GET = withApiErrorNotify(getHandler);
