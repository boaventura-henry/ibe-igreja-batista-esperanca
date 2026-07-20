import { pushNotificationHealthRepository } from "@/repositories/push-notification-health.repository";
import type { PushNotificationDeviceHealth, PushNotificationDeviceHealthResult, PushNotificationHealthData, PushNotificationHealthMetric, PushNotificationOperationalAlert } from "@/types/push-notification-health.types";
import { getMemberDisplayName } from "@/utils";

function percentage(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function formatMs(value: number) {
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(1)} s`;
}

function daysSince(value: Date) {
  return Math.max(0, Math.floor((Date.now() - value.getTime()) / (24 * 60 * 60 * 1000)));
}

function metric(label: string, value: string | number, detail: string, severity: PushNotificationHealthMetric["severity"] = "neutral"): PushNotificationHealthMetric {
  return { label, value: String(value), detail, severity };
}

function buildAlerts(input: {
  activeDevices: number;
  removedDevices: number;
  expiredDevices: number;
  failuresLast24h: number;
  initialAttempted: number;
  initialSucceeded: number;
  consecutiveFailureCount: number;
}) {
  const alerts: PushNotificationOperationalAlert[] = [];
  const totalKnownDevices = input.activeDevices + input.removedDevices + input.expiredDevices;
  if (input.activeDevices === 0) {
    alerts.push({ code: "NO_ACTIVE_DEVICES", title: "Nenhum dispositivo ativo", message: "Nenhum usuario possui dispositivo habilitado para notificacoes no momento.", severity: "danger" });
  }
  if (totalKnownDevices > 0 && percentage(input.expiredDevices, totalKnownDevices) > 20) {
    alerts.push({ code: "HIGH_EXPIRED_RATE", title: "Muitas subscriptions expiradas", message: "Mais de 20% dos dispositivos conhecidos aparecem como expirados.", severity: "warning" });
  }
  if (input.initialAttempted > 0 && percentage(input.initialAttempted - input.initialSucceeded, input.initialAttempted) > 10) {
    alerts.push({ code: "HIGH_FAILURE_RATE", title: "Falha elevada de entrega", message: "Mais de 10% das tentativas iniciais falharam.", severity: "warning" });
  }
  if (input.failuresLast24h > 0 && input.consecutiveFailureCount >= 3) {
    alerts.push({ code: "CONSECUTIVE_FAILURES", title: "Falhas consecutivas de Push", message: "Os envios mais recentes registraram falhas consecutivas. Verifique VAPID, Service Worker e subscriptions.", severity: "danger" });
  }
  return alerts;
}

function serializeDevice(device: Awaited<ReturnType<typeof pushNotificationHealthRepository.listDeviceHealth>>["devices"][number]): PushNotificationDeviceHealth {
  return {
    id: device.id,
    user: device.user,
    member: device.user.member ? { ...device.user.member, displayName: getMemberDisplayName(device.user.member) } : null,
    deviceName: device.deviceName,
    platform: device.platform,
    browser: device.browser,
    endpointHashShort: device.endpointHash.slice(0, 12),
    isActive: device.isActive && !device.revokedAt,
    firstRegisteredAt: device.createdAt.toISOString(),
    lastRegisteredAt: device.updatedAt.toISOString(),
    lastNotificationAt: device.lastNotificationAt?.toISOString() ?? null,
    lastSuccessAt: device.lastSuccessAt?.toISOString() ?? null,
    lastFailureAt: device.lastFailureAt?.toISOString() ?? null,
    lastError: device.lastError,
    receivedCount: device.receivedCount,
    failedCount: device.failedCount,
    retryCount: device.retryCount,
    subscriptionCount: device.subscriptionCount,
    expiredCount: device.expiredCount,
    removedAt: device.revokedAt?.toISOString() ?? null,
    daysSinceLastRegistration: daysSince(device.updatedAt)
  };
}

export const pushNotificationHealthService = {
  async getHealth(thresholdDays = 30): Promise<PushNotificationHealthData> {
    const [raw, expiredDevices] = await Promise.all([
      pushNotificationHealthRepository.getHealthData(thresholdDays),
      pushNotificationHealthRepository.listDeviceHealth({ page: 1, pageSize: 10 })
    ]);
    const initialRate = percentage(raw.initialSucceeded, raw.initialAttempted);
    const finalRate = percentage(raw.finalSucceeded, raw.finalAttempted);
    return {
      thresholdDays,
      metrics: [
        metric("Dispositivos ativos", raw.activeDevices, "Subscriptions ativas e nao removidas", raw.activeDevices > 0 ? "success" : "danger"),
        metric("Dispositivos expirados", raw.expiredDevices, "Detectados em respostas permanentes do provedor", raw.expiredDevices > 0 ? "warning" : "success"),
        metric("Dispositivos removidos", raw.removedDevices, "Subscriptions inativas ou revogadas", raw.removedDevices > 0 ? "warning" : "neutral"),
        metric("Subscriptions invalidas", raw.invalidSubscriptions, "Expiradas ou removidas em auditoria", raw.invalidSubscriptions > 0 ? "warning" : "success"),
        metric("Registradas hoje", raw.registeredToday, "Novas subscriptions criadas hoje"),
        metric(`Sem receber ha ${thresholdDays}+ dias`, raw.staleDevices, "Dispositivos ativos sem sucesso recente", raw.staleDevices > 0 ? "warning" : "success"),
        metric("Taxa entrega inicial", `${initialRate}%`, `${raw.initialSucceeded}/${raw.initialAttempted} entregues`),
        metric("Taxa apos reenvios", `${finalRate}%`, `${raw.finalSucceeded}/${raw.finalAttempted} entregues`),
        metric("Reenvios", raw.retriesExecuted, "Tentativas de reenvio registradas"),
        metric("Falhas 24h", raw.failuresLast24h, "Falhas, expirados e removidos", raw.failuresLast24h > 0 ? "warning" : "success"),
        metric("Falhas 7 dias", raw.failuresLast7d, "Falhas, expirados e removidos"),
        metric("Falhas 30 dias", raw.failuresLast30d, "Falhas, expirados e removidos"),
        metric("Tempo medio envio", formatMs(raw.averageDurationMs), "Media por tentativa de log"),
        metric("Tempo medio/dispositivo", formatMs(raw.averageDurationPerDeviceMs), "Estimativa baseada nos ultimos 500 envios"),
        metric("Usuarios sem dispositivo", raw.usersWithoutActiveDevices, "Usuarios ativos sem subscription ativa", raw.usersWithoutActiveDevices > 0 ? "warning" : "success")
      ],
      alerts: buildAlerts(raw),
      platformDistribution: raw.platformDistribution,
      browserDistribution: raw.browserDistribution,
      devicesPerUser: raw.devicesPerUser,
      expiredDevices: expiredDevices.devices.filter((device) => !device.isActive || device.expiredCount > 0).slice(0, 10).map(serializeDevice)
    };
  },

  async listDevices(query: { page: number; pageSize: number }): Promise<PushNotificationDeviceHealthResult> {
    const { devices, total } = await pushNotificationHealthRepository.listDeviceHealth(query);
    return {
      devices: devices.map(serializeDevice),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize))
      }
    };
  }
};
