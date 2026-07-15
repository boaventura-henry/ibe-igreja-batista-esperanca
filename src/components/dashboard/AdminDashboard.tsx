"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StatCard } from "@/components/StatCard";
import { BirthdayCard } from "@/components/dashboard/BirthdayCard";
import type { AdminDashboardData } from "@/types";
import type { ApiResponseBody } from "@/types/api";

function formatCurrency(value: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Number(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value));
}

function formatTimeRange(startTime: string | null, endTime: string | null) {
  const values = [startTime, endTime].filter(Boolean);

  return values.length > 0 ? values.join(" - ") : "Horario nao informado";
}

export function AdminDashboard() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      setIsLoading(true);
      setMessage("");

      const response = await fetch("/api/dashboard/admin", { cache: "no-store" });
      const body = (await response.json()) as ApiResponseBody<AdminDashboardData>;

      if (!isMounted) {
        return;
      }

      if (!body.success) {
        setMessage(body.error.message);
        setData(null);
      } else {
        setData(body.data);
      }

      setIsLoading(false);
    }

    loadDashboard().catch(() => {
      if (isMounted) {
        setMessage("Nao foi possivel carregar o dashboard.");
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return <div className="rounded-md border border-hope-100 bg-white p-5 text-sm font-semibold text-ink-600 shadow-sm">Carregando indicadores...</div>;
  }

  if (message || !data) {
    return <div className="rounded-md border border-red-100 bg-red-50 p-5 text-sm font-semibold text-red-700">{message || "Dashboard indisponivel."}</div>;
  }

  return (
    <div className="grid gap-6">
      <BirthdayCard endpoint="/api/dashboard/birthdays" />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Membros ativos" value={String(data.activeMembers)} detail="Cadastros ativos e nao deletados" />
        <StatCard label="Novos membros no mes" value={String(data.newMembersThisMonth)} detail="Com base na data de criacao" />
        <StatCard label="Entradas do mes" value={formatCurrency(data.monthlyIncome)} detail="Lancamentos confirmados" />
        <StatCard label="Saldo do mes" value={formatCurrency(data.monthlyBalance)} detail={`${formatCurrency(data.monthlyIncome)} - ${formatCurrency(data.monthlyExpense)}`} />
        <StatCard label="Comunicados publicados" value={String(data.publishedAnnouncements)} detail="Publicados e nao deletados" />
        <StatCard label="Comunicados ativos" value={String(data.activeAnnouncements)} detail="Visiveis no portal agora" />
        <StatCard label="Comunicados fixados" value={String(data.pinnedAnnouncements)} detail="Destaques ativos no portal" />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-md border border-hope-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-hope-100 pb-3">
            <div>
              <h2 className="text-lg font-bold text-ink-900">Proximos eventos</h2>
              <p className="text-sm text-ink-500">{data.upcomingEvents.length} evento(s) publicado(s)</p>
            </div>
            <Link href="/eventos" className="rounded-md border border-hope-100 px-3 py-2 text-xs font-bold text-ink-700">Ver eventos</Link>
          </div>
          <div className="mt-4 divide-y divide-hope-100">
            {data.upcomingEvents.length === 0 ? <p className="py-4 text-sm font-semibold text-ink-500">Nenhum evento publicado futuro.</p> : null}
            {data.upcomingEvents.map((event) => (
              <div key={event.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-ink-900">{event.title}</p>
                  <p className="text-sm text-ink-500">{event.location || "Local nao informado"}</p>
                </div>
                <span className="text-sm font-semibold text-hope-700">{formatDate(event.startDate)} - {event.startTime || "Horario nao informado"}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-hope-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-hope-100 pb-3">
            <div>
              <h2 className="text-lg font-bold text-ink-900">Proximas escalas</h2>
              <p className="text-sm text-ink-500">{data.upcomingSchedules.length} escala(s) futura(s)</p>
            </div>
            <Link href="/escalas" className="rounded-md border border-hope-100 px-3 py-2 text-xs font-bold text-ink-700">Ver escalas</Link>
          </div>
          <div className="mt-4 divide-y divide-hope-100">
            {data.upcomingSchedules.length === 0 ? <p className="py-4 text-sm font-semibold text-ink-500">Nenhuma escala futura encontrada.</p> : null}
            {data.upcomingSchedules.map((schedule) => (
              <div key={schedule.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-ink-900">{schedule.title}</p>
                  <p className="text-sm text-ink-500">{schedule.ministry.name} - {schedule.location || "Local nao informado"}</p>
                </div>
                <span className="text-sm font-semibold text-hope-700">{formatDate(schedule.date)} - {formatTimeRange(schedule.startTime, schedule.endTime)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1.3fr]">
        <div className="rounded-md border border-hope-100 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-ink-900">Resumo financeiro do mes</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div className="flex items-center justify-between rounded-md bg-hope-50 px-3 py-3">
              <dt className="font-semibold text-ink-600">Entradas</dt>
              <dd className="font-bold text-emerald-700">{formatCurrency(data.monthlyIncome)}</dd>
            </div>
            <div className="flex items-center justify-between rounded-md bg-hope-50 px-3 py-3">
              <dt className="font-semibold text-ink-600">Saidas</dt>
              <dd className="font-bold text-red-700">{formatCurrency(data.monthlyExpense)}</dd>
            </div>
            <div className="flex items-center justify-between rounded-md bg-hope-50 px-3 py-3">
              <dt className="font-semibold text-ink-600">Saldo</dt>
              <dd className="font-bold text-hope-700">{formatCurrency(data.monthlyBalance)}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-md border border-hope-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-hope-100 pb-3">
            <div>
              <h2 className="text-lg font-bold text-ink-900">Ultimas contribuicoes</h2>
              <p className="text-sm text-ink-500">Entradas recentes confirmadas</p>
            </div>
            <Link href="/financeiro/lancamentos" className="rounded-md border border-hope-100 px-3 py-2 text-xs font-bold text-ink-700">Ver lancamentos</Link>
          </div>
          <div className="mt-4 divide-y divide-hope-100">
            {data.latestContributions.length === 0 ? <p className="py-4 text-sm font-semibold text-ink-500">Nenhuma contribuicao confirmada encontrada.</p> : null}
            {data.latestContributions.map((contribution) => (
              <div key={contribution.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-ink-900">{contribution.member?.displayName ?? "Contribuinte anonimo"}</p>
                  <p className="text-sm text-ink-500">{contribution.category.name} - #{contribution.entryNumber}</p>
                </div>
                <span className="text-sm font-semibold text-hope-700">{formatCurrency(contribution.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
