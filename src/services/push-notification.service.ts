import webpush from "web-push";
import { AppError } from "@/lib/errors";
import { pushSubscriptionRepository } from "@/repositories";
import type { PushPreferencesInput, PushSubscribeInput, PushTestFeedbackInput, PushUnsubscribeInput } from "@/validators/push-notification.validator";
import type { PushNotificationPayload, PushStatus } from "@/types/push-notification.types";

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
    throw new AppError("As notificações ainda não estão configuradas.", 503, "PUSH_NOT_CONFIGURED");
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
      if (!device) throw new AppError("Dispositivo não encontrado.", 404, "PUSH_DEVICE_NOT_FOUND");
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
    if (!preference?.pushEnabled) throw new AppError("Ative as notificações antes de enviar um teste.", 400, "PUSH_DISABLED");
    const devices = await pushSubscriptionRepository.findActiveForDelivery(userId);
    const payload: PushNotificationPayload = { title: "Igreja Batista Esperança", body: "As notificações foram ativadas com sucesso.", url: "/portal", tag: "ibe-push-test", icon: "/icons/icon-192x192.png", badge: "/icons/icon-72x72.png", data: { url: "/portal" } };
    let sent = 0;
    for (const device of devices) {
      try {
        await pushSubscriptionRepository.markTestSent(device.id);
        await webpush.sendNotification({ endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth }, expirationTime: device.expirationTime?.getTime() ?? null }, JSON.stringify(payload));
        await pushSubscriptionRepository.markSuccess(device.id);
        sent += 1;
      } catch (error) {
        const statusCode = typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : 0;
        await pushSubscriptionRepository.markFailure(device.id, statusCode === 404 || statusCode === 410);
      }
    }
    return { attempted: devices.length, sent };
  },
  async recordTestFeedback(userId: string, input: PushTestFeedbackInput) {
    const device = await pushSubscriptionRepository.findByEndpointForUser(input.endpoint, userId);
    if (!device) throw new AppError("Dispositivo nÃ£o encontrado ou jÃ¡ desativado.", 404, "PUSH_DEVICE_NOT_FOUND");
    await pushSubscriptionRepository.recordTestFeedback(device.id, input.received);
    return { recorded: true };
  }
};
