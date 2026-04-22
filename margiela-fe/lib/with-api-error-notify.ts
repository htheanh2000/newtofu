import { NextRequest, NextResponse } from "next/server";
import { notifySlackOfApiError } from "@/lib/slack-notify";

type RouteHandler<T = unknown> = (
  req: NextRequest,
  context?: T
) => Promise<NextResponse> | NextResponse;

const SKIP_SLACK_HEADER = "X-E2E-Warmup";

/**
 * Wraps an API route handler: on 5xx response or thrown error, notifies Slack (fire-and-forget).
 * If Slack fails, the API response is unchanged – notification never blocks or breaks the API.
 * Skips Slack when X-E2E-Warmup header is present (Neon warmup cron).
 */
export function withApiErrorNotify<T>(handler: RouteHandler<T>): RouteHandler<T> {
  return async (req: NextRequest, context?: T) => {
    const skipSlack = req.headers.get(SKIP_SLACK_HEADER) === "true";
    try {
      const res = await handler(req, context);
      if (res && res.status >= 500 && !skipSlack) {
        notifySlackOfApiError(new Error(`API returned ${res.status}`), {
          path: req.nextUrl?.pathname,
          method: req.method,
          status: res.status,
        });
      }
      return res;
    } catch (err) {
      if (!skipSlack) {
        notifySlackOfApiError(err, {
          path: req.nextUrl?.pathname,
          method: req.method,
        });
      }
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}
