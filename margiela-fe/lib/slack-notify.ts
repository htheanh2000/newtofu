/**
 * Notify Slack when API fails. Fire-and-forget: never throws, never blocks response.
 * If the webhook request fails, it is swallowed so the API continues to work normally.
 */

const WEBHOOK_ENV = "SLACK_WEBHOOK_URL_API_ERROR";

export type ApiErrorContext = {
  path?: string;
  method?: string;
  status?: number;
};

/**
 * Send API error to Slack. Never throws; any failure is logged to console only.
 * Do not await this – call it and return response so the API is not blocked.
 */
export function notifySlackOfApiError(error: unknown, context: ApiErrorContext): void {
  const url = process.env[WEBHOOK_ENV]?.trim();
  if (!url) {
    console.warn("[slack-notify] SLACK_WEBHOOK_URL_API_ERROR not set, skip notification");
    return;
  }

  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
  const path = context.path ?? "?";
  const method = context.method ?? "?";
  const status = context.status ?? "";

  const text = `🔴 *API failed*\n• ${method} \`${path}\`${status ? ` → ${status}` : ""}\n• ${message}`;

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  }).catch(() => {
    // Swallow: do not log to avoid noise; do not throw so API response is unaffected
  });
}
