import { NextRequest, NextResponse } from "next/server";
import { withApiErrorNotify } from "@/lib/with-api-error-notify";

/**
 * GET /api/test-error
 * Always returns 500 for testing Slack API error notifications.
 * Remove or protect in production if needed.
 */
async function getHandler(_request: NextRequest) {
  return NextResponse.json(
    { error: "Test error for Slack webhook" },
    { status: 500 }
  );
}

export const GET = withApiErrorNotify(getHandler);
