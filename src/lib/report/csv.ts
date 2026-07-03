import type { ReportColumn } from "@/types";

function escapeCsv(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export function generateCsv(columns: ReportColumn[], rows: Array<Record<string, string>>) {
  const lines = [
    columns.map((column) => escapeCsv(column.label)).join(","),
    ...rows.map((row) => columns.map((column) => escapeCsv(row[column.key] ?? "")).join(","))
  ];

  return new TextEncoder().encode(`\uFEFF${lines.join("\r\n")}`);
}
