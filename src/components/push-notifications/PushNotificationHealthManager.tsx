"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApiResponseBody, PushNotificationDeviceHealthResult, PushNotificationHealthData } from "@/types";

async function readApi<T>(response: Response) {
  const payload = (await response.json()) as ApiResponseBody<T>;
  if (!payload.success) throw new Error(payload.error.message);
  return payload.data;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function severityClass(severity: string | undefined) {
  if (severity === "danger") return "border-red-100 bg-red-50 text-red-800";
  if (severity === "warning") return "border-amber-100 bg-amber-50 text-amber-800";
  if (severity === "success") return "border-emerald-100 bg-emerald-50 text-emerald-800";
  return "border-hope-100 bg-white text-ink-800";
}

export function PushNotificationHealthManager() {
  const [health, setHealth] = useState<PushNotificationHealthData | null>(null);
  const [devices, setDevices] = useState<PushNotificationDeviceHealthResult | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [thresholdDays, setThresholdDays] = useState("30");
  const [page, setPage] = useState(1);

  const query = useMemo(() => new URLSearchParams({ thresholdDays }).toString(), [thresholdDays]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setMessage("");
    try {
      const [healthData, deviceData] = await Promise.all([
        readApi<PushNotificationHealthData>(await fetch(`/api/admin/push/health?${query}`, { cache: "no-store" })),
        readApi<PushNotificationDeviceHealthResult>(await fetch(`/api/admin/push/devices?page=${page}&pageSize=20`, { cache: "no-store" }))
      ]);
      setHealth(healthData);
      setDevices(deviceData);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel carregar a saude das notificacoes.");
    } finally {
      setIsLoading(false);
    }
  }, [page, query]);

  useEffect(() => {
    void load();
  }, [load]);

  if (isLoading) return <div className="rounded-md border border-hope-100 bg-white p-5 text-sm font-semibold text-ink-600 shadow-sm">Carregando saude das notificacoes...</div>;
  if (message || !health || !devices) return <div className="rounded-md border border-red-100 bg-red-50 p-5 text-sm font-semibold text-red-700">{message || "Painel indisponivel."}</div>;

  const pagination = devices.pagination;

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 rounded-md border border-hope-100 bg-white p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-ink-500">
          Dispositivos sem receber ha mais de
          <select value={thresholdDays} onChange={(event) => setThresholdDays(event.target.value)} className="rounded-md border border-hope-100 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-ink-800">
            <option value="7">7 dias</option>
            <option value="15">15 dias</option>
            <option value="30">30 dias</option>
            <option value="60">60 dias</option>
            <option value="90">90 dias</option>
          </select>
        </label>
        <button type="button" onClick={load} className="rounded-md border border-hope-100 px-4 py-2 text-sm font-bold text-ink-700 hover:bg-hope-50">Atualizar</button>
      </div>

      {health.alerts.length > 0 ? (
        <section className="grid gap-3">
          {health.alerts.map((alert) => (
            <div key={alert.code} className={`rounded-md border p-4 shadow-sm ${severityClass(alert.severity)}`}>
              <p className="text-sm font-bold">{alert.title}</p>
              <p className="mt-1 text-sm">{alert.message}</p>
            </div>
          ))}
        </section>
      ) : <div className="rounded-md border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">Nenhum alerta operacional relevante no momento.</div>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {health.metrics.map((item) => (
          <div key={item.label} className={`rounded-md border p-4 shadow-sm ${severityClass(item.severity)}`}>
            <p className="text-xs font-bold uppercase tracking-wide opacity-70">{item.label}</p>
            <p className="mt-2 text-2xl font-bold">{item.value}</p>
            <p className="mt-1 text-xs font-semibold opacity-75">{item.detail}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Distribution title="Plataformas" items={health.platformDistribution} />
        <Distribution title="Navegadores" items={health.browserDistribution} />
        <Distribution title="Dispositivos por usuario" items={health.devicesPerUser} />
      </section>

      <section className="rounded-md border border-amber-100 bg-amber-50 p-5 shadow-sm">
        <h2 className="text-lg font-bold text-ink-900">Dispositivos expirados ou removidos</h2>
        <p className="mt-1 text-sm text-ink-600">Estes dispositivos precisam abrir novamente o aplicativo para registrar uma nova subscription. Nao ha tentativa automatica de envio para subscriptions expiradas.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {health.expiredDevices.length === 0 ? <p className="text-sm font-semibold text-ink-500">Nenhum dispositivo expirado em destaque.</p> : null}
          {health.expiredDevices.map((device) => <DeviceCard key={device.id} device={device} />)}
        </div>
      </section>

      <section className="overflow-hidden rounded-md border border-hope-100 bg-white shadow-sm">
        <div className="border-b border-hope-100 px-4 py-3">
          <h2 className="text-lg font-bold text-ink-900">Historico do dispositivo</h2>
          <p className="text-sm text-ink-500">{pagination.total} dispositivo(s) registrados. Endpoints reais nao sao exibidos.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-hope-100 text-sm">
            <thead className="bg-hope-50 text-left text-xs font-bold uppercase tracking-wide text-ink-500">
              <tr><th className="px-4 py-3">Usuario</th><th className="px-4 py-3">Dispositivo</th><th className="px-4 py-3">Primeiro registro</th><th className="px-4 py-3">Ultimo registro</th><th className="px-4 py-3">Ultima notificacao</th><th className="px-4 py-3">Recebidas</th><th className="px-4 py-3">Falhas</th><th className="px-4 py-3">Reenvios</th><th className="px-4 py-3">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-hope-100">
              {devices.devices.map((device) => (
                <tr key={device.id} className="align-top">
                  <td className="px-4 py-4"><p className="font-semibold text-ink-900">{device.user.name}</p><p className="text-xs text-ink-500">{device.member?.displayName ?? device.user.username}</p></td>
                  <td className="px-4 py-4"><p className="font-semibold text-ink-800">{device.deviceName ?? "Dispositivo"}</p><p className="text-xs text-ink-500">{[device.platform, device.browser].filter(Boolean).join(" - ") || "-"} | {device.endpointHashShort}</p></td>
                  <td className="px-4 py-4">{formatDate(device.firstRegisteredAt)}</td>
                  <td className="px-4 py-4">{formatDate(device.lastRegisteredAt)}<p className="text-xs text-ink-500">{device.daysSinceLastRegistration} dia(s)</p></td>
                  <td className="px-4 py-4">{formatDate(device.lastNotificationAt)}</td>
                  <td className="px-4 py-4 font-semibold text-emerald-700">{device.receivedCount}</td>
                  <td className="px-4 py-4 font-semibold text-red-700">{device.failedCount}</td>
                  <td className="px-4 py-4 font-semibold text-hope-700">{device.retryCount}</td>
                  <td className="px-4 py-4"><span className={`rounded-md border px-2 py-1 text-xs font-bold ${device.isActive ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-red-100 bg-red-50 text-red-700"}`}>{device.isActive ? "Ativo" : "Removido"}</span>{device.lastError ? <p className="mt-2 max-w-xs text-xs text-ink-500">Ultimo erro: {device.lastError}</p> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-hope-100 px-4 py-3 text-sm text-ink-600 sm:flex-row sm:items-center sm:justify-between">
          <span>Pagina {pagination.page} de {pagination.totalPages}</span>
          <div className="flex gap-2">
            <button type="button" disabled={pagination.page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-md border border-hope-100 px-3 py-2 font-bold disabled:opacity-40">Anterior</button>
            <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-md border border-hope-100 px-3 py-2 font-bold disabled:opacity-40">Proxima</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Distribution({ title, items }: { title: string; items: Array<{ label: string; count: number }> }) {
  return (
    <div className="rounded-md border border-hope-100 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-ink-900">{title}</h2>
      <div className="mt-4 grid gap-2">
        {items.length === 0 ? <p className="text-sm font-semibold text-ink-500">Sem dados.</p> : null}
        {items.map((item) => <div key={item.label} className="flex items-center justify-between rounded-md bg-hope-50 px-3 py-2 text-sm"><span className="font-semibold text-ink-700">{item.label}</span><span className="font-bold text-hope-700">{item.count}</span></div>)}
      </div>
    </div>
  );
}

function DeviceCard({ device }: { device: PushNotificationDeviceHealthResult["devices"][number] }) {
  return (
    <div className="rounded-md border border-amber-100 bg-white p-4">
      <p className="font-bold text-ink-900">{device.user.name}</p>
      <p className="text-sm text-ink-600">{device.deviceName ?? "Dispositivo"} - {[device.platform, device.browser].filter(Boolean).join(" - ") || "-"}</p>
      <p className="mt-2 text-xs font-semibold text-ink-500">Ultima subscription: {formatDate(device.lastRegisteredAt)}</p>
      <p className="text-xs font-semibold text-ink-500">Ultima notificacao: {formatDate(device.lastNotificationAt)}</p>
      <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Este dispositivo precisa abrir novamente o aplicativo para registrar uma nova subscription.</p>
    </div>
  );
}
