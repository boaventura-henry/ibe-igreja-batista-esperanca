import { AppError } from "@/lib/errors";
import { pushNotificationLogRepository, type PushNotificationChainLogRecord, type PushNotificationLogDeviceRecord, type PushNotificationLogDetailRecord, type PushNotificationLogRecord } from "@/repositories";
import { pushNotificationService } from "@/services/push-notification.service";
import type { PushNotificationAttemptSummary, PushNotificationChainSummary, PushNotificationLogDetailResult, PushNotificationLogListResult, PushNotificationLogSummary } from "@/types";
import { getMemberDisplayName } from "@/utils";
import type { PushNotificationLogListQuery } from "@/validators/push-notification-log.validator";

function serializeAttempt(log: { id: string; createdAt: Date; retryNumber: number; status: string; devicesAttempted: number; devicesSucceeded: number; devicesFailed: number; devicesSkipped: number; durationMs: number | null }): PushNotificationAttemptSummary {
  return {
    id: log.id,
    createdAt: log.createdAt.toISOString(),
    retryNumber: log.retryNumber,
    status: log.status,
    devicesAttempted: log.devicesAttempted,
    devicesSucceeded: log.devicesSucceeded,
    devicesFailed: log.devicesFailed,
    devicesSkipped: log.devicesSkipped,
    durationMs: log.durationMs
  };
}

function serializeLog(log: PushNotificationLogRecord): PushNotificationLogSummary {
  return {
    ...serializeAttempt(log),
    title: log.title,
    body: log.body,
    targetType: log.targetType,
    targetDescription: log.targetDescription,
    devicesFound: log.devicesFound,
    startedAt: log.startedAt?.toISOString() ?? null,
    finishedAt: log.finishedAt?.toISOString() ?? null,
    errorMessage: log.errorMessage,
    createdBy: log.createdBy,
    retriedBy: log.retriedBy,
    originalLog: log.originalLog ? serializeAttempt(log.originalLog) : null,
    retrySourceLog: log.retrySourceLog ? serializeAttempt(log.retrySourceLog) : null
  };
}

function serializeDevice(device: PushNotificationLogDeviceRecord) {
  return {
    id: device.id,
    deviceId: device.deviceId,
    sourceLogDeviceId: device.sourceLogDeviceId,
    attemptNumber: device.attemptNumber,
    user: device.user,
    member: device.member ? { ...device.member, displayName: getMemberDisplayName(device.member) } : null,
    deviceName: device.deviceName,
    platform: device.platform,
    browser: device.browser,
    status: device.status,
    endpointHashShort: device.endpointHash.slice(0, 12),
    skipReason: device.skipReason,
    httpStatus: device.httpStatus,
    pushService: device.pushService,
    errorCode: device.errorCode,
    errorMessage: device.errorMessage,
    sentAt: device.sentAt?.toISOString() ?? null,
    lastCheckedAt: device.lastCheckedAt?.toISOString() ?? null,
    sourceLogDevice: device.sourceLogDevice ? { ...device.sourceLogDevice, sentAt: device.sourceLogDevice.sentAt?.toISOString() ?? null } : null
  };
}

function deviceKey(device: PushNotificationLogDeviceRecord) {
  return device.deviceId ? `device:${device.deviceId}` : `hash:${device.endpointHash}`;
}

function buildChainSummary(chain: PushNotificationChainLogRecord[]): PushNotificationChainSummary {
  const consolidated = new Map<string, { status: string; firstAttempt: number; lastAttempt: number }>();
  let initialAttempted = 0;
  let initialSucceeded = 0;

  for (const attempt of chain) {
    if (attempt.retryNumber === 0) {
      initialAttempted += attempt.devicesAttempted;
      initialSucceeded += attempt.devicesSucceeded;
    }
    for (const device of attempt.devices) {
      const key = deviceKey(device);
      const current = consolidated.get(key);
      const next = { status: device.status, firstAttempt: current?.firstAttempt ?? attempt.retryNumber, lastAttempt: attempt.retryNumber };
      if (!current) {
        consolidated.set(key, next);
        continue;
      }
      if (current.status === "SUCCESS") continue;
      if (device.status === "SUCCESS" || ["EXPIRED", "REMOVED"].includes(device.status) || attempt.retryNumber >= current.lastAttempt) {
        consolidated.set(key, next);
      }
    }
  }

  let succeeded = 0;
  let stillFailed = 0;
  let expired = 0;
  let removed = 0;
  let skipped = 0;
  let recoveredAfterRetry = 0;
  consolidated.forEach((value) => {
    if (value.status === "SUCCESS") {
      succeeded += 1;
      if (value.lastAttempt > 0) recoveredAfterRetry += 1;
    } else if (value.status === "EXPIRED") expired += 1;
    else if (value.status === "REMOVED") removed += 1;
    else if (value.status === "SKIPPED") skipped += 1;
    else stillFailed += 1;
  });

  const totalUniqueDevices = consolidated.size;
  return {
    totalUniqueDevices,
    succeeded,
    stillFailed,
    expired,
    removed,
    skipped,
    recoveredAfterRetry,
    initialSuccessRate: initialAttempted > 0 ? Math.round((initialSucceeded / initialAttempted) * 100) : 0,
    finalSuccessRate: totalUniqueDevices > 0 ? Math.round((succeeded / totalUniqueDevices) * 100) : 0
  };
}

async function serializeDetail(log: PushNotificationLogDetailRecord): Promise<PushNotificationLogDetailResult> {
  const rootId = log.originalLogId ?? log.id;
  const [chain, eligibility] = await Promise.all([pushNotificationLogRepository.findChain(rootId), pushNotificationService.getRetryEligibility(log.id)]);
  return {
    ...serializeLog(log),
    devices: log.devices.map(serializeDevice),
    retryAttempts: chain.map(serializeAttempt),
    retrySourceAttempts: log.retrySourceAttempts.map(serializeAttempt),
    chainSummary: buildChainSummary(chain),
    retryEligibility: {
      canRetry: eligibility.canRetry,
      reason: eligibility.reason,
      failed: eligibility.failed,
      eligible: eligibility.eligible.length,
      skipped: eligibility.skipped.length,
      totals: eligibility.totals
    }
  };
}

export const pushNotificationLogService = {
  async list(query: PushNotificationLogListQuery): Promise<PushNotificationLogListResult> {
    const { logs, total } = await pushNotificationLogRepository.list(query);
    return {
      logs: logs.map(serializeLog),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize))
      }
    };
  },

  async getById(id: string): Promise<PushNotificationLogDetailResult> {
    const log = await pushNotificationLogRepository.findById(id);
    if (!log) throw new AppError("Registro de notificacao nao encontrado.", 404, "PUSH_LOG_NOT_FOUND");
    return serializeDetail(log);
  }
};
