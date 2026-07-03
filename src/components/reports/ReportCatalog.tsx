"use client";

import { useEffect, useState } from "react";
import type { ApiResponseBody, ReportCatalogGroup, ReportDefinition, ReportExportFormat, ReportViewResult } from "@/types";

type Filters = Record<string, string>;

function filenameFromHeader(header: string | null, fallback: string) {
  return header?.match(/filename="(.+)"/)?.[1] ?? fallback;
}

export function ReportCatalog() {
  const [groups, setGroups] = useState<ReportCatalogGroup[]>([]);
  const [selected, setSelected] = useState<ReportDefinition | null>(null);
  const [filters, setFilters] = useState<Filters>({});
  const [result, setResult] = useState<ReportViewResult | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    fetch("/api/reports/catalog", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: ApiResponseBody<ReportCatalogGroup[]>) => {
        if (!payload.success) {
          setMessage(payload.error.message);
          return;
        }

        setGroups(payload.data);
        setSelected(payload.data[0]?.reports[0] ?? null);
      })
      .catch(() => setMessage("Nao foi possivel carregar o catalogo de relatorios."))
      .finally(() => setIsLoading(false));
  }, []);

  function chooseReport(report: ReportDefinition) {
    setSelected(report);
    setFilters({});
    setResult(null);
    setMessage("");
  }

  async function run(format: ReportExportFormat, page = 1) {
    if (!selected) return;

    setIsRunning(true);
    setMessage("");

    try {
      const response = await fetch(selected.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exportFormat: format,
          filters,
          page,
          pageSize: 25
        })
      });

      if (format === "view") {
        const payload = (await response.json()) as ApiResponseBody<ReportViewResult>;

        if (!payload.success) {
          setMessage(payload.error.message);
          return;
        }

        setResult(payload.data);
        return;
      }

      if (!response.ok) {
        const payload = (await response.json()) as { error?: { message?: string } };
        setMessage(payload.error?.message ?? "Nao foi possivel exportar o relatorio.");
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameFromHeader(response.headers.get("Content-Disposition"), `relatorio.${format}`);
      link.click();
      window.URL.revokeObjectURL(url);
    } finally {
      setIsRunning(false);
    }
  }

  if (isLoading) {
    return <div className="rounded-md border border-hope-100 bg-white p-5 text-sm font-semibold text-ink-600 shadow-sm">Carregando catalogo...</div>;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
      <aside className="rounded-md border border-hope-100 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-hope-700">Catalogo</h2>
        <div className="mt-4 grid gap-4">
          {groups.map((group) => (
            <section key={group.module}>
              <h3 className="text-xs font-bold uppercase text-ink-500">{group.module}</h3>
              <div className="mt-2 grid gap-2">
                {group.reports.map((report) => (
                  <button
                    key={report.key}
                    type="button"
                    onClick={() => chooseReport(report)}
                    className={`rounded-md px-3 py-2 text-left text-sm font-semibold ${
                      selected?.key === report.key ? "bg-hope-600 text-white" : "bg-hope-50 text-ink-700"
                    }`}
                  >
                    {report.title}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </aside>

      <main className="min-w-0">
        {message ? <p className="mb-4 rounded-md border border-hope-100 bg-white px-4 py-3 text-sm font-semibold text-ink-700">{message}</p> : null}
        {selected ? (
          <section className="rounded-md border border-hope-100 bg-white shadow-sm">
            <div className="border-b border-hope-100 p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-hope-700">{selected.module}</p>
              <h2 className="mt-1 text-2xl font-bold text-ink-900">{selected.title}</h2>
              <p className="mt-1 text-sm text-ink-500">{selected.description}</p>
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
              {selected.filters.map((field) => (
                <label key={field.name} className="grid gap-1 text-sm font-semibold text-ink-700">
                  {field.label}
                  {field.type === "select" ? (
                    <select
                      value={filters[field.name] ?? ""}
                      onChange={(event) => setFilters((current) => ({ ...current, [field.name]: event.target.value }))}
                      className="rounded-md border-hope-100"
                    >
                      <option value="">Todos</option>
                      {field.options?.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      value={filters[field.name] ?? ""}
                      onChange={(event) => setFilters((current) => ({ ...current, [field.name]: event.target.value }))}
                      className="rounded-md border-hope-100"
                    />
                  )}
                </label>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-hope-100 p-5">
              <button disabled={isRunning} onClick={() => run("view")} className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Visualizar</button>
              <button disabled={isRunning} onClick={() => window.print()} className="rounded-md border border-hope-100 px-4 py-2 text-sm font-bold text-ink-700 disabled:opacity-50">Imprimir</button>
              <button disabled={isRunning} onClick={() => run("pdf")} className="rounded-md border border-hope-100 px-4 py-2 text-sm font-bold text-ink-700 disabled:opacity-50">PDF</button>
              <button disabled={isRunning} onClick={() => run("xlsx")} className="rounded-md border border-hope-100 px-4 py-2 text-sm font-bold text-ink-700 disabled:opacity-50">Excel</button>
              <button disabled={isRunning} onClick={() => run("csv")} className="rounded-md border border-hope-100 px-4 py-2 text-sm font-bold text-ink-700 disabled:opacity-50">CSV</button>
            </div>
          </section>
        ) : null}

        {result ? (
          <section className="mt-6 overflow-hidden rounded-md border border-hope-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-hope-100 text-sm">
                <thead className="bg-hope-50 text-xs uppercase text-ink-500">
                  <tr>{result.columns.map((column) => <th key={column.key} className="px-4 py-3 text-left">{column.label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-hope-100">
                  {result.rows.map((row, index) => (
                    <tr key={`${row.id ?? "row"}-${index}`}>
                      {result.columns.map((column) => <td key={column.key} className="px-4 py-3">{row[column.key]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-hope-100 p-4 text-sm font-bold">
              <button disabled={result.pagination.page <= 1} onClick={() => run("view", result.pagination.page - 1)} className="rounded-md border px-3 py-2 disabled:opacity-40">Anterior</button>
              <span>{result.pagination.page} / {result.pagination.totalPages}</span>
              <button disabled={result.pagination.page >= result.pagination.totalPages} onClick={() => run("view", result.pagination.page + 1)} className="rounded-md border px-3 py-2 disabled:opacity-40">Proxima</button>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
