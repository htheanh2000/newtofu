const HONG_KONG_TZ = "Asia/Hong_Kong";

/**
 * DB stores createdAt in UTC (timezone 00). Postgres returns "2026-03-13 08:35:10" (no Z).
 * Append Z so JS parses as UTC, then format for Hong Kong.
 */
function parseUtcDate(value: string): Date {
  const s = value.trim().replace(/ /g, "T");
  const hasTz = /[Z+-]\d{2}:?\d{2}$/.test(s);
  return new Date(hasTz ? s : s + "Z");
}

/**
 * Format a date string for display using Hong Kong timezone.
 * DB stores timestamps in UTC.
 */
export function formatCreatedDate(value: string | null | undefined): string {
  if (!value) return "";
  return parseUtcDate(value).toLocaleString(undefined, { timeZone: HONG_KONG_TZ });
}
