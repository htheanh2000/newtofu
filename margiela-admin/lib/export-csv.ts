/**
 * Build CSV string from rows and column definitions, then trigger download.
 * Escapes double quotes in cell values.
 */
export function downloadCSV<T>(
  filename: string,
  rows: T[],
  columns: { key: string; header: string; getValue: (row: T) => string }[],
): void {
  const header = columns.map((c) => escapeCSVCell(c.header)).join(",");
  const body = rows.map((row) =>
    columns.map((c) => escapeCSVCell(c.getValue(row))).join(","),
  );
  const csv = [header, ...body].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCSVCell(value: string): string {
  const s = String(value ?? "");
  if (s.includes('"') || s.includes(",") || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
