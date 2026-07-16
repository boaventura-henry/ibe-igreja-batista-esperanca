"use client";

import { useEffect, useState } from "react";
import type { PushStatus } from "@/types";

const inputClass = "rounded-md border border-hope-100 px-3 py-2 text-sm font-semibold text-ink-800";

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(window.atob(base64), (character) => character.charCodeAt(0));
}

function browserSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && window.isSecureContext;
}

export function PushNotificationManager() {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [deviceSubscribed, setDeviceSubscribed] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadStatus() {
    const response = await fetch("/api/push/status", { cache: "no-store" });
    const payload = await response.json() as { success: boolean; data?: PushStatus; error?: { message: string } };
    if (!payload.success || !payload.data) throw new Error(payload.error?.message ?? "Não foi possível consultar as notificações.");
    setStatus(payload.data);
  }

  useEffect(() => {
    setPermission(browserSupported() ? Notification.permission : "unsupported");
    if (browserSupported()) {
      navigator.serviceWorker.getRegistration("/").then((registration) => registration?.pushManager.getSubscription()).then((subscription) => setDeviceSubscribed(Boolean(subscription))).catch(() => setDeviceSubscribed(false));
    }
    loadStatus().catch((error) => setMessage(error instanceof Error ? error.message : "Não foi possível consultar as notificações."));
  }, []);

  async function enable() {
    if (!browserSupported()) {
      setMessage("Este navegador não oferece suporte às notificações push.");
      return;
    }
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      setMessage("As notificações ainda não estão configuradas neste ambiente.");
      return;
    }
    if (!window.confirm("Receba avisos importantes sobre escalas, comunicados e atividades da igreja. Deseja ativar as notificações?")) return;
    setBusy(true);
    setMessage("");
    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") {
        setMessage("A permissão não foi concedida. Libere as notificações nas configurações do navegador para tentar novamente.");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) });
      const response = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint, keys: subscription.toJSON().keys, expirationTime: subscription.expirationTime, deviceName: navigator.platform }) });
      const payload = await response.json() as { success: boolean; error?: { message: string } };
      if (!payload.success) throw new Error(payload.error?.message ?? "Não foi possível ativar as notificações.");
      await loadStatus();
      setDeviceSubscribed(true);
      setMessage("Notificações ativadas neste dispositivo.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível ativar as notificações.");
    } finally {
      setBusy(false);
    }
  }

  async function disableThisDevice() {
    setBusy(true);
    setMessage("");
    try {
      if (browserSupported()) {
        const registration = await navigator.serviceWorker.getRegistration("/");
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) {
          const response = await fetch("/api/push/unsubscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
          const payload = await response.json() as { success: boolean; error?: { message: string } };
          if (!response.ok || !payload.success) throw new Error(payload.error?.message ?? "NÃ£o foi possÃ­vel desativar este dispositivo.");
          await subscription.unsubscribe();
        }
      }
      setDeviceSubscribed(false);
      await loadStatus();
      setMessage("Notificações desativadas neste dispositivo.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível desativar este dispositivo.");
    } finally {
      setBusy(false);
    }
  }

  async function setPreference(pushEnabled: boolean) {
    setBusy(true);
    try {
      const response = await fetch("/api/push/preferences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pushEnabled }) });
      const payload = await response.json() as { success: boolean; error?: { message: string } };
      if (!payload.success) throw new Error(payload.error?.message ?? "Não foi possível salvar a preferência.");
      await loadStatus();
      setMessage(pushEnabled ? "Preferência ativada." : "Preferência desativada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar a preferência.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/push/test", { method: "POST" });
      const payload = await response.json() as { success: boolean; data?: { sent: number; attempted: number }; error?: { message: string } };
      if (!payload.success) throw new Error(payload.error?.message ?? "Não foi possível enviar o teste.");
      setMessage(`Teste enviado para ${payload.data?.sent ?? 0} de ${payload.data?.attempted ?? 0} dispositivo(s).`);
      await loadStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar o teste.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-md border border-hope-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-ink-900">Notificações</h2>
          <p className="mt-1 text-sm text-ink-500">Receba avisos importantes sobre escalas, comunicados e atividades da igreja.</p>
        </div>
        <span className="rounded-full bg-hope-50 px-3 py-1 text-xs font-bold text-hope-700">{permission === "unsupported" ? "Não compatível" : permission === "granted" ? "Permissão concedida" : permission === "denied" ? "Permissão negada" : "Permissão não solicitada"}</span>
      </div>
      {message ? <p className="mt-4 rounded-md bg-hope-50 px-4 py-3 text-sm font-semibold text-ink-800" role="status">{message}</p> : null}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={enable} disabled={busy || permission === "denied"} className={`${inputClass} bg-hope-600 text-white disabled:cursor-not-allowed disabled:opacity-60`}>Ativar notificações</button>
        <button type="button" onClick={disableThisDevice} disabled={busy || !deviceSubscribed} className={`${inputClass} bg-white disabled:cursor-not-allowed disabled:opacity-60`}>Desativar neste dispositivo</button>
        <button type="button" onClick={sendTest} disabled={busy || !status?.pushEnabled || !status.activeDeviceCount} className={`${inputClass} bg-white disabled:cursor-not-allowed disabled:opacity-60`}>Enviar notificação de teste</button>
        <label className="flex items-center gap-3 rounded-md border border-hope-100 px-3 py-2 text-sm font-semibold text-ink-800"><input type="checkbox" checked={status?.pushEnabled ?? false} onChange={(event) => setPreference(event.target.checked)} disabled={busy || !status?.activeDeviceCount} /> Receber notificações push</label>
      </div>
      {status?.devices.length ? <ul className="mt-5 grid gap-2" aria-label="Dispositivos cadastrados">{status.devices.map((device) => <li key={device.id} className="rounded-md border border-hope-100 px-3 py-3 text-sm"><strong>{device.deviceName || "Dispositivo"}</strong><span className="block text-ink-500">Cadastrado em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(device.createdAt))}{device.lastSuccessAt ? ` · Último teste em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(device.lastSuccessAt))}` : ""}</span></li>)}</ul> : <p className="mt-5 text-sm text-ink-500">Nenhum dispositivo está inscrito.</p>}
    </section>
  );
}
