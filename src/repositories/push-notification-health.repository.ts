import { PushNotificationLogDeviceStatus, PushNotificationLogStatus } from "@prisma/client";
import { prisma } from "@/prisma/client";
import { hashPushEndpoint } from "@/repositories/push-notification-log.repository";

function parsePlatform(source: string | null | undefined) {
  const value = (source ?? "").toLowerCase();
  if (/android/.test(value)) return "Android";
  if (/iphone|ipad|ipod/.test(value)) return "iOS";
  if (/windows|win32|win64/.test(value)) return "Windows";
  if (/mac os|macintosh/.test(value)) return "macOS";
  if (/linux/.test(value)) return "Linux";
  return "Outros";
}

function parseBrowser(source: string | null | undefined) {
  const value = (source ?? "").toLowerCase();
  if (/samsungbrowser/.test(value)) return "Samsung Internet";
  if (/edg\//.test(value)) return "Edge";
  if (/chrome\//.test(value)) return "Chrome";
  if (/firefox\//.test(value)) return "Firefox";
  if (/safari\//.test(value) && !/chrome\//.test(value)) return "Safari";
  return "Outros";
}


function groupCount(group: { _count?: true | { id?: number | null } }): number {
  return typeof group._count === "object" ? group._count.id ?? 0 : 0;
}
function startOfTodayUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export const pushNotificationHealthRepository = {
  async getHealthData(thresholdDays: number) {
    const now = new Date();
    const todayStart = startOfTodayUtc();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const staleDate = new Date(now.getTime() - thresholdDays * 24 * 60 * 60 * 1000);

    const [
      activeDevices,
      removedDevices,
      registeredToday,
      staleDevices,
      usersWithoutActiveDevices,
      expiredDevices,
      invalidSubscriptions,
      initialTotals,
      finalTotals,
      retriesExecuted,
      failuresLast24h,
      failuresLast7d,
      failuresLast30d,
      averageDuration,
      durationSamples,
      platformGroups,
      browserGroups,
      devicesPerUserGroups,
      consecutiveFailureLogs
    ] = await prisma.$transaction([
      prisma.pushSubscription.count({ where: { isActive: true, revokedAt: null } }),
      prisma.pushSubscription.count({ where: { OR: [{ isActive: false }, { revokedAt: { not: null } }] } }),
      prisma.pushSubscription.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.pushSubscription.count({ where: { isActive: true, revokedAt: null, OR: [{ lastSuccessAt: { lt: staleDate } }, { lastSuccessAt: null, createdAt: { lt: staleDate } }] } }),
      prisma.user.count({ where: { isActive: true, pushSubscriptions: { none: { isActive: true, revokedAt: null } } } }),
      prisma.pushNotificationLogDevice.count({ where: { status: PushNotificationLogDeviceStatus.EXPIRED } }),
      prisma.pushNotificationLogDevice.count({ where: { status: { in: [PushNotificationLogDeviceStatus.EXPIRED, PushNotificationLogDeviceStatus.REMOVED] } } }),
      prisma.pushNotificationLog.aggregate({ _sum: { devicesAttempted: true, devicesSucceeded: true }, where: { retryNumber: 0 } }),
      prisma.pushNotificationLog.aggregate({ _sum: { devicesAttempted: true, devicesSucceeded: true }, where: {} }),
      prisma.pushNotificationLog.count({ where: { targetType: "RETRY_FAILED" } }),
      prisma.pushNotificationLogDevice.count({ where: { sentAt: { gte: last24h }, status: { in: [PushNotificationLogDeviceStatus.FAILED, PushNotificationLogDeviceStatus.EXPIRED, PushNotificationLogDeviceStatus.REMOVED] } } }),
      prisma.pushNotificationLogDevice.count({ where: { sentAt: { gte: last7d }, status: { in: [PushNotificationLogDeviceStatus.FAILED, PushNotificationLogDeviceStatus.EXPIRED, PushNotificationLogDeviceStatus.REMOVED] } } }),
      prisma.pushNotificationLogDevice.count({ where: { sentAt: { gte: last30d }, status: { in: [PushNotificationLogDeviceStatus.FAILED, PushNotificationLogDeviceStatus.EXPIRED, PushNotificationLogDeviceStatus.REMOVED] } } }),
      prisma.pushNotificationLog.aggregate({ _avg: { durationMs: true }, where: { durationMs: { not: null } } }),
      prisma.pushNotificationLog.findMany({ where: { durationMs: { not: null }, devicesAttempted: { gt: 0 } }, select: { durationMs: true, devicesAttempted: true }, orderBy: { createdAt: "desc" }, take: 500 }),
      prisma.pushNotificationLogDevice.groupBy({ by: ["platform"], _count: { id: true }, orderBy: { _count: { id: "desc" } } }),
      prisma.pushNotificationLogDevice.groupBy({ by: ["browser"], _count: { id: true }, orderBy: { _count: { id: "desc" } } }),
      prisma.pushSubscription.groupBy({ by: ["userId"], _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 10 }),
      prisma.pushNotificationLog.findMany({ where: { status: PushNotificationLogStatus.FAILED }, select: { id: true }, orderBy: { createdAt: "desc" }, take: 3 })
    ]);

    const userIds = devicesPerUserGroups.map((group) => group.userId);
    const users = userIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, username: true } })
      : [];
    const userById = new Map(users.map((user) => [user.id, user]));

    return {
      activeDevices,
      removedDevices,
      registeredToday,
      staleDevices,
      usersWithoutActiveDevices,
      expiredDevices,
      invalidSubscriptions,
      initialAttempted: initialTotals._sum.devicesAttempted ?? 0,
      initialSucceeded: initialTotals._sum.devicesSucceeded ?? 0,
      finalAttempted: finalTotals._sum.devicesAttempted ?? 0,
      finalSucceeded: finalTotals._sum.devicesSucceeded ?? 0,
      retriesExecuted,
      failuresLast24h,
      failuresLast7d,
      failuresLast30d,
      averageDurationMs: Math.round(averageDuration._avg.durationMs ?? 0),
      averageDurationPerDeviceMs: Math.round(durationSamples.reduce((sum, item) => sum + ((item.durationMs ?? 0) / Math.max(1, item.devicesAttempted)), 0) / Math.max(1, durationSamples.length)),
      platformDistribution: platformGroups.map((group) => ({ label: group.platform ?? "Outros", count: groupCount(group) })),
      browserDistribution: browserGroups.map((group) => ({ label: group.browser ?? "Outros", count: groupCount(group) })),
      devicesPerUser: devicesPerUserGroups.map((group) => ({ label: userById.get(group.userId)?.name ?? group.userId, count: groupCount(group) })),
      consecutiveFailureCount: consecutiveFailureLogs.length
    };
  },

  async listDeviceHealth(query: { page: number; pageSize: number }) {
    const where = {};
    const [subscriptions, total] = await prisma.$transaction([
      prisma.pushSubscription.findMany({
        where,
        select: {
          id: true,
          userId: true,
          endpoint: true,
          deviceName: true,
          userAgent: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          lastUsedAt: true,
          lastSuccessAt: true,
          lastFailureAt: true,
          revokedAt: true,
          user: { select: { id: true, name: true, username: true, member: { select: { id: true, name: true, nickname: true } } } }
        },
        orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize
      }),
      prisma.pushSubscription.count({ where })
    ]);

    const deviceIds = subscriptions.map((subscription) => subscription.id);
    const userIds = [...new Set(subscriptions.map((subscription) => subscription.userId))];
    const [logDevices, subscriptionCounts] = await Promise.all([
      deviceIds.length > 0
        ? prisma.pushNotificationLogDevice.findMany({
            where: { deviceId: { in: deviceIds } },
            select: { deviceId: true, status: true, errorCode: true, errorMessage: true, sentAt: true, attemptNumber: true, log: { select: { targetType: true } } },
            orderBy: { sentAt: "desc" }
          })
        : [],
      userIds.length > 0
        ? prisma.pushSubscription.groupBy({ by: ["userId"], where: { userId: { in: userIds } }, _count: { id: true } })
        : []
    ]);

    const logsByDevice = new Map<string, typeof logDevices>();
    for (const logDevice of logDevices) {
      if (!logDevice.deviceId) continue;
      const current = logsByDevice.get(logDevice.deviceId) ?? [];
      current.push(logDevice);
      logsByDevice.set(logDevice.deviceId, current);
    }
    const subscriptionCountByUser = new Map(subscriptionCounts.map((item) => [item.userId, groupCount(item)]));

    return {
      total,
      devices: subscriptions.map((subscription) => {
        const logs = logsByDevice.get(subscription.id) ?? [];
        const lastError = logs.find((log) => log.status !== PushNotificationLogDeviceStatus.SUCCESS && log.status !== PushNotificationLogDeviceStatus.SKIPPED);
        const endpointHash = hashPushEndpoint(subscription.endpoint);
        return {
          ...subscription,
          endpoint: undefined,
          endpointHash,
          platform: parsePlatform(subscription.userAgent ?? subscription.deviceName),
          browser: parseBrowser(subscription.userAgent ?? subscription.deviceName),
          receivedCount: logs.filter((log) => log.status === PushNotificationLogDeviceStatus.SUCCESS).length,
          failedCount: logs.filter((log) => log.status === PushNotificationLogDeviceStatus.FAILED || log.status === PushNotificationLogDeviceStatus.EXPIRED || log.status === PushNotificationLogDeviceStatus.REMOVED).length,
          retryCount: logs.filter((log) => log.attemptNumber > 0 || log.log.targetType === "RETRY_FAILED").length,
          expiredCount: logs.filter((log) => log.status === PushNotificationLogDeviceStatus.EXPIRED).length,
          lastNotificationAt: logs[0]?.sentAt ?? null,
          lastError: lastError?.errorCode ?? lastError?.errorMessage ?? null,
          subscriptionCount: subscriptionCountByUser.get(subscription.userId) ?? 1
        };
      })
    };
  }
};

export type PushNotificationHealthRaw = Awaited<ReturnType<typeof pushNotificationHealthRepository.getHealthData>>;
export type PushNotificationDeviceHealthRaw = Awaited<ReturnType<typeof pushNotificationHealthRepository.listDeviceHealth>>["devices"][number];

