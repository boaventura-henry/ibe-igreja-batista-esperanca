"use client";

import { useEffect, useState } from "react";
import type { MemberContributionListResult, ReportExportFormat } from "@/types";

type ApiResponse<T> = ({ success: true; data: T } & T) | { success: false; error: { code: string; message: string } };

function currency(value: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

function date(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value));
}

export function MemberContributionManager() {
  const [data, setData] = useState<MemberContributionListResult | null>(null);
  const [message, setMessage] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetch("/api/portal/my-contributions", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: ApiResponse<MemberContributionListResult>) => {
        if (payload.success) setData(payload.data);
        else setMessage(payload.error.message);
      })
      .catch(() => setMessage("Nao foi possivel carregar suas contribuicoes."));
  }, []);

  async function exportFile(format: Exclude<ReportExportFormat, "view">) {
    setIsExporting(true);
    setMessage("");

    try {
      const response = await fetch("/api/portal/my-contributions/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exportFormat: format })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: { message?: string } };
        setMessage(payload.error?.message ?? "Nao foi possivel exportar suas contribuicoes.");
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        response.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? `minhas_contribuicoes.${format}`;
      link.click();
      window.URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }

  if (message) {
    return <p className="rounded-md border border-hope-100 bg-white p-4 text-sm font-semibold text-ink-700">{message}</p>;
  }

  return (
    <div className="overflow-hidden rounded-md border border-hope-100 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hope-100 p-4">
        <div>
          <h2 className="text-sm font-bold text-ink-900">Minhas contribuicoes</h2>
          <p className="text-xs text-ink-500">Exportacao limitada ao seu cadastro vinculado.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["pdf", "xlsx", "csv"] as const).map((format) => (
            <button
              key={format}
              type="button"
              onClick={() => exportFile(format)}
              disabled={isExporting || !data?.contributions.length}
              className="rounded-md border border-hope-100 px-3 py-2 text-xs font-bold uppercase text-ink-700 disabled:opacity-50"
            >
              {isExporting ? "Exportando..." : format}
            </button>
          ))}
        </div>
      </div>
      {data?.contributions.length === 0 ? <p className="p-5 text-sm font-semibold text-ink-600">Nenhuma contribuicao confirmada para exibir.</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-hope-50 text-xs uppercase text-ink-500"><tr><th className="px-4 py-3">Data</th><th>Categoria</th><th>Valor</th><th>Forma</th><th>Status</th></tr></thead>
          <tbody>
            {data?.contributions.map((contribution) => (
              <tr key={contribution.id} className="border-t border-hope-100">
                <td className="px-4 py-3">{date(contribution.launchDate)}</td>
                <td>{contribution.category}</td>
                <td className="font-bold text-hope-700">{currency(contribution.amount)}</td>
                <td>{contribution.paymentMethod}</td>
                <td>{contribution.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
