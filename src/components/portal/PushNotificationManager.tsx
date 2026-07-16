"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FormMessage } from "@/components/ui/FormMessage";
import { getNotificationEnvironment, notificationInstructions, type NotificationEnvironment } from "@/utils/notification-environment";
import { PUSH_FAILURE_WARNING_THRESHOLD, type PushDevice, type PushSetupStatus, type PushStatus } from "@/types";

const buttonClass = "min-h-11 rounded-md border border-hope-100 px-4 py-2 text-sm font-bold transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60";

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(window.atob(base64), (character) => character.charCodeAt(0));
}

function browserSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && window.isSecureContext;
}

function formatDate(value: string | null, withTime = false) {
  if (!value) return "Ainda nao realizado";
  return new Intl.DateTimeFormat("pt-BR", withTime ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "short" }).format(new Date(value));
}

function deviceStatus(device: PushDevice) {
  if (device.setupCompletedAt) return "Configurado";
  if (device.failureCount >= PUSH_FAILURE_WARNING_THRESHOLD) return "Precisa de atencao";
  if (device.testSentAt) return "Teste pendente";
  return "Aguardando teste";
}

async function readJSON<T>(response: Response) {
  const payload = await response.json() as { success: boolean; data?: T; error?: { message: string } };
  if (!response.ok || !payload.success) throw new Error(payload.error?.message ?? "Nao foi possivel concluir esta etapa.");
  return payload.data;
}

export function PushNotificationManager() {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [environment, setEnvironment] = useState<NotificationEnvironment>({ operatingSystem: "UNKNOWN", browser: "OTHER", isStandalone: false, isMobile: false });
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [deviceSubscription, setDeviceSubscription] = useState<PushSubscription | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "error" | "success" | "warning" | "info" } | null>(null);

  const currentDevice = status?.devices.find((device) => device.id === deviceId) ?? null;
  const setupStatus = useMemo<PushSetupStatus>(() => {
    if (!browserSupported()) return "UNSUPPORTED";
    if (permission === "denied") return "PERMISSION_DENIED";
    if (permission === "default") return "PERMISSION_REQUIRED";
    if (!deviceSubscription || !currentDevice) return "SUBSCRIPTION_REQUIRED";
    if (currentDevice.setupCompletedAt) return "CONFIRMED";
    if (currentDevice.testSentAt) return "TEST_SENT";
    return "READY_FOR_TEST";
  }, [permission, deviceSubscription, currentDevice]);

  const instructions = notificationInstructions(environment);
  const testFailed = Boolean(currentDevice?.testFailedAt);

  const loadStatus = useCallback(async () => {
    const payload = await readJSON<PushStatus>(await fetch("/api/push/status", { cache: "no-store" }));
    if (payload) setStatus(payload);
  }, []);

  const syncSubscription = useCallback(async (subscription: PushSubscription) => {
    const json = subscription.toJSON();
    if (!subscription.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error("O navegador nao forneceu uma inscricao valida.");
    const data = await readJSON<{ id: string }>(await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint, keys: json.keys, expirationTime: subscription.expirationTime, deviceName: navigator.platform })
    }));
    if (!data?.id) throw new Error("Nao foi possivel registrar este dispositivo.");
    setDeviceId(data.id);
    setDeviceSubscription(subscription);
  }, []);

  useEffect(() => {
    const nextEnvironment = getNotificationEnvironment();
    setEnvironment(nextEnvironment);
    setPermission(browserSupported() ? Notification.permission : "unsupported");
    loadStatus().catch((error) => setMessage({ text: error instanceof Error ? error.message : "Nao foi possivel consultar as notificacoes.", tone: "error" }));
    if (browserSupported()) {
      navigator.serviceWorker.ready.then((registration) => registration.pushManager.getSubscription()).then((subscription) => {
        if (subscription) return syncSubscription(subscription).then(loadStatus);
        return undefined;
      }).catch((error) => setMessage({ text: error instanceof Error ? error.message : "Nao foi possivel verificar este dispositivo.", tone: "error" }));
    }
  }, [loadStatus, syncSubscription]);

  async function enable() {
    if (!browserSupported()) return setMessage({ text: "Este navegador nao oferece suporte a notificacoes push.", tone: "warning" });
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) return setMessage({ text: "As notificacoes ainda nao estao configuradas neste ambiente.", tone: "warning" });
    if (!window.confirm("Para receber avisos, permita que este navegador mostre notificacoes. Deseja continuar?")) return;
    setBusy(true); setMessage(null);
    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") {
        setMessage({ text: "As notificacoes estao bloqueadas neste navegador ou dispositivo.", tone: "warning" });
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
      await syncSubscription(subscription);
      await loadStatus();
      setMessage({ text: "Este dispositivo esta registrado para receber notificacoes.", tone: "success" });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Nao foi possivel ativar as notificacoes.", tone: "error" });
    } finally { setBusy(false); }
  }

  async function sendTest() {
    setBusy(true); setMessage(null);
    try {
      await readJSON(await fetch("/api/push/test", { method: "POST" }));
      await loadStatus();
      setFeedbackOpen(true);
      setMessage({ text: "Enviamos uma notificacao. Ela apareceu no seu dispositivo?", tone: "info" });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Nao foi possivel enviar o teste.", tone: "error" });
    } finally { setBusy(false); }
  }

  async function recordFeedback(received: boolean) {
    if (!deviceSubscription) return;
    setBusy(true); setMessage(null);
    try {
      await readJSON(await fetch("/api/push/test-feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: deviceSubscription.endpoint, received }) }));
      setFeedbackOpen(false);
      await loadStatus();
      setMessage(received
        ? { text: "Tudo pronto! Este dispositivo esta configurado para receber notificacoes da Igreja Batista Esperanca.", tone: "success" }
        : { text: "Tudo bem. Revise as instrucoes do seu ambiente e teste novamente.", tone: "warning" });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Nao foi possivel registrar sua resposta.", tone: "error" });
    } finally { setBusy(false); }
  }

  async function disableThisDevice() {
    if (!deviceSubscription) return;
    setBusy(true); setMessage(null);
    try {
      await readJSON(await fetch("/api/push/unsubscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: deviceSubscription.endpoint }) }));
      await deviceSubscription.unsubscribe();
      setDeviceSubscription(null); setDeviceId(null); setFeedbackOpen(false); await loadStatus();
      setMessage({ text: "Notificacoes desativadas neste dispositivo.", tone: "success" });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Nao foi possivel desativar este dispositivo.", tone: "error" });
    } finally { setBusy(false); }
  }

  async function setPreference(pushEnabled: boolean) {
    setBusy(true); setMessage(null);
    try {
      await readJSON(await fetch("/api/push/preferences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pushEnabled }) }));
      await loadStatus(); setMessage({ text: pushEnabled ? "Notificacoes reativadas para sua conta." : "Notificacoes pausadas para sua conta.", tone: "success" });
    } catch (error) { setMessage({ text: error instanceof Error ? error.message : "Nao foi possivel salvar a preferencia.", tone: "error" }); }
    finally { setBusy(false); }
  }

  const steps = [
    ["Permissao", permission === "granted"],
    ["Dispositivo", Boolean(deviceSubscription && currentDevice)],
    ["Teste", Boolean(currentDevice?.testSentAt)],
    ["Confirmacao", Boolean(currentDevice?.setupCompletedAt)]
  ] as const;

  return (
    <section className="rounded-md border border-hope-100 bg-white p-4 shadow-sm" aria-labelledby="push-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><h2 id="push-title" className="text-lg font-bold text-ink-900">Notificacoes</h2><p className="mt-1 text-sm leading-relaxed text-ink-500">Receba avisos importantes sobre escalas, comunicados e atividades da igreja.</p></div>
        <span className="rounded-full bg-hope-50 px-3 py-1 text-xs font-bold text-hope-700">{setupStatus === "CONFIRMED" ? "Tudo pronto" : setupStatus === "PERMISSION_DENIED" ? "Permissao bloqueada" : setupStatus === "UNSUPPORTED" ? "Navegador incompativel" : setupStatus === "TEST_SENT" ? "Aguardando confirmacao" : "Configuracao em andamento"}</span>
      </div>
      <ol className="mt-5 grid gap-2 sm:grid-cols-4" aria-label="Progresso da configuracao">{steps.map(([label, complete], index) => <li key={label} className="flex items-center gap-2 rounded-md border border-hope-100 px-3 py-3 text-sm font-semibold"><span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-hope-50 text-hope-700">{complete ? "OK" : index + 1}</span><span>{label}</span><span className="sr-only">{complete ? " concluida" : " pendente"}</span></li>)}</ol>
      {message ? <div className="mt-4"><FormMessage tone={message.tone}>{message.text}</FormMessage></div> : null}
      {setupStatus === "PERMISSION_DENIED" ? <div className="mt-4 space-y-3"><p className="text-sm font-semibold text-ink-800">As notificacoes estao bloqueadas neste navegador ou dispositivo.</p><ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed text-ink-600">{instructions.map((item) => <li key={item}>{item}</li>)}</ol><a href="/ajuda?artigo=notificacoes-nao-recebida" className={`${buttonClass} inline-flex items-center bg-white`}>Ver instrucoes completas</a></div> : null}
      {setupStatus === "TEST_SENT" && testFailed ? <div className="mt-4 space-y-3 rounded-md border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-900">Revise estas configuracoes e tente novamente:</p><ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed text-amber-900">{instructions.map((item) => <li key={item}>{item}</li>)}</ol><a href="/ajuda?artigo=notificacoes-nao-recebida" className={`${buttonClass} inline-flex items-center bg-white`}>Ver instrucoes completas</a></div> : null}
      {setupStatus === "PERMISSION_REQUIRED" ? <div className="mt-4"><p className="text-sm text-ink-700">Para receber avisos, permita que este navegador mostre notificacoes.</p><button type="button" onClick={enable} disabled={busy} className={`${buttonClass} mt-3 bg-hope-600 text-white`}>Ativar notificacoes</button></div> : null}
      {setupStatus === "UNSUPPORTED" ? <p className="mt-4 text-sm text-ink-700">Este navegador nao oferece suporte seguro a notificacoes push. Use Chrome, Edge ou Safari em HTTPS.</p> : null}
      {setupStatus === "SUBSCRIPTION_REQUIRED" ? <div className="mt-4"><p className="text-sm text-ink-700">Permissao concedida. Agora registre este dispositivo para continuar.</p><button type="button" onClick={enable} disabled={busy} className={`${buttonClass} mt-3 bg-hope-600 text-white`}>Registrar este dispositivo</button></div> : null}
      {(setupStatus === "READY_FOR_TEST" || setupStatus === "TEST_SENT" || setupStatus === "CONFIRMED") ? <div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={sendTest} disabled={busy || !status?.pushEnabled} className={`${buttonClass} bg-hope-600 text-white`}>{busy ? "Enviando teste..." : setupStatus === "CONFIRMED" ? "Enviar novo teste" : "Testar novamente"}</button><button type="button" onClick={disableThisDevice} disabled={busy} className={`${buttonClass} bg-white`}>Desativar neste dispositivo</button></div> : null}
      {feedbackOpen ? <div className="mt-4 rounded-md border border-hope-100 bg-hope-50 p-4"><p className="text-sm font-bold text-ink-900">Enviamos uma notificacao. Ela apareceu no seu dispositivo?</p><div className="mt-3 flex flex-wrap gap-3"><button type="button" onClick={() => recordFeedback(true)} disabled={busy} className={`${buttonClass} bg-hope-600 text-white`}>Sim, recebi</button><button type="button" onClick={() => recordFeedback(false)} disabled={busy} className={`${buttonClass} bg-white`}>Nao apareceu</button><button type="button" onClick={() => setFeedbackOpen(false)} disabled={busy} className={`${buttonClass} bg-transparent`}>Testar depois</button></div></div> : null}
      {setupStatus === "TEST_SENT" && !feedbackOpen ? <button type="button" onClick={() => setFeedbackOpen(true)} disabled={busy} className={`${buttonClass} mt-3 bg-white`}>Responder ao teste</button> : null}
      {environment.operatingSystem !== "UNKNOWN" ? <p className="mt-4 text-xs text-ink-500">Ambiente detectado para orientar as instrucoes: {environment.operatingSystem} / {environment.browser}{environment.isStandalone ? " / aplicativo instalado" : ""}.</p> : null}
      <label className="mt-4 flex items-center gap-3 border-t border-hope-100 pt-4 text-sm font-semibold text-ink-800"><input type="checkbox" checked={status?.pushEnabled ?? false} onChange={(event) => setPreference(event.target.checked)} disabled={busy || !status?.activeDeviceCount} /> Receber notificacoes push nesta conta</label>
      {status?.devices.length ? <ul className="mt-5 grid gap-2" aria-label="Dispositivos cadastrados">{status.devices.map((device) => <li key={device.id} className="rounded-md border border-hope-100 px-3 py-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{device.deviceName || "Dispositivo"}{device.id === deviceId ? " - Este dispositivo" : ""}</strong><span className="font-semibold text-hope-700">{deviceStatus(device)}</span></div><span className="mt-1 block text-ink-500">Cadastrado em {formatDate(device.createdAt)}. Ultimo teste: {formatDate(device.testSentAt, true)}.</span></li>)}</ul> : <p className="mt-5 text-sm text-ink-500">Nenhum dispositivo esta inscrito.</p>}
      <p className="mt-4 text-xs leading-relaxed text-ink-500">Voce pode pausar as notificacoes da conta sem remover os dispositivos. Os avisos automaticos serao disponibilizados gradualmente.</p>
    </section>
  );
}
