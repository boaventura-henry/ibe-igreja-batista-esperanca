"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  NOTIFICATIONS_CHANGED_EVENT,
  notifyNotificationStateChanged
} from "@/lib/notification-events";
import {
  refreshUnreadNotificationCount,
  useUnreadNotificationCount
} from "@/hooks/useUnreadNotificationCount";
import type { ApiResponseBody, NotificationListResult, NotificationSummary } from "@/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo"
  }).format(new Date(value));
}

function safeActionUrl(value: string | null) {
  return Boolean(value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\"));
}

let previewRequest: Promise<NotificationListResult> | null = null;

function fetchNotificationPreview() {
  if (!previewRequest) {
    previewRequest = fetch("/api/notifications?page=1&pageSize=5&status=all", {
      cache: "no-store"
    })
      .then(async (response) => {
        const body = (await response.json()) as ApiResponseBody<NotificationListResult>;
        if (!response.ok || !body.success) {
          throw new Error(body.success ? "Falha ao carregar notificacoes." : body.error.message);
        }
        return body.data;
      })
      .finally(() => {
        previewRequest = null;
      });
  }

  return previewRequest;
}

export function NotificationBell({ centerHref }: { centerHref: string }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotificationListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { count: unreadCount } = useUnreadNotificationCount();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchNotificationPreview());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar notificacoes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
  }, [load]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        void refreshUnreadNotificationCount("interaction");
      }
    }

    if (open) document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  async function markRead(notification: NotificationSummary) {
    if (!notification.readAt) {
      const response = await fetch(`/api/notifications/${notification.id}/read`, {
        method: "PATCH"
      });
      if (!response.ok) return;
      notifyNotificationStateChanged();
    }

    if (safeActionUrl(notification.actionUrl)) {
      setOpen(false);
      router.push(notification.actionUrl as string);
    }
  }

  async function markAllRead() {
    const response = await fetch("/api/notifications/read-all", { method: "PATCH" });
    if (response.ok) notifyNotificationStateChanged();
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={`Notificacoes${unreadCount ? `, ${unreadCount} nao lidas` : ""}`}
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
          void refreshUnreadNotificationCount("interaction");
          if (!open) void load();
        }}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-md border border-hope-100 bg-white text-xl text-ink-700 transition hover:bg-hope-50 hover:text-hope-700"
      >
        <span aria-hidden="true">{"\u{1F514}"}</span>
        {unreadCount ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-[11px] font-bold leading-5 text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed left-4 right-4 top-16 z-50 max-h-[75vh] overflow-hidden rounded-md border border-hope-100 bg-white shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96">
          <div className="flex items-center justify-between gap-3 border-b border-hope-100 px-4 py-3">
            <h2 className="text-sm font-bold text-ink-900">Notificacoes</h2>
            {unreadCount ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs font-bold text-hope-700 hover:underline"
              >
                Marcar todas como lidas
              </button>
            ) : null}
          </div>

          <div className="max-h-[55vh] overflow-y-auto">
            {loading ? (
              <p className="p-4 text-sm text-ink-500">Carregando...</p>
            ) : error ? (
              <div className="grid gap-2 p-4 text-sm">
                <p className="text-red-700">{error}</p>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="w-fit font-bold text-hope-700 hover:underline"
                >
                  Tentar novamente
                </button>
              </div>
            ) : data?.notifications.length ? (
              <div className="divide-y divide-hope-100">
                {data.notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => void markRead(notification)}
                    className={`block w-full px-4 py-3 text-left transition hover:bg-hope-50 ${
                      notification.readAt ? "bg-white" : "bg-hope-50/70"
                    }`}
                  >
                    <span className="flex items-start gap-2">
                      {!notification.readAt ? (
                        <span
                          aria-label="Nao lida"
                          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-hope-600"
                        />
                      ) : null}
                      <span className="min-w-0">
                        <span className="block break-words text-sm font-bold text-ink-900">
                          {notification.title}
                        </span>
                        <span className="mt-1 block break-words text-xs leading-5 text-ink-600">
                          {notification.message}
                        </span>
                        <span className="mt-1 block text-[11px] text-ink-500">
                          {formatDate(notification.sentAt ?? notification.createdAt)}
                        </span>
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="p-6 text-center text-sm text-ink-500">Nenhuma notificacao.</p>
            )}
          </div>

          <div className="border-t border-hope-100 p-3">
            <Link
              href={centerHref}
              onClick={() => {
                setOpen(false);
                void refreshUnreadNotificationCount("interaction");
              }}
              className="block rounded-md px-3 py-2 text-center text-sm font-bold text-hope-700 hover:bg-hope-50"
            >
              Ver todas as notificacoes
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
