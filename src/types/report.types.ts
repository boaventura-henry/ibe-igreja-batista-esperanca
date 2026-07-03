export type ReportExportFormat = "view" | "pdf" | "xlsx" | "csv";

export type ReportKey =
  | "members"
  | "ministries"
  | "schedules"
  | "events"
  | "financial";

export type ReportColumn = {
  key: string;
  label: string;
};

export type ReportFilterField = {
  name: string;
  label: string;
  type: "text" | "date" | "select";
  options?: Array<{ label: string; value: string }>;
};

export type ReportDefinition = {
  key: ReportKey;
  title: string;
  module: string;
  description: string;
  endpoint: string;
  columns: ReportColumn[];
  filters: ReportFilterField[];
};

export type ReportCatalogGroup = {
  module: string;
  reports: ReportDefinition[];
};

export type ReportPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ReportViewResult = {
  title: string;
  columns: ReportColumn[];
  rows: Array<Record<string, string>>;
  pagination: ReportPagination;
};

export type ReportFileResult = {
  filename: string;
  contentType: string;
  body: Uint8Array;
};

export type ReportRunResult = ReportViewResult | ReportFileResult;
