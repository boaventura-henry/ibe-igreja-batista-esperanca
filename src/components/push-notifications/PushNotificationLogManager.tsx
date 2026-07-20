"use client";

import { PushNotificationLogStatus } from "@prisma/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApiResponseBody, PushNotificationLogDetailResult, PushNotificationLogListResult, PushNotificationLogSummary, PushNotificationRetryResult } from "@/types";

const statusOptions = [
  { value: "", label: "Todos" },
  { value: PushNotificationLogStatus.PENDING, label: "Pendente" },
  { value: PushNotificationLogStatus.SUCCESS, label: "Sucesso" },
  { value: PushNotificationLogStatus.PARTIAL_SUCCESS, label: "Parcial" },
  { value: PushNotificationLogStatus.FAILED, label: "Falha" }
];

const statusLabels: Record<string, string> = {
  PENDING: "Pendente",
  SUCCESS: "Sucesso",
  PARTIAL_SUCCESS: "Parcial",
  FAILED: "Falha"
};

const deviceStatusLabels: Record<string, string> = {
  SUCCESS: "Sucesso",
  FAILED: "Falha",
  EXPIRED: "Expirado",
  REMOVED: "Removido",
  SKIPPED: "Ignorado"
};

const skipReasonLabels: Record<string, string> = {
  ALREADY_SUCCEEDED_IN_LATER_ATTEMPT: "Ja recebeu em tentativa posterior",
  SUBSCRIPTION_NOT_FOUND: "Inscricao nao encontrada",
  SUBSCRIPTION_INACTIVE: "Inscricao inativa",
  USER_INACTIVE: "Usuario inativo",
  DEVICE_OWNER_CHANGED: "Dispositivo mudou de usuario",
  ENDPOINT_HASH_CHANGED: "Inscricao alterada",
  DEVICE_ALREADY_REMOVED: "Dispositivo removido",
  NO_LONGER_ELIGIBLE: "Nao elegivel"
};

type Filters = {
  search: string;
  status: string;
  target: string;
  userId: string;
  from: string;
  to: string;
  page: string;
};

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function duration(value: number | null) {
  if (value === null) return "-";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(1)} s`;
}

function statusClass(status: string) {
  if (status === "SUCCESS") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (status === "PARTIAL_SUCCESS") return "bg-amber-50 text-amber-800 border-amber-100";
  if (status === "FAILED" || status === "EXPIRED" || status === "REMOVED") return "bg-red-50 text-red-700 border-red-100";
  if (status === "SKIPPED") return "bg-slate-50 text-slate-700 border-slate-200";
  return "bg-hope-50 text-hope-700 border-hope-100";
}

async function readApi<T>(response: Response) {
  const payload = (await response.json()) as ApiResponseBody<T>;
  if (!payload.success) throw new Error(payload.error.message);
  return payload.data;
}

export function PushNotificationLogManager({ canRetry }: { canRetry: boolean }) {
  const [data, setData] = useState<PushNotificationLogListResult | null>(null);
  const [detail, setDetail] = useState<PushNotificationLogDetailResult | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({ search: "", status: "", target: "", userId: "", from: "", to: "", page: "1" });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
    params.set("pageSize", "10");
    return params.toString();
  }, [filters]);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    setMessage("");
    try {
      setData(await readApi<PushNotificationLogListResult>(await fetch(`/api/admin/push/logs?${queryString}`, { cache: "no-store" })));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel carregar o historico.");
    } finally {
      setIsLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    const timeout = window.setTimeout(loadLogs, 250);
    return () => window.clearTimeout(timeout);
  }, [loadLogs]);

  function updateFilter(name: keyof Filters, value: string) {
    setFilters((current) => ({ ...current, [name]: value, page: name === "page" ? value : "1" }));
  }

  async function openDetail(log: Pick<PushNotificationLogSummary, "id">) {
    setMessage("");
    try {
      setDetail(await readApi<PushNotificationLogDetailResult>(await fetch(`/api/admin/push/logs/${log.id}`, { cache: "no-store" })));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel abrir os detalhes.");
    }
  }

  const pagination = data?.pagination;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-md border border-hope-100 bg-white p-4 shadow-sm lg:grid-cols-6">
        <FilterInput label="Titulo ou mensagem" value={filters.search} onChange={(value) => updateFilter("search", value)} className="lg:col-span-2" />
        <FilterInput label="Destino" value={filters.target} onChange={(value) => updateFilter("target", value)} />
        <FilterInput label="Usuario ID" value={filters.userId} onChange={(value) => updateFilter("userId", value)} />
        <label className={filterLabelClass}>Status<select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)} className={filterInputClass}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <FilterInput label="Inicio" type="date" value={filters.from} onChange={(value) => updateFilter("from", value)} />
        <FilterInput label="Fim" type="date" value={filters.to} onChange={(value) => updateFilter("to", value)} />
      </div>

      {message ? <div className="rounded-md border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{message}</div> : null}

      <div className="overflow-hidden rounded-md border border-hope-100 bg-white shadow-sm">
        <div className="border-b border-hope-100 px-4 py-3">
          <p className="text-sm font-bold text-ink-900">Envios registrados</p>
          <p className="text-xs text-ink-500">{pagination ? `${pagination.total} registro(s)` : "Carregando"}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-hope-100 text-sm">
            <thead className="bg-hope-50 text-left text-xs font-bold uppercase tracking-wide text-ink-500">
              <tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Titulo</th><th className="px-4 py-3">Destino</th><th className="px-4 py-3">Tentativa</th><th className="px-4 py-3">Encontrados</th><th className="px-4 py-3">Sucesso</th><th className="px-4 py-3">Falhas</th><th className="px-4 py-3">Ignorados</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Acoes</th></tr>
            </thead>
            <tbody className="divide-y divide-hope-100">
              {isLoading ? <tr><td colSpan={10} className="px-4 py-8 text-center font-semibold text-ink-500">Carregando historico...</td></tr> : null}
              {!isLoading && data?.logs.length === 0 ? <tr><td colSpan={10} className="px-4 py-8 text-center font-semibold text-ink-500">Nenhum envio encontrado.</td></tr> : null}
              {data?.logs.map((log) => (
                <tr key={log.id} className="align-top">
                  <td className="px-4 py-4 text-ink-700">{formatDate(log.createdAt)}</td>
                  <td className="px-4 py-4"><p className="font-semibold text-ink-900">{log.title}</p><p className="max-w-xs truncate text-xs text-ink-500">{log.body}</p></td>
                  <td className="px-4 py-4 text-ink-700">{log.targetDescription ?? log.targetType}</td>
                  <td className="px-4 py-4 text-ink-700">{log.retryNumber === 0 ? "Original" : `Retry ${log.retryNumber}`}</td>
                  <td className="px-4 py-4 font-semibold text-ink-800">{log.devicesFound}</td>
                  <td className="px-4 py-4 font-semibold text-emerald-700">{log.devicesSucceeded}</td>
                  <td className="px-4 py-4 font-semibold text-red-700">{log.devicesFailed}</td>
                  <td className="px-4 py-4 font-semibold text-slate-700">{log.devicesSkipped}</td>
                  <td className="px-4 py-4"><span className={`rounded-md border px-2 py-1 text-xs font-bold ${statusClass(log.status)}`}>{statusLabels[log.status] ?? log.status}</span></td>
                  <td className="px-4 py-4 text-right"><button type="button" onClick={() => openDetail(log)} className="rounded-md border border-hope-100 px-3 py-2 text-xs font-bold text-ink-700 hover:bg-hope-50">Detalhes</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pagination ? <div className="flex flex-col gap-3 border-t border-hope-100 px-4 py-3 text-sm text-ink-600 sm:flex-row sm:items-center sm:justify-between"><span>Pagina {pagination.page} de {pagination.totalPages}</span><div className="flex gap-2"><button type="button" disabled={pagination.page <= 1} onClick={() => updateFilter("page", String(pagination.page - 1))} className="rounded-md border border-hope-100 px-3 py-2 font-bold disabled:opacity-40">Anterior</button><button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => updateFilter("page", String(pagination.page + 1))} className="rounded-md border border-hope-100 px-3 py-2 font-bold disabled:opacity-40">Proxima</button></div></div> : null}
      </div>

      {detail ? <DetailModal detail={detail} canRetry={canRetry} onClose={() => setDetail(null)} onOpenDetail={openDetail} onRefresh={async (id) => { await loadLogs(); await openDetail({ id }); }} /> : null}
    </div>
  );
}

function DetailModal({ detail, canRetry, onClose, onOpenDetail, onRefresh }: { detail: PushNotificationLogDetailResult; canRetry: boolean; onClose: () => void; onOpenDetail: (log: Pick<PushNotificationLogSummary, "id">) => Promise<void>; onRefresh: (id: string) => Promise<void> }) {
  const [confirmRetry, setConfirmRetry] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryMessage, setRetryMessage] = useState("");

  async function retryFailed() {
    setIsRetrying(true);
    setRetryMessage("");
    const idempotencyKey = `${detail.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const result = await readApi<PushNotificationRetryResult>(await fetch(`/api/admin/push/logs/${detail.id}/retry-failed`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ idempotencyKey })
      }));
      setConfirmRetry(false);
      setRetryMessage(`Reenvio criado: tentativa ${result.retryNumber}. Sucessos: ${result.succeeded}; falhas: ${result.failed}; ignorados: ${result.skipped}.`);
      await onRefresh(result.logId);
    } catch (error) {
      setRetryMessage(error instanceof Error ? error.message : "Nao foi possivel reenviar a notificacao.");
    } finally {
      setIsRetrying(false);
    }
  }

  const showRetry = canRetry && detail.retryEligibility.canRetry;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/45 px-4 py-6">
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-md bg-white shadow-soft">
        <div className="flex flex-col gap-3 border-b border-hope-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div><h2 className="text-lg font-bold text-ink-900">Detalhes da notificacao</h2><p className="text-sm text-ink-500">{detail.title}</p></div>
          <div className="flex flex-wrap gap-2">
            {showRetry ? <button type="button" onClick={() => setConfirmRetry(true)} className="rounded-md bg-hope-700 px-3 py-2 text-sm font-bold text-white hover:bg-hope-800">Reenviar apenas para dispositivos com falha</button> : null}
            <button type="button" onClick={onClose} className="rounded-md border border-hope-100 px-3 py-2 text-sm font-bold text-ink-700">Fechar</button>
          </div>
        </div>
        <div className="overflow-y-auto p-5">
          {retryMessage ? <div className="mb-4 rounded-md border border-hope-100 bg-hope-50 px-4 py-3 text-sm font-semibold text-hope-800">{retryMessage}</div> : null}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Info label="Mensagem" value={detail.body} className="sm:col-span-2 lg:col-span-4" />
            <Info label="Criador" value={detail.createdBy?.name ?? "Sistema"} />
            <Info label="Reenvio solicitado por" value={detail.retriedBy?.name ?? "-"} />
            <Info label="Tentativa" value={detail.retryNumber === 0 ? "Original" : `Retry ${detail.retryNumber}`} />
            <Info label="Origem" value={detail.retrySourceLog ? `Tentativa ${detail.retrySourceLog.retryNumber}` : "-"} />
            <Info label="Encontrados" value={String(detail.devicesFound)} />
            <Info label="Tentados" value={String(detail.devicesAttempted)} />
            <Info label="Sucesso" value={String(detail.devicesSucceeded)} />
            <Info label="Falhas" value={String(detail.devicesFailed)} />
            <Info label="Ignorados" value={String(detail.devicesSkipped)} />
            <Info label="Status" value={statusLabels[detail.status] ?? detail.status} />
            <Info label="Tempo total" value={duration(detail.durationMs)} />
          </div>

          <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Info label="Dispositivos unicos" value={String(detail.chainSummary.totalUniqueDevices)} />
            <Info label="Receberam em alguma tentativa" value={String(detail.chainSummary.succeeded)} />
            <Info label="Recuperados apos reenvio" value={String(detail.chainSummary.recoveredAfterRetry)} />
            <Info label="Taxa final" value={`${detail.chainSummary.finalSuccessRate}%`} />
          </section>

          <section className="mt-5 rounded-md border border-hope-100 p-4">
            <h3 className="text-sm font-bold text-ink-900">Historico de tentativas</h3>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {detail.retryAttempts.map((attempt) => (
                <button key={attempt.id} type="button" onClick={() => onOpenDetail(attempt)} className="rounded-md border border-hope-100 p-3 text-left hover:bg-hope-50">
                  <p className="text-sm font-bold text-ink-900">Tentativa {attempt.retryNumber}</p>
                  <p className="text-xs text-ink-500">{formatDate(attempt.createdAt)} - {statusLabels[attempt.status] ?? attempt.status}</p>
                  <p className="mt-2 text-xs font-semibold text-ink-700">Tentados {attempt.devicesAttempted} | Sucesso {attempt.devicesSucceeded} | Falhas {attempt.devicesFailed} | Ignorados {attempt.devicesSkipped}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="mt-5 rounded-md border border-hope-100 p-4">
            <h3 className="text-sm font-bold text-ink-900">Elegibilidade para novo reenvio</h3>
            <p className="mt-1 text-sm text-ink-600">Falhas da tentativa: {detail.retryEligibility.failed}. Elegiveis: {detail.retryEligibility.eligible}. Ignorados: {detail.retryEligibility.skipped}.</p>
            {!detail.retryEligibility.canRetry ? <p className="mt-2 text-sm font-semibold text-amber-700">{detail.retryEligibility.reason ?? "Sem dispositivos elegiveis."}</p> : null}
          </section>

          <div className="mt-5 overflow-x-auto rounded-md border border-hope-100">
            <table className="min-w-full divide-y divide-hope-100 text-sm">
              <thead className="bg-hope-50 text-left text-xs font-bold uppercase tracking-wide text-ink-500"><tr><th className="px-4 py-3">Usuario</th><th className="px-4 py-3">Membro</th><th className="px-4 py-3">Dispositivo</th><th className="px-4 py-3">Endpoint</th><th className="px-4 py-3">Tentativa</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Erro/Motivo</th><th className="px-4 py-3">Data/Hora</th></tr></thead>
              <tbody className="divide-y divide-hope-100">
                {detail.devices.length === 0 ? <tr><td colSpan={8} className="px-4 py-6 text-center font-semibold text-ink-500">Nenhum dispositivo registrado neste envio.</td></tr> : null}
                {detail.devices.map((device) => <tr key={device.id} className="align-top"><td className="px-4 py-4">{device.user?.name ?? "-"}</td><td className="px-4 py-4">{device.member?.displayName ?? "-"}</td><td className="px-4 py-4">{device.deviceName ?? "Dispositivo"}<p className="text-xs text-ink-500">{[device.platform, device.browser].filter(Boolean).join(" - ") || "-"}</p></td><td className="px-4 py-4 font-mono text-xs">{device.endpointHashShort}</td><td className="px-4 py-4">{device.attemptNumber}</td><td className="px-4 py-4"><span className={`rounded-md border px-2 py-1 text-xs font-bold ${statusClass(device.status)}`}>{deviceStatusLabels[device.status] ?? device.status}</span></td><td className="px-4 py-4"><p>{device.skipReason ? skipReasonLabels[device.skipReason] ?? device.skipReason : device.errorCode ?? "-"}</p>{device.errorMessage ? <p className="max-w-xs text-xs text-ink-500">{device.errorMessage}</p> : null}</td><td className="px-4 py-4">{formatDate(device.sentAt ?? device.lastCheckedAt)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {confirmRetry ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-900/50 px-4">
          <div className="w-full max-w-lg rounded-md bg-white p-5 shadow-soft">
            <h3 className="text-lg font-bold text-ink-900">Confirmar reenvio</h3>
            <p className="mt-2 text-sm text-ink-600">Esta acao criara uma nova tentativa somente para os dispositivos que falharam e ainda possuem inscricao valida. Os dispositivos que ja receberam a notificacao nao serao notificados novamente.</p>
            <div className="mt-4 grid gap-2 rounded-md bg-hope-50 p-3 text-sm font-semibold text-ink-700">
              <span>Falhas da tentativa: {detail.retryEligibility.failed}</span>
              <span>Elegiveis: {detail.retryEligibility.eligible}</span>
              <span>Ignorados: {detail.retryEligibility.skipped}</span>
              {Object.entries(detail.retryEligibility.totals).map(([key, value]) => <span key={key}>{skipReasonLabels[key] ?? key}: {value}</span>)}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={isRetrying} onClick={() => setConfirmRetry(false)} className="rounded-md border border-hope-100 px-4 py-2 text-sm font-bold text-ink-700 disabled:opacity-50">Cancelar</button>
              <button type="button" disabled={isRetrying} onClick={retryFailed} className="rounded-md bg-hope-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{isRetrying ? "Reenviando..." : "Confirmar reenvio"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const filterLabelClass = "grid gap-1 text-xs font-bold uppercase tracking-wide text-ink-500";
const filterInputClass = "w-full rounded-md border border-hope-100 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-ink-800 outline-none transition focus:border-hope-500 focus:ring-2 focus:ring-hope-100";

function FilterInput({ label, value, onChange, className = "", type = "text" }: { label: string; value: string; onChange: (value: string) => void; className?: string; type?: string }) {
  return <label className={`${filterLabelClass} ${className}`}>{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} className={filterInputClass} /></label>;
}

function Info({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return <div className={className}><p className="text-xs font-bold uppercase tracking-wide text-ink-500">{label}</p><p className="mt-1 break-words text-sm font-semibold text-ink-800">{value}</p></div>;
}
