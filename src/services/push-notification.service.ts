import { Prisma, PushNotificationLogDeviceStatus, PushNotificationLogStatus, PushNotificationSkipReason } from "@prisma/client";
import webpush from "web-push";
import { AppError } from "@/lib/errors";
import { hashPushEndpoint, pushNotificationLogRepository, pushSubscriptionRepository, type PushNotificationLogDeviceRecord } from "@/repositories";
import type { PushPreferencesInput, PushSubscribeInput, PushTestFeedbackInput, PushUnsubscribeInput } from "@/validators/push-notification.validator";
import type { PushNotificationPayload, PushStatus } from "@/types/push-notification.types";

export const PUSH_RETRY_SKIP_REASONS = {
  ALREADY_SUCCEEDED_IN_LATER_ATTEMPT: PushNotificationSkipReason.ALREADY_SUCCEEDED_IN_LATER_ATTEMPT,
  SUBSCRIPTION_NOT_FOUND: PushNotificationSkipReason.SUBSCRIPTION_NOT_FOUND,
  SUBSCRIPTION_INACTIVE: PushNotificationSkipReason.SUBSCRIPTION_INACTIVE,
  USER_INACTIVE: PushNotificationSkipReason.USER_INACTIVE,
  DEVICE_OWNER_CHANGED: PushNotificationSkipReason.DEVICE_OWNER_CHANGED,
  ENDPOINT_HASH_CHANGED: PushNotificationSkipReason.ENDPOINT_HASH_CHANGED,
  DEVICE_ALREADY_REMOVED: PushNotificationSkipReason.DEVICE_ALREADY_REMOVED,
  NO_LONGER_ELIGIBLE: PushNotificationSkipReason.NO_LONGER_ELIGIBLE,
  UNKNOWN: PushNotificationSkipReason.UNKNOWN
} as const;

type PushRetrySkipReason = PushNotificationSkipReason;

type DeliveryDevice = Awaited<ReturnType<typeof pushSubscriptionRepository.findActiveForDelivery>>[number];
type RetryDevice = NonNullable<Awaited<ReturnType<typeof pushSubscriptionRepository.findByIdForRetry>>>;

type RetryCandidate = {
  sourceDevice: PushNotificationLogDeviceRecord;
  subscription: RetryDevice;
};

type RetrySkipped = {
  sourceDevice: PushNotificationLogDeviceRecord;
  reason: PushRetrySkipReason;
};

type RetryEligibility = {
  canRetry: boolean;
  reason: string | null;
  sourceLog: Awaited<ReturnType<typeof pushNotificationLogRepository.findRetrySource>> | null;
  rootId: string | null;
  nextRetryNumber: number;
  failed: number;
  eligible: RetryCandidate[];
  skipped: RetrySkipped[];
  totals: Record<string, number>;
};

function publicKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";
}

function vapidConfigured() {
  return Boolean(publicKey() && process.env.VAPID_PRIVATE_KEY?.trim() && process.env.VAPID_SUBJECT?.trim());
}

function configureVapid() {
  const subject = process.env.VAPID_SUBJECT?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!subject || !privateKey || !publicKey()) {
    throw new AppError("As notificacoes ainda nao estao configuradas.", 503, "PUSH_NOT_CONFIGURED");
  }
  try {
    const parsedSubject = new URL(subject);
    if (!["http:", "https:", "mailto:"].includes(parsedSubject.protocol)) throw new Error("Invalid VAPID subject");
    webpush.setVapidDetails(subject, publicKey(), privateKey);
  } catch {
    throw new AppError("Configuracao VAPID invalida.", 503, "PUSH_NOT_CONFIGURED");
  }
}

function serializeDevice(device: { id: string; deviceName: string | null; userAgent: string | null; isActive: boolean; createdAt: Date; lastSuccessAt: Date | null; testSentAt: Date | null; testConfirmedAt: Date | null; testFailedAt: Date | null; setupCompletedAt: Date | null; failureCount: number }) {
  return {
    ...device,
    createdAt: device.createdAt.toISOString(),
    lastSuccessAt: device.lastSuccessAt?.toISOString() ?? null,
    testSentAt: device.testSentAt?.toISOString() ?? null,
    testConfirmedAt: device.testConfirmedAt?.toISOString() ?? null,
    testFailedAt: device.testFailedAt?.toISOString() ?? null,
    setupCompletedAt: device.setupCompletedAt?.toISOString() ?? null
  };
}

function pushErrorStatus(error: unknown) {
  return typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : null;
}

function pushErrorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") return error.code.slice(0, 120);
  if (error instanceof Error && error.name) return error.name.slice(0, 120);
  return null;
}

function pushErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message.slice(0, 500);
  return "Falha ao enviar notificacao push.";
}

function isPermanentPushFailure(error: unknown) {
  const statusCode = pushErrorStatus(error);
  const code = pushErrorCode(error)?.toLowerCase() ?? "";
  const message = pushErrorMessage(error).toLowerCase();
  return statusCode === 404 || statusCode === 410 || code.includes("invalidsubscription") || message.includes("subscription expired") || message.includes("invalid subscription");
}

function safePayloadFromUnknown(value: unknown): PushNotificationPayload | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<PushNotificationPayload>;
  if (typeof input.title !== "string" || typeof input.body !== "string") return null;
  const url = typeof input.url === "string" && input.url.startsWith("/") ? input.url : "/portal";
  return {
    title: input.title.slice(0, 120),
    body: input.body.slice(0, 500),
    url,
    tag: typeof input.tag === "string" ? input.tag.slice(0, 120) : "ibe-push-retry",
    ...(typeof input.icon === "string" && input.icon.startsWith("/") ? { icon: input.icon } : {}),
    ...(typeof input.badge === "string" && input.badge.startsWith("/") ? { badge: input.badge } : {}),
    data: { url }
  };
}

function defaultTestPayload(): PushNotificationPayload {
  return { title: "Igreja Batista Esperanca", body: "As notificacoes foram ativadas com sucesso.", url: "/portal", tag: "ibe-push-test", icon: "/icons/icon-192x192.png", badge: "/icons/icon-72x72.png", data: { url: "/portal" } };
}

async function sendToDevice(input: {
  logId: string;
  device: DeliveryDevice | RetryDevice;
  payload: PushNotificationPayload;
  attemptNumber: number;
  sourceLogDeviceId?: string | null;
  markTestSent?: boolean;
}) {
  if (input.markTestSent) await pushSubscriptionRepository.markTestSent(input.device.id);
  try {
    await webpush.sendNotification({ endpoint: input.device.endpoint, keys: { p256dh: input.device.p256dh, auth: input.device.auth }, expirationTime: input.device.expirationTime?.getTime() ?? null }, JSON.stringify(input.payload));
    await pushSubscriptionRepository.markSuccess(input.device.id);
    await pushNotificationLogRepository.createDevice({
      logId: input.logId,
      deviceId: input.device.id,
      userId: input.device.userId,
      memberId: input.device.user.memberId,
      sourceLogDeviceId: input.sourceLogDeviceId ?? null,
      attemptNumber: input.attemptNumber,
      deviceName: input.device.deviceName,
      userAgent: input.device.userAgent,
      endpoint: input.device.endpoint,
      status: PushNotificationLogDeviceStatus.SUCCESS,
      pushService: "web-push",
      sentAt: new Date()
    });
    return { status: PushNotificationLogDeviceStatus.SUCCESS, permanent: false };
  } catch (error) {
    const permanent = isPermanentPushFailure(error);
    await pushSubscriptionRepository.markFailure(input.device.id, permanent);
    await pushNotificationLogRepository.createDevice({
      logId: input.logId,
      deviceId: input.device.id,
      userId: input.device.userId,
      memberId: input.device.user.memberId,
      sourceLogDeviceId: input.sourceLogDeviceId ?? null,
      attemptNumber: input.attemptNumber,
      deviceName: input.device.deviceName,
      userAgent: input.device.userAgent,
      endpoint: input.device.endpoint,
      status: permanent ? PushNotificationLogDeviceStatus.EXPIRED : PushNotificationLogDeviceStatus.FAILED,
      httpStatus: pushErrorStatus(error),
      pushService: "web-push",
      errorCode: pushErrorCode(error),
      errorMessage: pushErrorMessage(error),
      sentAt: new Date()
    });
    return { status: permanent ? PushNotificationLogDeviceStatus.EXPIRED : PushNotificationLogDeviceStatus.FAILED, permanent };
  }
}

function increment(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1;
}

export const pushNotificationService = {
  async getStatus(userId: string): Promise<PushStatus> {
    const [preference, devices, activeDeviceCount] = await Promise.all([
      pushSubscriptionRepository.getPreference(userId),
      pushSubscriptionRepository.listByUser(userId),
      pushSubscriptionRepository.countActiveByUser(userId)
    ]);
    return { vapidConfigured: vapidConfigured(), pushEnabled: preference?.pushEnabled ?? false, activeDeviceCount, devices: devices.map(serializeDevice) };
  },

  async subscribe(userId: string, input: PushSubscribeInput, serverUserAgent?: string | null) {
    const subscription = await pushSubscriptionRepository.upsert(userId, {
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      expirationTime: input.expirationTime ? new Date(input.expirationTime) : null,
      deviceName: input.deviceName ?? null,
      userAgent: serverUserAgent ?? null
    });
    if (!subscription) throw new AppError("Este dispositivo ja esta vinculado a outro usuario.", 409, "PUSH_ENDPOINT_OWNED");
    await pushSubscriptionRepository.setPreference(userId, true);
    return { id: subscription.id };
  },

  async unsubscribe(userId: string, input: PushUnsubscribeInput) {
    if (input.id) {
      const device = await pushSubscriptionRepository.findByIdForUser(input.id, userId);
      if (!device) throw new AppError("Dispositivo nao encontrado.", 404, "PUSH_DEVICE_NOT_FOUND");
      await pushSubscriptionRepository.revokeForUser(device.id, userId);
    } else if (input.endpoint) {
      await pushSubscriptionRepository.revokeByEndpointForUser(input.endpoint, userId);
    }
    return { revoked: true };
  },

  async setPreferences(userId: string, input: PushPreferencesInput) {
    return { pushEnabled: (await pushSubscriptionRepository.setPreference(userId, input.pushEnabled)).pushEnabled };
  },

  async sendTest(userId: string) {
    configureVapid();
    const preference = await pushSubscriptionRepository.getPreference(userId);
    if (!preference?.pushEnabled) throw new AppError("Ative as notificacoes antes de enviar um teste.", 400, "PUSH_DISABLED");
    const payload = defaultTestPayload();
    const log = await pushNotificationLogRepository.createPending({ createdById: userId, title: payload.title, body: payload.body, targetType: "USER", targetDescription: "Teste de notificacao do proprio usuario", payloadJson: payload });
    const devices = await pushSubscriptionRepository.findActiveForDelivery(userId);
    await pushNotificationLogRepository.updateFound(log.id, devices.length);
    const startedAt = new Date();
    await pushNotificationLogRepository.markStarted(log.id, startedAt);
    let sent = 0;
    let failed = 0;
    for (const device of devices) {
      const result = await sendToDevice({ logId: log.id, device, payload, attemptNumber: 0, markTestSent: true });
      if (result.status === PushNotificationLogDeviceStatus.SUCCESS) sent += 1;
      else failed += 1;
    }
    await pushNotificationLogRepository.markFinished({ id: log.id, startedAt, finishedAt: new Date(), devicesAttempted: devices.length, devicesSucceeded: sent, devicesFailed: failed, errorMessage: failed > 0 ? "Uma ou mais notificacoes falharam." : null });
    return { attempted: devices.length, sent };
  },

  async getRetryEligibility(logId: string): Promise<RetryEligibility> {
    const sourceLog = await pushNotificationLogRepository.findRetrySource(logId);
    if (!sourceLog) {
      return { canRetry: false, reason: "PUSH_LOG_NOT_FOUND", sourceLog: null, rootId: null, nextRetryNumber: 0, failed: 0, eligible: [], skipped: [], totals: {} };
    }
    if (!sourceLog.finishedAt || sourceLog.status !== PushNotificationLogStatus.PARTIAL_SUCCESS && sourceLog.status !== PushNotificationLogStatus.FAILED) {
      return { canRetry: false, reason: "LOG_NOT_RETRYABLE", sourceLog, rootId: sourceLog.originalLogId ?? sourceLog.id, nextRetryNumber: sourceLog.retryNumber + 1, failed: sourceLog.devices.length, eligible: [], skipped: [], totals: {} };
    }

    const rootId = sourceLog.originalLogId ?? sourceLog.id;
    const [chain, maxRetryNumber] = await Promise.all([pushNotificationLogRepository.findChain(rootId), pushNotificationLogRepository.findMaxRetryNumber(rootId)]);
    const laterSuccessKeys = new Set<string>();
    for (const attempt of chain) {
      if (attempt.retryNumber <= sourceLog.retryNumber) continue;
      for (const device of attempt.devices) {
        if (device.status !== PushNotificationLogDeviceStatus.SUCCESS) continue;
        if (device.deviceId) laterSuccessKeys.add(`device:${device.deviceId}`);
        laterSuccessKeys.add(`hash:${device.endpointHash}`);
      }
    }

    const eligible: RetryCandidate[] = [];
    const skipped: RetrySkipped[] = [];
    const totals: Record<string, number> = {};

    for (const sourceDevice of sourceLog.devices) {
      if (!sourceDevice.deviceId) {
        skipped.push({ sourceDevice, reason: PUSH_RETRY_SKIP_REASONS.SUBSCRIPTION_NOT_FOUND });
        increment(totals, PUSH_RETRY_SKIP_REASONS.SUBSCRIPTION_NOT_FOUND);
        continue;
      }
      if (laterSuccessKeys.has(`device:${sourceDevice.deviceId}`) || laterSuccessKeys.has(`hash:${sourceDevice.endpointHash}`)) {
        skipped.push({ sourceDevice, reason: PUSH_RETRY_SKIP_REASONS.ALREADY_SUCCEEDED_IN_LATER_ATTEMPT });
        increment(totals, PUSH_RETRY_SKIP_REASONS.ALREADY_SUCCEEDED_IN_LATER_ATTEMPT);
        continue;
      }
      const subscription = await pushSubscriptionRepository.findByIdForRetry(sourceDevice.deviceId);
      if (!subscription) {
        skipped.push({ sourceDevice, reason: PUSH_RETRY_SKIP_REASONS.SUBSCRIPTION_NOT_FOUND });
        increment(totals, PUSH_RETRY_SKIP_REASONS.SUBSCRIPTION_NOT_FOUND);
        continue;
      }
      if (!subscription.isActive || subscription.revokedAt) {
        skipped.push({ sourceDevice, reason: subscription.revokedAt ? PUSH_RETRY_SKIP_REASONS.DEVICE_ALREADY_REMOVED : PUSH_RETRY_SKIP_REASONS.SUBSCRIPTION_INACTIVE });
        increment(totals, subscription.revokedAt ? PUSH_RETRY_SKIP_REASONS.DEVICE_ALREADY_REMOVED : PUSH_RETRY_SKIP_REASONS.SUBSCRIPTION_INACTIVE);
        continue;
      }
      if (!subscription.user.isActive) {
        skipped.push({ sourceDevice, reason: PUSH_RETRY_SKIP_REASONS.USER_INACTIVE });
        increment(totals, PUSH_RETRY_SKIP_REASONS.USER_INACTIVE);
        continue;
      }
      if (sourceDevice.user?.id && subscription.userId !== sourceDevice.user.id) {
        skipped.push({ sourceDevice, reason: PUSH_RETRY_SKIP_REASONS.DEVICE_OWNER_CHANGED });
        increment(totals, PUSH_RETRY_SKIP_REASONS.DEVICE_OWNER_CHANGED);
        continue;
      }
      if (hashPushEndpoint(subscription.endpoint) !== sourceDevice.endpointHash) {
        skipped.push({ sourceDevice, reason: PUSH_RETRY_SKIP_REASONS.ENDPOINT_HASH_CHANGED });
        increment(totals, PUSH_RETRY_SKIP_REASONS.ENDPOINT_HASH_CHANGED);
        continue;
      }
      eligible.push({ sourceDevice, subscription });
    }

    return {
      canRetry: eligible.length > 0,
      reason: eligible.length > 0 ? null : "NO_ELIGIBLE_FAILED_DEVICES",
      sourceLog,
      rootId,
      nextRetryNumber: maxRetryNumber + 1,
      failed: sourceLog.devices.length,
      eligible,
      skipped,
      totals
    };
  },

  async retryFailed(logId: string, userId: string, idempotencyKey?: string | null) {
    configureVapid();
    if (idempotencyKey) {
      const existing = await pushNotificationLogRepository.findByIdempotencyKey(idempotencyKey);
      if (existing) return { logId: existing.id, retryNumber: existing.retryNumber, status: existing.status, eligible: existing.devicesFound, attempted: existing.devicesAttempted, succeeded: existing.devicesSucceeded, failed: existing.devicesFailed, skipped: existing.devicesSkipped, expired: 0, removed: 0, idempotent: true };
    }

    const eligibility = await this.getRetryEligibility(logId);
    if (!eligibility.sourceLog) throw new AppError("Registro de notificacao nao encontrado.", 404, "PUSH_LOG_NOT_FOUND");
    if (!eligibility.sourceLog.finishedAt || eligibility.sourceLog.status !== PushNotificationLogStatus.PARTIAL_SUCCESS && eligibility.sourceLog.status !== PushNotificationLogStatus.FAILED) {
      throw new AppError("Somente envios concluidos com falha podem ser reenviados.", 422, "PUSH_LOG_NOT_RETRYABLE");
    }
    if (!eligibility.canRetry) {
      throw new AppError("Nao existem dispositivos com falha e inscricao valida disponiveis para reenvio.", 422, "NO_ELIGIBLE_FAILED_DEVICES");
    }

    const payload = safePayloadFromUnknown(eligibility.sourceLog.payloadJson) ?? { title: eligibility.sourceLog.title, body: eligibility.sourceLog.body, url: "/portal", tag: "ibe-push-retry", data: { url: "/portal" } };
    await pushNotificationLogRepository.releaseStaleRetryLock(eligibility.rootId ?? eligibility.sourceLog.id, new Date(Date.now() - 15 * 60 * 1000));
    let retryLog: Awaited<ReturnType<typeof pushNotificationLogRepository.createRetryLog>>;
    try {
      retryLog = await pushNotificationLogRepository.createRetryLog({
        sourceLogId: eligibility.sourceLog.id,
        originalLogId: eligibility.rootId ?? eligibility.sourceLog.id,
        retryNumber: eligibility.nextRetryNumber,
        retriedById: userId,
        title: payload.title,
        body: payload.body,
        targetDescription: `Reenvio da tentativa ${eligibility.sourceLog.retryNumber}`,
        devicesFound: eligibility.failed,
        devicesSkipped: eligibility.skipped.length,
        payloadJson: payload,
        retryLockKey: eligibility.rootId ?? eligibility.sourceLog.id,
        idempotencyKey: idempotencyKey ?? null
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        if (idempotencyKey) {
          const existing = await pushNotificationLogRepository.findByIdempotencyKey(idempotencyKey);
          if (existing) return { logId: existing.id, retryNumber: existing.retryNumber, status: existing.status, eligible: existing.devicesFound, attempted: existing.devicesAttempted, succeeded: existing.devicesSucceeded, failed: existing.devicesFailed, skipped: existing.devicesSkipped, expired: 0, removed: 0, idempotent: true };
        }
        throw new AppError("Ja existe um reenvio em processamento ou criado para esta tentativa.", 409, "RETRY_ALREADY_PROCESSING");
      }
      throw error;
    }

    const startedAt = new Date();
    await pushNotificationLogRepository.markStarted(retryLog.id, startedAt);

    for (const skipped of eligibility.skipped) {
      await pushNotificationLogRepository.createDevice({
        logId: retryLog.id,
        deviceId: skipped.sourceDevice.deviceId,
        userId: skipped.sourceDevice.user?.id ?? null,
        memberId: skipped.sourceDevice.member?.id ?? null,
        sourceLogDeviceId: skipped.sourceDevice.id,
        attemptNumber: eligibility.nextRetryNumber,
        deviceName: skipped.sourceDevice.deviceName,
        endpointHash: skipped.sourceDevice.endpointHash,
        status: PushNotificationLogDeviceStatus.SKIPPED,
        skipReason: skipped.reason,
        lastCheckedAt: new Date()
      });
    }

    let succeeded = 0;
    let failed = 0;
    let expired = 0;
    try {
      for (const candidate of eligibility.eligible) {
        const result = await sendToDevice({ logId: retryLog.id, device: candidate.subscription, payload, attemptNumber: eligibility.nextRetryNumber, sourceLogDeviceId: candidate.sourceDevice.id });
        if (result.status === PushNotificationLogDeviceStatus.SUCCESS) succeeded += 1;
        else if (result.status === PushNotificationLogDeviceStatus.EXPIRED) expired += 1;
        else failed += 1;
      }
      await pushNotificationLogRepository.markFinished({ id: retryLog.id, startedAt, finishedAt: new Date(), devicesAttempted: eligibility.eligible.length, devicesSucceeded: succeeded, devicesFailed: failed + expired, devicesSkipped: eligibility.skipped.length, errorMessage: failed + expired > 0 ? "Uma ou mais notificacoes falharam no reenvio." : null });
    } catch (error) {
      await pushNotificationLogRepository.markFailed({ id: retryLog.id, startedAt, errorMessage: pushErrorMessage(error) });
      throw error;
    }

    return { logId: retryLog.id, retryNumber: eligibility.nextRetryNumber, status: succeeded > 0 && failed + expired === 0 ? PushNotificationLogStatus.SUCCESS : succeeded > 0 ? PushNotificationLogStatus.PARTIAL_SUCCESS : PushNotificationLogStatus.FAILED, eligible: eligibility.eligible.length, attempted: eligibility.eligible.length, succeeded, failed, expired, removed: 0, skipped: eligibility.skipped.length, idempotent: false };
  },

  async recordTestFeedback(userId: string, input: PushTestFeedbackInput) {
    const device = await pushSubscriptionRepository.findByEndpointForUser(input.endpoint, userId);
    if (!device) throw new AppError("Dispositivo nao encontrado ou ja desativado.", 404, "PUSH_DEVICE_NOT_FOUND");
    await pushSubscriptionRepository.recordTestFeedback(device.id, input.received);
    return { recorded: true };
  }
};
