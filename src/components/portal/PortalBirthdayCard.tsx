"use client";

import { useEffect, useState } from "react";
import { BirthdayMonthCard, CopyBirthdayButton, TodayBirthdayCard, UpcomingBirthdaysCard } from "@/components/dashboard/BirthdayCard";
import type { BirthdayDashboardData } from "@/types";
import type { ApiResponseBody } from "@/types/api";

export function PortalBirthdayCard() {
  const [data, setData] = useState<BirthdayDashboardData | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/portal/birthdays", { cache: "no-store" })
      .then(async (response) => (await response.json()) as ApiResponseBody<BirthdayDashboardData>)
      .then((body) => body.success ? setData(body.data) : setMessage(body.error.message))
      .catch(() => setMessage("Não foi possível carregar os aniversariantes."));
  }, []);

  if (message) return <div className="rounded-md border border-red-100 bg-red-50 p-5 text-sm font-semibold text-red-700">{message}</div>;
  if (!data) return <div className="rounded-md border border-hope-100 bg-white p-5 text-sm font-semibold text-ink-600 shadow-sm">Carregando aniversariantes...</div>;

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <TodayBirthdayCard people={data.today} />
        <UpcomingBirthdaysCard people={data.upcoming} />
      </div>
      <BirthdayMonthCard data={data} />
    </div>
  );
}

export { CopyBirthdayButton };
