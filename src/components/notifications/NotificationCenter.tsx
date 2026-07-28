"use client";

import { NotificationType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FormMessage } from "@/components/ui/FormMessage";
import { notifyNotificationStateChanged } from "@/lib/notification-events";
import { NOTIFICATION_CATALOG } from "@/lib/notification-catalog";
import type {
  ApiResponseBody,
  EffectiveNotificationPreference,
  NotificationListResult,
  NotificationPreferenceResult,
  NotificationStatusFilter,
  NotificationSummary
} from "@/types";


const inputClass =
  "w-full rounded-md border border-hope-100 bg-white px-3 py-2 text-sm text-ink-900 focus:border-hope-500 focus:outline-none focus:ring-2 focus:ring-hope-100";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo"
  }).format(new Date(value));
}

function safeActionUrl(value: string | null) {
  return Boolean(value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\"));
}

export function NotificationCenter() {
  const router = useRouter();
  const [activeView, setActiveView] = useState<"notifications" | "preferences">("notifications");
  const [status, setStatus] = useState<NotificationStatusFilter>("all");
  const [type, setType] = useState<NotificationType | "">("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<NotificationListResult | null>(null);
  const [preferences, setPreferences] = useState<EffectiveNotificationPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "10",
        status
      });
      if (type) params.set("type", type);
      const response = await fetch(`/api/notifications?${params.toString()}`, {
        cache: "no-store"
      });
      const body = (await response.json()) as ApiResponseBody<NotificationListResult>;
      if (!response.ok || !body.success) {
        throw new Error(body.success ? "Falha ao carregar notificacoes." : body.error.message);
      }
      setData(body.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao carregar notificacoes.");
    } finally {
      setLoading(false);
    }
  }, [page, status, type]);

  const loadPreferences = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/notification-preferences", { cache: "no-store" });
      const body = (await response.json()) as ApiResponseBody<NotificationPreferenceResult>;
      if (!response.ok || !body.success) {
        throw new Error(body.success ? "Falha ao carregar preferencias." : body.error.message);
      }
      setPreferences(body.data.preferences);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao carregar preferencias.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeView === "notifications") void loadNotifications();
    else void loadPreferences();
  }, [activeView, loadNotifications, loadPreferences]);

  async function markRead(notification: NotificationSummary, navigate = false) {
    if (!notification.readAt) {
      const response = await fetch(`/api/notifications/${notification.id}/read`, {
        method: "PATCH"
      });
      if (!response.ok) {
        setMessage("Nao foi possivel marcar a notificacao como lida.");
        return;
      }
      notifyNotificationStateChanged();
      await loadNotifications();
    }
    if (navigate && safeActionUrl(notification.actionUrl)) {
      router.push(notification.actionUrl as string);
    }
  }

  async function markAllRead() {
    const response = await fetch("/api/notifications/read-all", { method: "PATCH" });
    if (!response.ok) {
      setMessage("Nao foi possivel marcar todas as notificacoes como lidas.");
      return;
    }
    notifyNotificationStateChanged();
    await loadNotifications();
  }

  async function remove(notification: NotificationSummary) {
    const response = await fetch(`/api/notifications/${notification.id}`, { method: "DELETE" });
    if (!response.ok) {
      setMessage("Nao foi possivel remover a notificacao.");
      return;
    }
    notifyNotificationStateChanged();
    await loadNotifications();
  }

  async function savePreferences() {
    setSavingPreferences(true);
    setMessage("");
    setSuccessMessage("");
    try {
      const response = await fetch("/api/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferences: preferences.map((preference) => ({
            type: preference.type,
            inAppEnabled: preference.inAppEnabled,
            reminderHoursBefore:
              NOTIFICATION_CATALOG[preference.type].supportsReminder
                ? preference.reminderHoursBefore
                : null
          }))
        })
      });
      const body = (await response.json()) as ApiResponseBody<NotificationPreferenceResult>;
      if (!response.ok || !body.success) {
        throw new Error(body.success ? "Falha ao salvar preferencias." : body.error.message);
      }
      setPreferences(body.data.preferences);
      setSuccessMessage("Preferencias salvas.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao salvar preferencias.");
    } finally {
      setSavingPreferences(false);
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Central de notificacoes">
        <button
          type="button"
          role="tab"
          aria-selected={activeView === "notifications"}
          onClick={() => setActiveView("notifications")}
          className={`rounded-md px-4 py-2 text-sm font-bold ${
            activeView === "notifications"
              ? "bg-hope-600 text-white"
              : "border border-hope-100 bg-white text-ink-700"
          }`}
        >
          Notificacoes
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeView === "preferences"}
          onClick={() => setActiveView("preferences")}
          className={`rounded-md px-4 py-2 text-sm font-bold ${
            activeView === "preferences"
              ? "bg-hope-600 text-white"
              : "border border-hope-100 bg-white text-ink-700"
          }`}
        >
          Preferencias
        </button>
      </div>

      <FormMessage id="notification-error">{message}</FormMessage>
      <FormMessage id="notification-success" tone="success">
        {successMessage}
      </FormMessage>

      {activeView === "notifications" ? (
        <>
          <div className="flex flex-col gap-3 rounded-md border border-hope-100 bg-white p-4 sm:flex-row sm:items-end">
            <label className="grid flex-1 gap-1 text-xs font-bold uppercase tracking-wide text-ink-500">
              Status
              <select
                className={inputClass}
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as NotificationStatusFilter);
                  setPage(1);
                }}
              >
                <option value="all">Todas</option>
                <option value="unread">Nao lidas</option>
                <option value="read">Lidas</option>
              </select>
            </label>
            <label className="grid flex-1 gap-1 text-xs font-bold uppercase tracking-wide text-ink-500">
              Tipo
              <select
                className={inputClass}
                value={type}
                onChange={(event) => {
                  setType(event.target.value as NotificationType | "");
                  setPage(1);
                }}
              >
                <option value="">Todos</option>
                {Object.values(NotificationType).map((option) => (
                  <option key={option} value={option}>
                    {NOTIFICATION_CATALOG[option].label}
                  </option>
                ))}
              </select>
            </label>
            {data?.unreadCount ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="rounded-md border border-hope-100 px-4 py-2 text-sm font-bold text-hope-700 hover:bg-hope-50"
              >
                Marcar todas como lidas
              </button>
            ) : null}
          </div>

          {loading ? (
            <div className="rounded-md border border-hope-100 bg-white p-8 text-center text-sm text-ink-500">
              Carregando...
            </div>
          ) : data?.notifications.length ? (
            <div className="grid gap-3">
              {data.notifications.map((notification) => (
                <article
                  key={notification.id}
                  className={`rounded-md border p-4 ${
                    notification.readAt
                      ? "border-hope-100 bg-white"
                      : "border-hope-200 bg-hope-50/60"
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {!notification.readAt ? (
                          <span className="rounded-full bg-hope-600 px-2 py-0.5 text-[11px] font-bold text-white">
                            Nao lida
                          </span>
                        ) : null}
                        <span className="text-xs font-bold uppercase tracking-wide text-hope-700">
                          {NOTIFICATION_CATALOG[notification.type].label}
                        </span>
                      </div>
                      <h2 className="mt-2 break-words text-base font-bold text-ink-900">
                        {notification.title}
                      </h2>
                      <p className="mt-1 break-words text-sm leading-6 text-ink-600">
                        {notification.message}
                      </p>
                      <p className="mt-2 text-xs text-ink-500">
                        {formatDate(notification.sentAt ?? notification.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {!notification.readAt ? (
                        <button
                          type="button"
                          onClick={() => void markRead(notification)}
                          className="rounded-md border border-hope-100 px-3 py-2 text-xs font-bold text-hope-700"
                        >
                          Marcar como lida
                        </button>
                      ) : null}
                      {safeActionUrl(notification.actionUrl) ? (
                        <button
                          type="button"
                          onClick={() => void markRead(notification, true)}
                          className="rounded-md bg-hope-600 px-3 py-2 text-xs font-bold text-white"
                        >
                          Abrir
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void remove(notification)}
                        className="rounded-md border border-red-200 px-3 py-2 text-xs font-bold text-red-700"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-hope-100 bg-white p-8 text-center text-sm text-ink-500">
              Nenhuma notificacao encontrada.
            </div>
          )}

          {data && data.pagination.totalPages > 1 ? (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-md border border-hope-100 px-4 py-2 text-sm font-bold disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="text-sm text-ink-500">
                Pagina {page} de {data.pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-md border border-hope-100 px-4 py-2 text-sm font-bold disabled:opacity-40"
              >
                Proxima
              </button>
            </div>
          ) : null}
        </>
      ) : loading ? (
        <div className="rounded-md border border-hope-100 bg-white p-8 text-center text-sm text-ink-500">
          Carregando...
        </div>
      ) : (
        <div className="grid gap-4 rounded-md border border-hope-100 bg-white p-4 sm:p-5">
          {preferences.map((preference) => (
            <div
              key={preference.type}
              className="flex flex-col gap-3 border-b border-hope-100 pb-4 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <label className="flex items-center gap-3 text-sm font-bold text-ink-900">
                <input
                  type="checkbox"
                  checked={preference.inAppEnabled}
                  onChange={(event) =>
                    setPreferences((current) =>
                      current.map((item) =>
                        item.type === preference.type
                          ? { ...item, inAppEnabled: event.target.checked }
                          : item
                      )
                    )
                  }
                />
                {NOTIFICATION_CATALOG[preference.type].label}
              </label>
              {NOTIFICATION_CATALOG[preference.type].supportsReminder ? (
                <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-ink-500 sm:w-48">
                  Antecedencia
                  <select
                    className={inputClass}
                    value={preference.reminderHoursBefore ?? 24}
                    onChange={(event) =>
                      setPreferences((current) =>
                        current.map((item) =>
                          item.type === preference.type
                            ? { ...item, reminderHoursBefore: Number(event.target.value) }
                            : item
                        )
                      )
                    }
                  >
                    <option value={24}>24 horas</option>
                    <option value={48}>48 horas</option>
                    <option value={72}>72 horas</option>
                  </select>
                </label>
              ) : null}
            </div>
          ))}
          <div className="flex justify-end">
            <button
              type="button"
              disabled={savingPreferences}
              onClick={() => void savePreferences()}
              className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {savingPreferences ? "Salvando..." : "Salvar preferencias"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
