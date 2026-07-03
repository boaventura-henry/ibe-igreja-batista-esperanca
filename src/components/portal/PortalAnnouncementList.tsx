"use client";

import { useEffect, useState } from "react";
import type { AnnouncementSummary, PortalAnnouncementListResult } from "@/types";
import type { ApiResponseBody } from "@/types/api";

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "Publicado";
}

export function PortalAnnouncementList() {
  const [data, setData] = useState<PortalAnnouncementListResult | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadAnnouncements() {
      setIsLoading(true);
      const response = await fetch("/api/portal/announcements", { cache: "no-store" });
      const body = (await response.json()) as ApiResponseBody<PortalAnnouncementListResult>;

      if (!isMounted) return;
      if (!body.success) setMessage(body.error.message);
      else setData(body.data);
      setIsLoading(false);
    }

    loadAnnouncements().catch(() => {
      if (isMounted) {
        setMessage("Nao foi possivel carregar os comunicados.");
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  async function markRead(announcement: AnnouncementSummary) {
    setMessage("");

    try {
      const response = await fetch(`/api/portal/announcements/${announcement.id}/read`, { method: "POST" });
      const body = (await response.json()) as ApiResponseBody<{ id: string; readAt: string }>;

      if (!body.success) throw new Error(body.error.message);
      setData((current) =>
        current
          ? {
              ...current,
              announcements: current.announcements.map((item) =>
                item.id === announcement.id ? { ...item, readAt: body.data.readAt } : item
              )
            }
          : current
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel marcar como lido.");
    }
  }

  if (isLoading) {
    return <div className="rounded-md border border-hope-100 bg-white p-5 text-sm font-semibold text-ink-600 shadow-sm">Carregando comunicados...</div>;
  }

  if (message) {
    return <div className="rounded-md border border-red-100 bg-red-50 p-5 text-sm font-semibold text-red-700">{message}</div>;
  }

  if (!data?.announcements.length) {
    return <div className="rounded-md border border-hope-100 bg-white p-6 text-sm font-semibold text-ink-700 shadow-sm">Nenhum comunicado publicado no momento.</div>;
  }

  return (
    <div className="grid gap-4">
      {data.announcements.map((announcement) => (
        <article key={announcement.id} className={`rounded-md border bg-white p-5 shadow-sm ${announcement.isPinned ? "border-gold-300" : "border-hope-100"}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                {announcement.isPinned ? <span className="rounded-md bg-gold-100 px-2 py-1 text-xs font-bold text-ink-800">Fixado</span> : null}
                <span className="rounded-md bg-hope-50 px-2 py-1 text-xs font-bold text-hope-700">{announcement.readAt ? "Lido" : "Novo"}</span>
              </div>
              <h2 className="mt-3 text-xl font-bold text-ink-900">{announcement.title}</h2>
              <p className="mt-1 text-xs font-semibold text-ink-500">{formatDate(announcement.publishAt)}</p>
            </div>
            {!announcement.readAt ? (
              <button type="button" onClick={() => markRead(announcement)} className="rounded-md border border-hope-100 px-3 py-2 text-xs font-bold text-ink-700">
                Marcar como lido
              </button>
            ) : null}
          </div>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-ink-700">{announcement.content}</p>
          {announcement.externalLink ? (
            <a href={announcement.externalLink} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-sm font-bold text-hope-700 underline">
              Abrir link
            </a>
          ) : null}
        </article>
      ))}
    </div>
  );
}
