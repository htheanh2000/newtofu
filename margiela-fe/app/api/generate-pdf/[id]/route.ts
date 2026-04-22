import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetryOnP1001 } from "@/lib/db";
import { withApiErrorNotify } from "@/lib/with-api-error-notify";

// Lambda PDF API base URL (server-side). Prefer PDF_SERVICE_URL (Lambda), fallback to NEXT_PUBLIC_ (legacy).
const PDF_SERVICE_URL =
  process.env.PDF_SERVICE_URL ||
  process.env.NEXT_PUBLIC_PDF_SERVICE_URL ||
  "https://vf4ry4wamhj7zkhzysvdc6oi7y0nzaqn.lambda-url.ap-southeast-1.on.aws";
const PDF_SERVICE_TIMEOUT_MS = 300_000; // 5 min – isolate timeout vs bug (ALB default 60s can cut earlier)

// Allow long-running response (ALB idle timeout should be >= 300s for this route)
export const maxDuration = 300;

const LOG_PREFIX = "[generate-pdf]";

// No device check here: result page must be able to generate PDF and show QR. Device is checked on the view page when someone scans the QR.
async function postHandler(
  request: NextRequest,
  context?: { params?: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  let id: string | undefined;
  try {
    const resolved = await (context?.params ?? Promise.resolve({ id: "" }));
    id = resolved.id;
    const body = await request.json().catch(() => ({}));
    const locale = typeof body.locale === "string" ? body.locale : "en";

    console.log(
      JSON.stringify({
        event: "start",
        route: LOG_PREFIX,
        id,
        locale,
        serviceUrl: PDF_SERVICE_URL,
        timeoutMs: PDF_SERVICE_TIMEOUT_MS,
      })
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PDF_SERVICE_TIMEOUT_MS);

    const response = await fetch(`${PDF_SERVICE_URL}/generate/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    const elapsedMs = Date.now() - startTime;
    console.log(
      JSON.stringify({
        event: "lambda_response",
        route: LOG_PREFIX,
        id,
        status: response.status,
        ok: response.ok,
        elapsedMs,
      })
    );

    if (!response.ok) {
      const errorText = await response.text();
      const isGatewayError = response.status === 502 || response.status === 503 || response.status === 504;
      let errorMessage = isGatewayError ? "PDF service temporarily unavailable. Please try again." : "Failed to generate PDF";
      try {
        const errJson = JSON.parse(errorText);
        if (errJson?.error && typeof errJson.error === "string") {
          errorMessage = errJson.error;
        }
      } catch {
        // use default
      }
      console.error(
        JSON.stringify({
          event: "lambda_error",
          route: LOG_PREFIX,
          id,
          status: response.status,
          isGatewayError,
          errorMessage,
          bodyPreview: errorText.slice(0, 500),
        })
      );
      return NextResponse.json(
        { error: errorMessage },
        { status: isGatewayError ? 503 : response.status }
      );
    }

    const result = await response.json();
    const pdfUrl = result?.pdfUrl;
    console.log(
      JSON.stringify({
        event: "lambda_success",
        route: LOG_PREFIX,
        id,
        pdfUrl: pdfUrl ?? null,
        hasPdfUrl: typeof pdfUrl === "string" && pdfUrl.length > 0,
        elapsedMs: Date.now() - startTime,
      })
    );

    if (typeof pdfUrl === "string" && pdfUrl && process.env.DATABASE_URL?.trim()) {
      try {
        await withRetryOnP1001(() =>
          prisma.composition.update({
            where: { id },
            data: { pdfUrl },
          })
        );
        console.log(
          JSON.stringify({
            event: "db_updated",
            route: LOG_PREFIX,
            id,
            pdfUrl,
          })
        );
      } catch (dbError) {
        console.warn(
          JSON.stringify({
            event: "db_update_failed",
            route: LOG_PREFIX,
            id,
            error: dbError instanceof Error ? dbError.message : String(dbError),
          })
        );
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "AbortError";
    const elapsedMs = Date.now() - startTime;
    console.error(
      JSON.stringify({
        event: "request_failed",
        route: LOG_PREFIX,
        id: id ?? "unknown",
        isTimeout,
        error: error instanceof Error ? error.message : String(error),
        elapsedMs,
      })
    );
    return NextResponse.json(
      { error: isTimeout ? "PDF generation timed out. Please try again." : "Internal server error" },
      { status: isTimeout ? 504 : 500 }
    );
  }
}

export const POST = withApiErrorNotify(postHandler);
