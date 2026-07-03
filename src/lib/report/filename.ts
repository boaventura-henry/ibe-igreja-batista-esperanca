import type { ReportExportFormat } from "@/types";

export function createReportFilename(reportName: string, format: Exclude<ReportExportFormat, "view">) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toISOString().slice(11, 19).replaceAll(":", "");
  const safeName = reportName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `${safeName}_${date}_${time}.${format}`;
}
