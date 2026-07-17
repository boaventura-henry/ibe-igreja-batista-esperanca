"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FormMessage } from "@/components/ui/FormMessage";
import { getNotificationEnvironment, notificationInstructions, type NotificationEnvironment } from "@/utils/notification-environment";
import { PUSH_FAILURE_WARNING_THRESHOLD, type PushDevice, type PushSetupStatus, type PushStatus } from "@/types";

const buttonClass = "min-h-11 rounded-md border border-hope-100 px-4 py-2 text-sm font-bold transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60";

const vapidConfigurationError = "Nao foi possivel configurar as notificacoes neste momento. Tente novamente mais tarde.";
type PushRegistrationStep = "service-worker" | "existing-subscription" | "vapid-key" | "browser-subscribe" | "api-request" | "api-response" | "state-update";

type PushDiagnostic = {
  occurredAt: string;
  step: PushRegistrationStep;
  name: string;
  message: string;
  status?: number;
  code?: string;
};

type ApiError = Error & { status?: number; code?: string };

function localDateTime(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(value);
}

function safeErrorName(error: unknown) {
  if (error instanceof DOMException && error.name) return error.name.slice(0, 80);
  if (error instanceof Error && error.name) return error.name.slice(0, 80);
  return "Error";
}

function safeErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.message) return error.message.slice(0, 180);
  if (error instanceof Error && error.message) return error.message.slice(0, 180);
  return "Falha inesperada no registro de notificacoes.";
}

function createDiagnostic(step: PushRegistrationStep, error: unknown): PushDiagnostic {
  const apiError = error as ApiError;
  return {
    occurredAt: localDateTime(new Date()),
    step,
    name: safeErrorName(error),
    message: safeErrorMessage(error),
    ...(typeof apiError.status === "number" ? { status: apiError.status } : {}),
    ...(typeof apiError.code === "string" ? { code: apiError.code.slice(0, 80) } : {})
  };
}

function diagnosticText(diagnostic: PushDiagnostic) {
  return [
    `Data: ${diagnostic.occurredAt}`,
    `Etapa: ${diagnostic.step}`,
    `Erro: ${diagnostic.name}`,
    diagnostic.status ? `Status HTTP: ${diagnostic.status}` : null,
    diagnostic.code ? `Codigo: ${diagnostic.code}` : null,
    `Mensagem: ${diagnostic.message}`
  ].filter(Boolean).join("\n");
}

function logPushDiagnostic(diagnostic: PushDiagnostic) {
  console.error("[Push Registration]", diagnostic);
}

function normalizeVapidPublicKey(value: string | undefined) {
  const normalized = value?.trim().replace(/^['"]|['"]$/g, "") ?? "";
  if (!normalized || /\s/.test(normalized) || !/^[A-Za-z0-9_-]+={0,2}$/.test(normalized) || normalized.length % 4 === 1) {
    return null;
  }
  return normalized.replace(/=+$/g, "");
}

function urlBase64ToUint8Array(value: string) {
  const normalized = normalizeVapidPublicKey(value);
  if (!normalized) throw new Error(vapidConfigurationError);
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const base64 = `${normalized}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return Uint8Array.from(window.atob(base64), (character) => character.charCodeAt(0));
  } catch {
    throw new Error(vapidConfigurationError);
  }
}

function pushErrorMessage(error: unknown) {
  if (error instanceof Error && error.message === vapidConfigurationError) return vapidConfigurationError;
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") return "As notificacoes estao bloqueadas neste navegador ou dispositivo.";
    if (["AbortError", "InvalidCharacterError", "NotSupportedError"].includes(error.name)) return vapidConfigurationError;
  }
  if (error instanceof TypeError) return vapidConfigurationError;
  return "Nao foi possivel ativar as notificacoes. Tente novamente mais tarde.";
}

function browserSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && window.isSecureContext;
}

function formatDate(value: string | null, withTime = false) {
  if (!value) return "Ainda nao realizado";
  return new Intl.DateTimeFormat("pt-BR", withTime ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "short" }).format(new Date(value));
}

function latestDeviceActivity(device: PushDevice) {
  return [device.lastSuccessAt, device.testConfirmedAt, device.testSentAt, device.createdAt]
    .map((value) => value ? new Date(value).getTime() : 0)
    .reduce((largest, value) => Math.max(largest, value), 0);
}

function parseDeviceEnvironment(device: PushDevice) {
  const source = `${device.userAgent ?? ""} ${device.deviceName ?? ""}`.toLowerCase();
  const operatingSystem = /iphone|ipad|ipod/.test(source) ? "iPhone" : /android/.test(source) ? "Android" : /windows|win32|win64|wow64/.test(source) ? "Windows" : /mac os|macintosh|macintel/.test(source) ? "macOS" : /linux/.test(source) ? "Linux" : "";
  const browser = /edg\//.test(source) ? "Edge" : /chrome\//.test(source) ? "Chrome" : /safari\//.test(source) && !/chrome\//.test(source) ? "Safari" : /firefox\//.test(source) ? "Firefox" : "";
  if (operatingSystem && browser) return `${operatingSystem} - ${browser}`;
  if (operatingSystem) return operatingSystem;
  if (browser) return browser;
  return "Dispositivo";
}

function currentEnvironmentLabel(environment: NotificationEnvironment) {
  const operatingSystems: Record<NotificationEnvironment["operatingSystem"], string> = {
    WINDOWS: "Windows",
    ANDROID: "Android",
    IOS: "iPhone",
    MACOS: "macOS",
    LINUX: "Linux",
    UNKNOWN: "Dispositivo"
  };
  const browsers: Record<NotificationEnvironment["browser"], string> = {
    CHROME: "Chrome",
    EDGE: "Edge",
    SAFARI: "Safari",
    FIREFOX: "Firefox",
    OTHER: "navegador"
  };
  return `${operatingSystems[environment.operatingSystem]} - ${browsers[environment.browser]}`;
}

function deviceStatus(device: PushDevice, pushEnabled = true) {
  if (!device.isActive) return { label: "Revogado", rank: 4, className: "border-slate-200 bg-slate-50 text-slate-700" };
  if (!pushEnabled) return { label: "Notificacoes pausadas", rank: 5, className: "border-amber-200 bg-amber-50 text-amber-900" };
  const hasFailedAfterConfirmation = Boolean(device.testFailedAt && (!device.testConfirmedAt || new Date(device.testFailedAt) > new Date(device.testConfirmedAt)));
  if (device.failureCount >= PUSH_FAILURE_WARNING_THRESHOLD || hasFailedAfterConfirmation) return { label: "Precisa de atencao", rank: 3, className: "border-amber-200 bg-amber-50 text-amber-900" };
  if (device.setupCompletedAt && device.testConfirmedAt) return { label: "Configurado", rank: 1, className: "border-emerald-200 bg-emerald-50 text-emerald-800" };
  if (device.testSentAt) return { label: "Teste pendente", rank: 2, className: "border-sky-200 bg-sky-50 text-sky-800" };
  return { label: "Teste pendente", rank: 2, className: "border-sky-200 bg-sky-50 text-sky-800" };
}

async function readJSON<T>(response: Response) {
  let payload: { success?: boolean; data?: T; error?: { message?: string; code?: string } } | null = null;
  try {
    payload = await response.json() as { success?: boolean; data?: T; error?: { message?: string; code?: string } };
  } catch {
    const error = new Error(response.ok ? "A API retornou uma resposta invalida." : "Falha ao registrar o dispositivo na API.") as ApiError;
    error.status = response.status;
    throw error;
  }
  if (!response.ok || !payload?.success) {
    const error = new Error(payload?.error?.message?.slice(0, 180) || "Falha ao registrar o dispositivo na API.") as ApiError;
    error.status = response.status;
    error.code = payload?.error?.code;
    throw error;
  }
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
  const [diagnostic, setDiagnostic] = useState<PushDiagnostic | null>(null);
  const [copiedDiagnostic, setCopiedDiagnostic] = useState(false);

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
  const sortedDevices = useMemo(() => {
    return [...(status?.devices ?? [])].sort((left, right) => {
      const leftStatus = deviceStatus(left, status?.pushEnabled ?? true);
      const rightStatus = deviceStatus(right, status?.pushEnabled ?? true);
      const leftCurrent = left.id === deviceId ? 0 : 1;
      const rightCurrent = right.id === deviceId ? 0 : 1;
      if (leftCurrent !== rightCurrent) return leftCurrent - rightCurrent;
      if (leftStatus.rank !== rightStatus.rank) return leftStatus.rank - rightStatus.rank;
      return latestDeviceActivity(right) - latestDeviceActivity(left);
    });
  }, [deviceId, status?.devices, status?.pushEnabled]);

  const loadStatus = useCallback(async () => {
    const payload = await readJSON<PushStatus>(await fetch("/api/push/status", { cache: "no-store" }));
    if (payload) setStatus(payload);
  }, []);

  const syncSubscription = useCallback(async (subscription: PushSubscription, setStep?: (step: PushRegistrationStep) => void) => {
    setStep?.("api-request");
    const json = subscription.toJSON();
    if (!subscription.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error("O navegador nao forneceu uma inscricao valida.");
    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint, keys: json.keys, expirationTime: subscription.expirationTime, deviceName: currentEnvironmentLabel(getNotificationEnvironment()) })
    });
    setStep?.("api-response");
    const data = await readJSON<{ id: string }>(response);
    if (!data?.id) throw new Error("Nao foi possivel registrar este dispositivo.");
    setStep?.("state-update");
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
    if (!window.confirm("Para receber avisos, permita que este navegador mostre notificacoes. Deseja continuar?")) return;
    let registrationStep: PushRegistrationStep = "service-worker";
    const setRegistrationStep = (step: PushRegistrationStep) => { registrationStep = step; };
    setBusy(true); setMessage(null); setDiagnostic(null); setCopiedDiagnostic(false);
    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") {
        setMessage({ text: "As notificacoes estao bloqueadas neste navegador ou dispositivo.", tone: "warning" });
        return;
      }
      setRegistrationStep("service-worker");
      const registration = await navigator.serviceWorker.ready;
      setRegistrationStep("existing-subscription");
      const existingSubscription = await registration.pushManager.getSubscription();
      let subscription = existingSubscription;
      if (!subscription) {
        setRegistrationStep("vapid-key");
        const publicKey = normalizeVapidPublicKey(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
        if (!publicKey) throw new Error(vapidConfigurationError);
        const applicationServerKey = urlBase64ToUint8Array(publicKey);
        setRegistrationStep("browser-subscribe");
        subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
      }
      await syncSubscription(subscription, setRegistrationStep);
      await loadStatus();
      setMessage({ text: "Este dispositivo esta registrado para receber notificacoes.", tone: "success" });
    } catch (error) {
      const nextDiagnostic = createDiagnostic(registrationStep, error);
      setDiagnostic(nextDiagnostic);
      logPushDiagnostic(nextDiagnostic);
      setMessage({ text: pushErrorMessage(error), tone: "error" });
    } finally { setBusy(false); }
  }


  async function copyDiagnostic() {
    if (!diagnostic) return;
    try {
      await navigator.clipboard.writeText(diagnosticText(diagnostic));
      setCopiedDiagnostic(true);
    } catch {
      setCopiedDiagnostic(false);
    }
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
        <div><h2 id="push-title" className="text-lg font-bold text-ink-900">Notificacoes</h2><p className="mt-1 text-sm leading-relaxed text-ink-500">Prepare este dispositivo para receber notificacoes da Igreja Batista Esperanca.</p></div>
        <span className="rounded-full bg-hope-50 px-3 py-1 text-xs font-bold text-hope-700">{setupStatus === "CONFIRMED" ? "Tudo pronto" : setupStatus === "PERMISSION_DENIED" ? "Permissao bloqueada" : setupStatus === "UNSUPPORTED" ? "Navegador incompativel" : setupStatus === "TEST_SENT" ? "Aguardando confirmacao" : "Configuracao em andamento"}</span>
      </div>
      <ol className="mt-5 grid gap-2 sm:grid-cols-4" aria-label="Progresso da configuracao">{steps.map(([label, complete], index) => <li key={label} className="flex items-center gap-2 rounded-md border border-hope-100 px-3 py-3 text-sm font-semibold"><span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-hope-50 text-hope-700">{complete ? "OK" : index + 1}</span><span>{label}</span><span className="sr-only">{complete ? " concluida" : " pendente"}</span></li>)}</ol>
      {message ? <div className="mt-4"><FormMessage tone={message.tone}>{message.text}</FormMessage></div> : null}
      {diagnostic ? <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4" aria-live="polite"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0 flex-1"><h3 className="text-sm font-bold text-amber-950">Detalhes para suporte</h3><pre className="mt-2 max-w-full select-text whitespace-pre-wrap break-words rounded-md bg-white p-3 text-xs leading-relaxed text-ink-800">{diagnosticText(diagnostic)}</pre></div><button type="button" onClick={copyDiagnostic} className={`${buttonClass} bg-white`}>{copiedDiagnostic ? "Detalhes copiados" : "Copiar detalhes"}</button></div></div> : null}
      {setupStatus === "PERMISSION_DENIED" ? <div className="mt-4 space-y-3"><p className="text-sm font-semibold text-ink-800">As notificacoes estao bloqueadas neste navegador ou dispositivo.</p><ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed text-ink-600">{instructions.map((item) => <li key={item}>{item}</li>)}</ol><a href="/ajuda?artigo=notificacoes-nao-recebida" className={`${buttonClass} inline-flex items-center bg-white`}>Ver instrucoes completas</a></div> : null}
      {setupStatus === "TEST_SENT" && testFailed ? <div className="mt-4 space-y-3 rounded-md border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-900">Revise estas configuracoes e tente novamente:</p><ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed text-amber-900">{instructions.map((item) => <li key={item}>{item}</li>)}</ol><a href="/ajuda?artigo=notificacoes-nao-recebida" className={`${buttonClass} inline-flex items-center bg-white`}>Ver instrucoes completas</a></div> : null}
      {setupStatus === "PERMISSION_REQUIRED" ? <div className="mt-4"><p className="text-sm text-ink-700">Para receber avisos, permita que este navegador mostre notificacoes.</p><button type="button" onClick={enable} disabled={busy} className={`${buttonClass} mt-3 bg-hope-600 text-white`}>Ativar notificacoes</button></div> : null}
      {setupStatus === "UNSUPPORTED" ? <p className="mt-4 text-sm text-ink-700">Este navegador nao oferece suporte seguro a notificacoes push. Use Chrome, Edge ou Safari em HTTPS.</p> : null}
      {setupStatus === "SUBSCRIPTION_REQUIRED" ? <div className="mt-4"><p className="text-sm text-ink-700">Permissao concedida. Agora registre este dispositivo para continuar.</p><button type="button" onClick={enable} disabled={busy} className={`${buttonClass} mt-3 bg-hope-600 text-white`}>Registrar este dispositivo</button></div> : null}
      {setupStatus === "CONFIRMED" ? <p className="mt-3 text-sm leading-relaxed text-ink-600">Voce ja pode receber notificacoes de teste. Os avisos automaticos serao disponibilizados gradualmente nas proximas atualizacoes.</p> : null}
      {(setupStatus === "READY_FOR_TEST" || setupStatus === "CONFIRMED") ? <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap"><button type="button" onClick={sendTest} disabled={busy || !status?.pushEnabled} className={`${buttonClass} bg-hope-600 text-white`}>{busy ? "Enviando teste..." : setupStatus === "CONFIRMED" ? "Enviar novo teste" : "Enviar teste"}</button><button type="button" onClick={disableThisDevice} disabled={busy} className={`${buttonClass} bg-white`}>Desativar neste dispositivo</button></div> : null}
      {setupStatus === "TEST_SENT" ? <div className="mt-4 rounded-md border border-hope-100 bg-hope-50 p-4" aria-live="polite"><p className="text-sm font-bold text-ink-900">Enviamos uma notificacao. Ela apareceu no seu dispositivo?</p><div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap"><button type="button" onClick={() => recordFeedback(true)} disabled={busy} className={`${buttonClass} bg-hope-600 text-white`}>Sim, recebi</button><button type="button" onClick={() => recordFeedback(false)} disabled={busy} className={`${buttonClass} bg-white`}>Nao apareceu</button><button type="button" onClick={sendTest} disabled={busy || !status?.pushEnabled} className={`${buttonClass} bg-white`}>Reenviar teste</button></div></div> : null}
      {feedbackOpen && setupStatus !== "TEST_SENT" ? <div className="mt-4 rounded-md border border-hope-100 bg-hope-50 p-4" aria-live="polite"><p className="text-sm font-bold text-ink-900">Enviamos uma notificacao. Ela apareceu no seu dispositivo?</p><div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap"><button type="button" onClick={() => recordFeedback(true)} disabled={busy} className={`${buttonClass} bg-hope-600 text-white`}>Sim, recebi</button><button type="button" onClick={() => recordFeedback(false)} disabled={busy} className={`${buttonClass} bg-white`}>Nao apareceu</button><button type="button" onClick={() => setFeedbackOpen(false)} disabled={busy} className={`${buttonClass} bg-transparent`}>Testar depois</button></div></div> : null}
      {environment.operatingSystem !== "UNKNOWN" ? <p className="mt-4 text-xs text-ink-500">Ambiente detectado para orientar as instrucoes: {currentEnvironmentLabel(environment)}{environment.isStandalone ? " - aplicativo instalado" : ""}.</p> : null}
      <div className="mt-4 border-t border-hope-100 pt-4"><label className="flex items-center gap-3 text-sm font-semibold text-ink-800"><input type="checkbox" checked={status?.pushEnabled ?? false} onChange={(event) => setPreference(event.target.checked)} disabled={busy || !status?.activeDeviceCount} /> Receber notificacoes push nesta conta</label>{status?.pushEnabled === false && status.activeDeviceCount > 0 ? <div className="mt-2 space-y-3"><p className="text-xs leading-relaxed text-amber-800">As notificacoes estao pausadas para a conta. Nenhum dispositivo recebera avisos ate voce reativar.</p><button type="button" onClick={() => setPreference(true)} disabled={busy} className={`${buttonClass} bg-white`}>Reativar notificacoes da conta</button></div> : null}</div>
      {sortedDevices.length ? <ul className="mt-5 grid gap-3" aria-label="Dispositivos cadastrados">{sortedDevices.map((device) => { const statusInfo = deviceStatus(device, status?.pushEnabled ?? true); const isCurrent = device.id === deviceId; return <li key={device.id} className="rounded-md border border-hope-100 px-3 py-3 text-sm"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="break-words text-ink-900">{parseDeviceEnvironment(device)}</strong>{isCurrent ? <span className="rounded-full border border-hope-200 bg-hope-50 px-2 py-0.5 text-xs font-bold text-hope-700" aria-label="Este dispositivo">Este dispositivo</span> : null}</div><span className="mt-1 block break-words text-ink-500">Cadastrado em {formatDate(device.createdAt)}</span><span className="mt-1 block break-words text-ink-500">Ultimo teste em {formatDate(device.testSentAt, true)}</span></div><span className={`inline-flex w-fit rounded-full border px-2 py-1 text-xs font-bold ${statusInfo.className}`}>Status: {statusInfo.label}</span></div></li>; })}</ul> : <p className="mt-5 text-sm text-ink-500">Nenhum dispositivo esta inscrito.</p>}
      <p className="mt-4 text-xs leading-relaxed text-ink-500">Voce pode pausar as notificacoes da conta sem remover os dispositivos. Os avisos automaticos serao disponibilizados gradualmente nas proximas atualizacoes.</p>
    </section>
  );
}
