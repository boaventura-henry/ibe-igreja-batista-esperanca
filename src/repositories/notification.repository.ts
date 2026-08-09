import { type NotificationType, Prisma } from "@prisma/client";
import { prisma } from "@/prisma/client";
import type {
  NotificationCreateInput,
  NotificationListQueryInput,
  NotificationPreferencesUpdateInput
} from "@/validators/notification.validator";

const notificationSelect = {
  id: true,
  userId: true,
  createdById: true,
  type: true,
  title: true,
  message: true,
  entityType: true,
  entityId: true,
  actionUrl: true,
  scheduledFor: true,
  expiresAt: true,
  sentAt: true,
  readAt: true,
  createdAt: true,
  updatedAt: true,
  hiddenAt: true,
  cancelledAt: true,
  deletedAt: true
} satisfies Prisma.NotificationSelect;

export type NotificationRecord = Prisma.NotificationGetPayload<{
  select: typeof notificationSelect;
}>;

export type NotificationDatabase = Prisma.TransactionClient | typeof prisma;

// 0x00494245 represents "IBE"; the second key identifies this specific internal job.
export const INTERNAL_JOB_LOCK_NAMESPACE = 0x00494245;
export const SCHEDULE_REMINDERS_CRON_LOCK_KEY = 1;

export type DueScheduledNotificationRecord = {
  id: string;
  userId: string;
  entityType: string | null;
  entityId: string | null;
  expiresAt: Date | null;
  deduplicationKey: string | null;
};

export function buildNotificationListWhere(
  userId: string,
  filters: NotificationListQueryInput
): Prisma.NotificationWhereInput {
  return {
    userId,
    hiddenAt: null,
    deletedAt: null,
    cancelledAt: null,
    sentAt: { not: null },
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.status === "unread"
      ? { readAt: null }
      : filters.status === "read"
        ? { readAt: { not: null } }
        : {})
  };
}

export function buildNotificationUnreadWhere(userId: string): Prisma.NotificationWhereInput {
  return {
    userId,
    hiddenAt: null,
    deletedAt: null,
    cancelledAt: null,
    sentAt: { not: null },
    readAt: null
  };
}

export function buildNotificationCreateData(
  input: NotificationCreateInput,
  now = new Date()
): Prisma.NotificationUncheckedCreateInput {
  const scheduledFor = input.scheduledFor ?? null;

  return {
    userId: input.userId,
    createdById: input.createdById ?? null,
    type: input.type,
    title: input.title,
    message: input.message,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    actionUrl: input.entityType ? null : input.actionUrl ?? null,
    scheduledFor,
    expiresAt: input.expiresAt ?? null,
    sentAt: !scheduledFor || scheduledFor <= now ? now : null,
    deduplicationKey: input.deduplicationKey ?? null
  };
}

export const notificationRepository = {
  transaction<T>(callback: (database: Prisma.TransactionClient) => Promise<T>) {
    return prisma.$transaction(callback, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5_000,
      timeout: 30_000
    });
  },

  async tryAcquireScheduleReminderProcessingLock(database: NotificationDatabase) {
    const [result] = await database.$queryRaw<Array<{ acquired: boolean }>>`
      SELECT pg_try_advisory_xact_lock(
        CAST(${INTERNAL_JOB_LOCK_NAMESPACE} AS INTEGER),
        CAST(${SCHEDULE_REMINDERS_CRON_LOCK_KEY} AS INTEGER)
      ) AS "acquired"
    `;
    return result?.acquired === true;
  },

  async listForUser(userId: string, filters: NotificationListQueryInput) {
    const where = buildNotificationListWhere(userId, filters);
    const skip = (filters.page - 1) * filters.pageSize;

    const [notifications, total, unreadCount] = await prisma.$transaction([
      prisma.notification.findMany({
        where,
        select: notificationSelect,
        orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
        skip,
        take: filters.pageSize
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: buildNotificationUnreadWhere(userId) })
    ]);

    return { notifications, total, unreadCount };
  },

  countUnreadForUser(userId: string) {
    return prisma.notification.count({ where: buildNotificationUnreadWhere(userId) });
  },

  findByIdForUser(id: string, userId: string) {
    return prisma.notification.findFirst({
      where: {
        id,
        userId,
        hiddenAt: null,
        deletedAt: null,
        cancelledAt: null,
        sentAt: { not: null }
      },
      select: notificationSelect
    });
  },

  findByDeduplicationKey(userId: string, deduplicationKey: string) {
    return prisma.notification.findUnique({
      where: { userId_deduplicationKey: { userId, deduplicationKey } },
      select: notificationSelect
    });
  },

  create(input: NotificationCreateInput, database: NotificationDatabase = prisma) {
    return database.notification.create({
      data: buildNotificationCreateData(input),
      select: notificationSelect
    });
  },

  createMany(inputs: NotificationCreateInput[], database: NotificationDatabase = prisma) {
    return database.notification.createMany({
      data: inputs.map((input) => buildNotificationCreateData(input)),
      skipDuplicates: true
    });
  },

  findActiveUsersByIds(userIds: string[], database: NotificationDatabase = prisma) {
    return database.user.findMany({
      where: { id: { in: userIds }, isActive: true },
      select: { id: true }
    });
  },

  listPreferences(
    userIds: string[],
    types?: NotificationType[],
    database: NotificationDatabase = prisma
  ) {
    return database.inAppNotificationPreference.findMany({
      where: {
        userId: { in: userIds },
        ...(types?.length ? { type: { in: types } } : {})
      },
      select: {
        userId: true,
        type: true,
        inAppEnabled: true,
        reminderHoursBefore: true
      }
    });
  },

  updateReadAt(id: string, userId: string, readAt: Date) {
    return prisma.notification.updateMany({
      where: {
        id,
        userId,
        hiddenAt: null,
        deletedAt: null,
        cancelledAt: null,
        sentAt: { not: null },
        readAt: null
      },
      data: { readAt }
    });
  },

  markAllRead(userId: string, readAt: Date) {
    return prisma.notification.updateMany({
      where: {
        userId,
        hiddenAt: null,
        deletedAt: null,
        cancelledAt: null,
        sentAt: { not: null },
        readAt: null
      },
      data: { readAt }
    });
  },

  hide(id: string, userId: string) {
    const hiddenAt = new Date();
    return prisma.notification.updateMany({
      where: {
        id,
        userId,
        hiddenAt: null,
        deletedAt: null,
        cancelledAt: null,
        sentAt: { not: null }
      },
      data: { hiddenAt, deletedAt: hiddenAt }
    });
  },

  markSent(ids: string[], sentAt: Date, database: NotificationDatabase = prisma) {
    return database.notification.updateMany({
      where: {
        id: { in: ids },
        sentAt: null,
        hiddenAt: null,
        deletedAt: null,
        cancelledAt: null,
        AND: [
          { OR: [{ scheduledFor: null }, { scheduledFor: { lte: sentAt } }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: sentAt } }] }
        ]
      },
      data: { sentAt }
    });
  },

  cancelScheduled(ids: string[], database: NotificationDatabase = prisma) {
    const cancelledAt = new Date();
    return database.notification.updateMany({
      where: { id: { in: ids }, sentAt: null, cancelledAt: null, deletedAt: null },
      data: { cancelledAt, deletedAt: cancelledAt }
    });
  },

  cancelPendingByEntity(
    entityType: string,
    entityId: string,
    type: NotificationType,
    userIds?: string[],
    database: NotificationDatabase = prisma
  ) {
    const cancelledAt = new Date();
    return database.notification.updateMany({
      where: {
        entityType,
        entityId,
        type,
        sentAt: null,
        cancelledAt: null,
        deletedAt: null,
        ...(userIds?.length ? { userId: { in: userIds } } : {})
      },
      data: { cancelledAt, deletedAt: cancelledAt }
    });
  },

  cancelPendingByEntities(
    entityType: string,
    entityIds: string[],
    type: NotificationType,
    database: NotificationDatabase = prisma
  ) {
    if (entityIds.length === 0) return Promise.resolve({ count: 0 });
    const cancelledAt = new Date();
    return database.notification.updateMany({
      where: {
        entityType,
        entityId: { in: entityIds },
        type,
        sentAt: null,
        cancelledAt: null,
        deletedAt: null
      },
      data: { cancelledAt, deletedAt: cancelledAt }
    });
  },

  listDueScheduled(
    type: NotificationType,
    now: Date,
    limit = 100,
    database: NotificationDatabase = prisma
  ) {
    const batchSize = Math.max(1, Math.floor(limit));
    return database.$queryRaw<DueScheduledNotificationRecord[]>(Prisma.sql`
      SELECT
        "id",
        "userId",
        "entityType",
        "entityId",
        "expiresAt",
        "deduplicationKey"
      FROM "Notification"
      WHERE "type" = CAST(${type} AS "NotificationType")
        AND "scheduledFor" <= ${now}
        AND "sentAt" IS NULL
        AND "cancelledAt" IS NULL
        AND "deletedAt" IS NULL
      ORDER BY "scheduledFor" ASC, "createdAt" ASC, "id" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${batchSize}
    `);
  },

  listPreferencesForUser(userId: string) {
    return prisma.inAppNotificationPreference.findMany({
      where: { userId },
      select: {
        type: true,
        inAppEnabled: true,
        reminderHoursBefore: true
      },
      orderBy: { type: "asc" }
    });
  },

  updatePreferences(userId: string, input: NotificationPreferencesUpdateInput) {
    return prisma.$transaction(
      input.preferences.map((preference) =>
        prisma.inAppNotificationPreference.upsert({
          where: { userId_type: { userId, type: preference.type } },
          create: {
            userId,
            type: preference.type,
            inAppEnabled: preference.inAppEnabled,
            reminderHoursBefore: preference.reminderHoursBefore ?? null
          },
          update: {
            inAppEnabled: preference.inAppEnabled,
            reminderHoursBefore: preference.reminderHoursBefore ?? null
          },
          select: {
            type: true,
            inAppEnabled: true,
            reminderHoursBefore: true
          }
        })
      )
    );
  }
};
