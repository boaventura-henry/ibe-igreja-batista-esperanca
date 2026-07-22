"use client";

import { useEffect, useState } from "react";
import { DashboardCategorySection } from "@/components/dashboard/widgets/DashboardCategorySection";
import type { AdminDashboardResponse } from "@/types";
import type { ApiResponseBody } from "@/types/api";

export function AdminDashboard() {
  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/dashboard/admin", { cache: "no-store" })
      .then(async (response) => (await response.json()) as ApiResponseBody<AdminDashboardResponse>)
      .then((body) => {
        if (!active) return;
        if (body.success) setData(body.data);
        else setMessage(body.error.message);
      })
      .catch(() => { if (active) setMessage("Nao foi possivel carregar o dashboard."); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, []);

  if (isLoading) return <div className="rounded-md border border-hope-100 bg-white p-5 text-sm font-semibold text-ink-600 shadow-sm">Carregando indicadores...</div>;
  if (message || !data) return <div className="rounded-md border border-red-100 bg-red-50 p-5 text-sm font-semibold text-red-700">{message || "Dashboard indisponivel."}</div>;
  if (data.categories.length === 0) return <div className="rounded-md border border-hope-100 bg-white p-5 text-sm font-semibold text-ink-600 shadow-sm">Seu perfil nao possui cards administrativos disponiveis.</div>;

  return <div className="grid gap-8">{data.categories.map((category) => <DashboardCategorySection key={category.code} category={category} layout={data.layout} />)}</div>;
}
