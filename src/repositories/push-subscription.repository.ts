import { prisma } from "@/prisma/client";

const deviceSelect = {
  id: true,
  deviceName: true,
  userAgent: true,
  isActive: true,
  createdAt: true,
  lastSuccessAt: true,
  testSentAt: true,
  testConfirmedAt: true,
  testFailedAt: true,
  setupCompletedAt: true,
  failureCount: true
} as const;

export const pushSubscriptionRepository = {
  listByUser(userId: string) {
    return prisma.pushSubscription.findMany({
      where: { userId, isActive: true, revokedAt: null },
      select: deviceSelect,
      orderBy: { createdAt: "desc" }
    });
  },
  countActiveByUser(userId: string) {
    return prisma.pushSubscription.count({ where: { userId, isActive: true, revokedAt: null } });
  },
  findByEndpoint(endpoint: string) {
    return prisma.pushSubscription.findUnique({ where: { endpoint } });
  },
  findByIdForUser(id: string, userId: string) {
    return prisma.pushSubscription.findFirst({ where: { id, userId } });
  },
  findByEndpointForUser(endpoint: string, userId: string) {
    return prisma.pushSubscription.findFirst({ where: { endpoint, userId, isActive: true, revokedAt: null }, select: { id: true } });
  },
  async upsert(userId: string, input: { endpoint: string; p256dh: string; auth: string; expirationTime?: Date | null; deviceName?: string | null; userAgent?: string | null }) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.pushSubscription.findUnique({ where: { endpoint: input.endpoint } });
      if (existing && existing.userId !== userId) return null;
      if (existing) {
        return tx.pushSubscription.update({
          where: { id: existing.id },
          data: { ...input, isActive: true, revokedAt: null, lastFailureAt: null, failureCount: 0 }
        });
      }
      return tx.pushSubscription.create({ data: { ...input, userId, isActive: true, revokedAt: null } });
    });
  },
  revokeForUser(id: string, userId: string) {
    return prisma.pushSubscription.updateMany({ where: { id, userId }, data: { isActive: false, revokedAt: new Date() } });
  },
  revokeByEndpointForUser(endpoint: string, userId: string) {
    return prisma.pushSubscription.updateMany({ where: { endpoint, userId }, data: { isActive: false, revokedAt: new Date() } });
  },
  findActiveForDelivery(userId: string) {
    return prisma.pushSubscription.findMany({ where: { userId, isActive: true, revokedAt: null } });
  },
  markSuccess(id: string) {
    return prisma.pushSubscription.update({ where: { id }, data: { lastUsedAt: new Date(), lastSuccessAt: new Date(), lastFailureAt: null, failureCount: 0 } });
  },
  markTestSent(id: string) {
    return prisma.pushSubscription.update({ where: { id }, data: { testSentAt: new Date(), testConfirmedAt: null, testFailedAt: null, setupCompletedAt: null } });
  },
  recordTestFeedback(id: string, received: boolean) {
    return prisma.pushSubscription.update({
      where: { id },
      data: received
        ? { testConfirmedAt: new Date(), setupCompletedAt: new Date(), testFailedAt: null }
        : { testFailedAt: new Date(), testConfirmedAt: null, setupCompletedAt: null }
    });
  },
  markFailure(id: string, permanent: boolean) {
    return prisma.pushSubscription.update({ where: { id }, data: { lastUsedAt: new Date(), lastFailureAt: new Date(), failureCount: { increment: 1 }, ...(permanent ? { isActive: false, revokedAt: new Date() } : {}) } });
  },
  getPreference(userId: string) {
    return prisma.notificationPreference.findUnique({ where: { userId } });
  },
  setPreference(userId: string, pushEnabled: boolean) {
    return prisma.notificationPreference.upsert({ where: { userId }, create: { userId, pushEnabled }, update: { pushEnabled } });
  }
};

export type PushDeviceRecord = Awaited<ReturnType<typeof pushSubscriptionRepository.listByUser>>[number];
