import { PushNotificationLogDeviceStatus, PushNotificationLogStatus, PushNotificationSkipReason, type Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { prisma } from "@/prisma/client";
import type { PushNotificationLogListQuery } from "@/validators/push-notification-log.validator";

const userMiniSelect = { id: true, name: true, username: true } as const;
const logMiniSelect = { id: true, createdAt: true, retryNumber: true, status: true, devicesAttempted: true, devicesSucceeded: true, devicesFailed: true, devicesSkipped: true, durationMs: true } as const;

const logSelect = {
  id: true,
  createdAt: true,
  originalLogId: true,
  retrySourceLogId: true,
  retryNumber: true,
  retriedById: true,
  title: true,
  body: true,
  targetType: true,
  targetDescription: true,
  devicesFound: true,
  devicesAttempted: true,
  devicesSucceeded: true,
  devicesFailed: true,
  devicesSkipped: true,
  status: true,
  startedAt: true,
  finishedAt: true,
  durationMs: true,
  errorMessage: true,
  createdBy: { select: userMiniSelect },
  retriedBy: { select: userMiniSelect },
  originalLog: { select: logMiniSelect },
  retrySourceLog: { select: logMiniSelect }
} satisfies Prisma.PushNotificationLogSelect;

const deviceSelect = {
  id: true,
  deviceId: true,
  sourceLogDeviceId: true,
  attemptNumber: true,
  user: { select: userMiniSelect },
  member: { select: { id: true, name: true, nickname: true } },
  deviceName: true,
  platform: true,
  browser: true,
  endpointHash: true,
  status: true,
  skipReason: true,
  httpStatus: true,
  pushService: true,
  errorCode: true,
  errorMessage: true,
  sentAt: true,
  lastCheckedAt: true,
  sourceLogDevice: { select: { id: true, status: true, sentAt: true } }
} satisfies Prisma.PushNotificationLogDeviceSelect;

export type PushNotificationLogRecord = Prisma.PushNotificationLogGetPayload<{ select: typeof logSelect }>;
export type PushNotificationLogDeviceRecord = Prisma.PushNotificationLogDeviceGetPayload<{ select: typeof deviceSelect }>;
export type PushNotificationLogDetailRecord = Prisma.PushNotificationLogGetPayload<{ select: typeof logSelect & { payloadJson: true; devices: { select: typeof deviceSelect; orderBy: [{ attemptNumber: "asc" }, { sentAt: "desc" }] }; retryAttempts: { select: typeof logMiniSelect; orderBy: { retryNumber: "asc" } }; retrySourceAttempts: { select: typeof logMiniSelect; orderBy: { retryNumber: "asc" } } } }>;
export type PushNotificationChainLogRecord = Prisma.PushNotificationLogGetPayload<{ select: typeof logMiniSelect & { devices: { select: typeof deviceSelect } } }>;
export type PushNotificationRetrySourceRecord = Prisma.PushNotificationLogGetPayload<{ select: typeof logSelect & { payloadJson: true; devices: { select: typeof deviceSelect; where: { status: typeof PushNotificationLogDeviceStatus.FAILED } } } }>;

function parseDate(value: string | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function whereFromQuery(query: PushNotificationLogListQuery): Prisma.PushNotificationLogWhereInput {
  const from = parseDate(query.from);
  const to = parseDate(query.to);
  return {
    ...(query.status ? { status: query.status } : {}),
    ...(query.userId ? { OR: [{ createdById: query.userId }, { retriedById: query.userId }] } : {}),
    ...(query.search ? { OR: [{ title: { contains: query.search, mode: "insensitive" } }, { body: { contains: query.search, mode: "insensitive" } }] } : {}),
    ...(query.target ? { targetDescription: { contains: query.target, mode: "insensitive" } } : {}),
    ...((from || to) ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {})
  };
}

export function hashPushEndpoint(endpoint: string) {
  return createHash("sha256").update(endpoint).digest("hex");
}

export const pushNotificationLogRepository = {
  createPending(input: {
    createdById?: string | null;
    title: string;
    body: string;
    targetType: Prisma.PushNotificationLogCreateInput["targetType"];
    targetDescription?: string | null;
    payloadJson?: Prisma.InputJsonValue | null;
  }) {
    return prisma.pushNotificationLog.create({
      data: {
        createdById: input.createdById ?? null,
        title: input.title,
        body: input.body,
        targetType: input.targetType,
        targetDescription: input.targetDescription ?? null,
        payloadJson: input.payloadJson ?? undefined,
        status: PushNotificationLogStatus.PENDING
      }
    });
  },

  findById(id: string) {
    return prisma.pushNotificationLog.findUnique({
      where: { id },
      select: {
        ...logSelect,
        payloadJson: true,
        devices: { select: deviceSelect, orderBy: [{ attemptNumber: "asc" }, { sentAt: "desc" }] },
        retryAttempts: { select: logMiniSelect, orderBy: { retryNumber: "asc" } },
        retrySourceAttempts: { select: logMiniSelect, orderBy: { retryNumber: "asc" } }
      }
    });
  },

  findRetrySource(id: string) {
    return prisma.pushNotificationLog.findUnique({
      where: { id },
      select: { ...logSelect, payloadJson: true, devices: { where: { status: PushNotificationLogDeviceStatus.FAILED }, select: deviceSelect } }
    });
  },

  findByIdempotencyKey(idempotencyKey: string) {
    return prisma.pushNotificationLog.findUnique({ where: { idempotencyKey }, select: logSelect });
  },

  async createRetryLog(input: {
    sourceLogId: string;
    originalLogId: string;
    retryNumber: number;
    retriedById: string;
    title: string;
    body: string;
    targetDescription?: string | null;
    devicesFound: number;
    devicesSkipped: number;
    payloadJson?: Prisma.InputJsonValue | null;
    retryLockKey: string;
    idempotencyKey?: string | null;
  }) {
    return prisma.pushNotificationLog.create({
      data: {
        createdById: input.retriedById,
        originalLogId: input.originalLogId,
        retrySourceLogId: input.sourceLogId,
        retryNumber: input.retryNumber,
        retriedById: input.retriedById,
        title: input.title,
        body: input.body,
        targetType: "RETRY_FAILED",
        targetDescription: input.targetDescription ?? "Reenvio para dispositivos com falha",
        devicesFound: input.devicesFound,
        devicesSkipped: input.devicesSkipped,
        retryLockKey: input.retryLockKey,
        idempotencyKey: input.idempotencyKey ?? null,
        payloadJson: input.payloadJson ?? undefined,
        status: PushNotificationLogStatus.PENDING
      }
    });
  },

  updateFound(id: string, devicesFound: number) {
    return prisma.pushNotificationLog.update({ where: { id }, data: { devicesFound } });
  },

  markStarted(id: string, startedAt: Date) {
    return prisma.pushNotificationLog.update({ where: { id }, data: { startedAt } });
  },

  createDevice(input: {
    logId: string;
    deviceId?: string | null;
    userId?: string | null;
    memberId?: string | null;
    sourceLogDeviceId?: string | null;
    attemptNumber?: number;
    deviceName?: string | null;
    userAgent?: string | null;
    endpoint?: string | null;
    endpointHash?: string | null;
    status: PushNotificationLogDeviceStatus;
    skipReason?: PushNotificationSkipReason | null;
    httpStatus?: number | null;
    pushService?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    sentAt?: Date | null;
    lastCheckedAt?: Date | null;
  }) {
    const endpointHash = input.endpointHash ?? (input.endpoint ? hashPushEndpoint(input.endpoint) : null);
    if (!endpointHash) throw new Error("Endpoint hash is required for push audit device logs.");
    return prisma.pushNotificationLogDevice.create({
      data: {
        logId: input.logId,
        deviceId: input.deviceId ?? null,
        userId: input.userId ?? null,
        memberId: input.memberId ?? null,
        sourceLogDeviceId: input.sourceLogDeviceId ?? null,
        attemptNumber: input.attemptNumber ?? 0,
        deviceName: input.deviceName ?? null,
        platform: parsePlatform(input.userAgent ?? input.deviceName ?? ""),
        browser: parseBrowser(input.userAgent ?? input.deviceName ?? ""),
        endpointHash,
        status: input.status,
        skipReason: input.skipReason ?? null,
        httpStatus: input.httpStatus ?? null,
        pushService: input.pushService ?? null,
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage?.slice(0, 500) ?? null,
        sentAt: input.sentAt ?? new Date(),
        lastCheckedAt: input.lastCheckedAt ?? null
      }
    });
  },

  markFinished(input: { id: string; startedAt: Date; finishedAt: Date; devicesAttempted: number; devicesSucceeded: number; devicesFailed: number; devicesSkipped?: number; errorMessage?: string | null }) {
    const status = input.devicesAttempted === 0 || input.devicesSucceeded === 0
      ? PushNotificationLogStatus.FAILED
      : input.devicesFailed > 0
        ? PushNotificationLogStatus.PARTIAL_SUCCESS
        : PushNotificationLogStatus.SUCCESS;
    return prisma.pushNotificationLog.update({
      where: { id: input.id },
      data: {
        devicesAttempted: input.devicesAttempted,
        devicesSucceeded: input.devicesSucceeded,
        devicesFailed: input.devicesFailed,
        devicesSkipped: input.devicesSkipped ?? undefined,
        status,
        retryLockKey: null,
        finishedAt: input.finishedAt,
        durationMs: Math.max(0, input.finishedAt.getTime() - input.startedAt.getTime()),
        errorMessage: input.errorMessage?.slice(0, 500) ?? null
      }
    });
  },

  markFailed(input: { id: string; startedAt?: Date | null; errorMessage: string }) {
    const finishedAt = new Date();
    return prisma.pushNotificationLog.update({
      where: { id: input.id },
      data: {
        status: PushNotificationLogStatus.FAILED,
        retryLockKey: null,
        finishedAt,
        durationMs: input.startedAt ? Math.max(0, finishedAt.getTime() - input.startedAt.getTime()) : null,
        errorMessage: input.errorMessage.slice(0, 500)
      }
    });
  },

  async list(query: PushNotificationLogListQuery) {
    const where = whereFromQuery(query);
    const [logs, total] = await prisma.$transaction([
      prisma.pushNotificationLog.findMany({
        where,
        select: logSelect,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize
      }),
      prisma.pushNotificationLog.count({ where })
    ]);
    return { logs, total };
  },

  async findChain(rootId: string) {
    return prisma.pushNotificationLog.findMany({
      where: { OR: [{ id: rootId }, { originalLogId: rootId }] },
      select: { ...logMiniSelect, devices: { select: deviceSelect } },
      orderBy: { retryNumber: "asc" }
    });
  },

  async findMaxRetryNumber(rootId: string) {
    const max = await prisma.pushNotificationLog.aggregate({
      where: { OR: [{ id: rootId }, { originalLogId: rootId }] },
      _max: { retryNumber: true }
    });
    return max._max.retryNumber ?? 0;
  },

  releaseStaleRetryLock(rootId: string, staleBefore: Date) {
    const finishedAt = new Date();
    return prisma.pushNotificationLog.updateMany({
      where: {
        retryLockKey: rootId,
        status: PushNotificationLogStatus.PENDING,
        createdAt: { lt: staleBefore }
      },
      data: {
        retryLockKey: null,
        status: PushNotificationLogStatus.FAILED,
        finishedAt,
        errorMessage: "Reenvio marcado como falho por timeout operacional."
      }
    });
  },

  async getDashboardMetrics() {
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const [sentToday, successTotals, activeDevices, expiredDevices, failuresLast24h, retriesExecuted, recoveredDevices] = await prisma.$transaction([
      prisma.pushNotificationLog.count({ where: { createdAt: { gte: todayStart }, status: { in: [PushNotificationLogStatus.SUCCESS, PushNotificationLogStatus.PARTIAL_SUCCESS] } } }),
      prisma.pushNotificationLog.aggregate({ _sum: { devicesAttempted: true, devicesSucceeded: true }, where: { createdAt: { gte: todayStart } } }),
      prisma.pushSubscription.count({ where: { isActive: true, revokedAt: null } }),
      prisma.pushNotificationLogDevice.count({ where: { status: { in: [PushNotificationLogDeviceStatus.EXPIRED, PushNotificationLogDeviceStatus.REMOVED] } } }),
      prisma.pushNotificationLogDevice.count({ where: { sentAt: { gte: last24h }, status: { not: PushNotificationLogDeviceStatus.SUCCESS } } }),
      prisma.pushNotificationLog.count({ where: { targetType: "RETRY_FAILED" } }),
      prisma.pushNotificationLogDevice.count({ where: { attemptNumber: { gt: 0 }, status: PushNotificationLogDeviceStatus.SUCCESS } })
    ]);
    const attempted = successTotals._sum.devicesAttempted ?? 0;
    const succeeded = successTotals._sum.devicesSucceeded ?? 0;
    return { sentToday, successRate: attempted > 0 ? Math.round((succeeded / attempted) * 100) : 0, activeDevices, expiredDevices, failuresLast24h, retriesExecuted, recoveredDevices };
  }
};

function parsePlatform(source: string) {
  const value = source.toLowerCase();
  if (/android/.test(value)) return "Android";
  if (/iphone|ipad|ipod/.test(value)) return "iOS";
  if (/windows|win32|win64/.test(value)) return "Windows";
  if (/mac os|macintosh/.test(value)) return "macOS";
  if (/linux/.test(value)) return "Linux";
  return null;
}

function parseBrowser(source: string) {
  const value = source.toLowerCase();
  if (/edg\//.test(value)) return "Edge";
  if (/chrome\//.test(value)) return "Chrome";
  if (/safari\//.test(value) && !/chrome\//.test(value)) return "Safari";
  if (/firefox\//.test(value)) return "Firefox";
  return null;
}
