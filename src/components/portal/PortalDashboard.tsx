"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MemberLinkRequired } from "@/components/portal/MemberLinkRequired";
import type { PortalDashboardData } from "@/types";
import type { ApiResponseBody } from "@/types/api";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value));
}

function formatTimeRange(startTime: string | null, endTime: string | null) {
  const values = [startTime, endTime].filter(Boolean);

  return values.length > 0 ? values.join(" - ") : "Horario nao informado";
}

export function PortalDashboard() {
  const [data, setData] = useState<PortalDashboardData | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      setIsLoading(true);
      setMessage("");

      const response = await fetch("/api/dashboard/portal", { cache: "no-store" });
      const body = (await response.json()) as ApiResponseBody<PortalDashboardData>;

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
        setMessage("Nao foi possivel carregar o portal.");
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return <div className="rounded-md border border-hope-100 bg-white p-5 text-sm font-semibold text-ink-600 shadow-sm">Carregando seu painel...</div>;
  }

  if (message || !data) {
    return <div className="rounded-md border border-red-100 bg-red-50 p-5 text-sm font-semibold text-red-700">{message || "Portal indisponivel."}</div>;
  }

  if (data.userWithoutMember) {
    return <MemberLinkRequired />;
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <section className="rounded-md border border-hope-100 bg-white p-5 shadow-sm lg:col-span-2">
        <div className="flex items-center justify-between gap-3 border-b border-hope-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-ink-900">Proxima escala</h2>
            <p className="text-xs text-ink-500">Seu proximo compromisso ministerial</p>
          </div>
          <Link href="/portal/minhas-escalas" className="rounded-md border border-hope-100 px-3 py-2 text-xs font-bold text-ink-700">Ver todas</Link>
        </div>
        {data.nextSchedule ? (
          <div className="mt-4 rounded-md border border-hope-100 p-4">
            <p className="text-base font-bold text-ink-900">{data.nextSchedule.title}</p>
            <p className="mt-1 text-sm text-ink-500">{formatDate(data.nextSchedule.date)} - {formatTimeRange(data.nextSchedule.startTime, data.nextSchedule.endTime)}</p>
            <p className="mt-2 text-sm font-semibold text-hope-700">{data.nextSchedule.ministry.name}</p>
            <p className="mt-1 text-xs text-ink-500">{data.nextSchedule.location || "Local nao informado"} - {data.nextSchedule.status}</p>
          </div>
        ) : (
          <p className="mt-4 text-sm font-semibold text-ink-500">Nenhuma escala futura encontrada.</p>
        )}
      </section>

      <section className="rounded-md border border-hope-100 bg-white p-5 shadow-sm">
        <div className="border-b border-hope-100 pb-3">
          <h2 className="text-sm font-bold text-ink-900">Proximo evento</h2>
          <p className="text-xs text-ink-500">Evento publico publicado</p>
        </div>
        {data.nextEvent ? (
          <div className="mt-4 rounded-md border border-hope-100 p-4">
            <p className="text-base font-bold text-ink-900">{data.nextEvent.title}</p>
            <p className="mt-1 text-sm text-ink-500">{formatDate(data.nextEvent.startDate)} - {data.nextEvent.startTime || "Horario nao informado"}</p>
            <p className="mt-2 text-xs text-ink-500">{data.nextEvent.location || "Local nao informado"}</p>
          </div>
        ) : (
          <p className="mt-4 text-sm font-semibold text-ink-500">Nenhum evento publico publicado.</p>
        )}
      </section>

      <section className="rounded-md border border-hope-100 bg-white p-5 shadow-sm lg:col-span-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-ink-900">Avisos recentes</h2>
          <Link href="/portal/avisos" className="rounded-md border border-hope-100 px-3 py-2 text-xs font-bold text-ink-700">Ver avisos</Link>
        </div>
        <div className="mt-3 grid gap-2">
          {data.notices.length === 0 ? <p className="rounded-md bg-hope-50 px-3 py-3 text-sm font-semibold text-ink-600">Nenhum aviso publicado no momento.</p> : null}
          {data.notices.map((notice) => (
            <div key={notice.id} className="rounded-md bg-hope-50 px-3 py-3">
              <div className="flex flex-wrap items-center gap-2">
                {notice.isPinned ? <span className="rounded-md bg-gold-100 px-2 py-1 text-xs font-bold text-ink-800">Fixado</span> : null}
                <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-hope-700">{notice.readAt ? "Lido" : "Novo"}</span>
              </div>
              <p className="mt-2 text-sm font-bold text-ink-900">{notice.title}</p>
              <p className="mt-1 line-clamp-2 text-sm text-ink-600">{notice.content}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
