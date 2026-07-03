"use client";

import { useEffect, useState } from "react";
import type { MemberContributionListResult } from "@/types";

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

  useEffect(() => {
    fetch("/api/portal/my-contributions", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: ApiResponse<MemberContributionListResult>) => {
        if (payload.success) setData(payload.data);
        else setMessage(payload.error.message);
      })
      .catch(() => setMessage("Nao foi possivel carregar suas contribuicoes."));
  }, []);

  if (message) {
    return <p className="rounded-md border border-hope-100 bg-white p-4 text-sm font-semibold text-ink-700">{message}</p>;
  }

  return (
    <div className="overflow-hidden rounded-md border border-hope-100 bg-white shadow-sm">
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
