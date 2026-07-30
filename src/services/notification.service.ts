import { NotificationType } from "@prisma/client";
import { AppError } from "@/lib/errors";
import {
  isNotificationEntityType,
  NOTIFICATION_CATALOG,
  resolveNotificationDestination
} from "@/lib/notification-catalog";
import {
  notificationRepository,
  type NotificationDatabase,
  type NotificationRecord
} from "@/repositories/notification.repository";
import type {
  EffectiveNotificationPreference,
  NotificationListResult,
  NotificationPreferenceResult,
  NotificationSummary
} from "@/types/notification.types";
import {
  notificationBulkCreateSchema,
  notificationCreateSchema,
  type NotificationBulkCreateInput,
  type NotificationCreateInput,
  type NotificationListQueryInput,
  type NotificationPreferencesUpdateInput
} from "@/validators/notification.validator";

const notificationTypes = Object.values(NotificationType);

export const DEFAULT_NOTIFICATION_PREFERENCES = Object.freeze(
  Object.fromEntries(
    notificationTypes.map((type) => [type, NOTIFICATION_CATALOG[type].defaultPreference])
  )
) as Readonly<
  Record<NotificationType, { inAppEnabled: boolean; reminderHoursBefore: number | null }>
>;

function serializeDate(value: Date | null) {
  return value?.toISOString() ?? null;
}

function serialize(notification: NotificationRecord): NotificationSummary {
  const entityType = isNotificationEntityType(notification.entityType)
    ? notification.entityType
    : null;

  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    entityType,
    entityId: entityType ? notification.entityId : null,
    actionUrl: resolveNotificationDestination({
      entityType,
      entityId: notification.entityId,
      actionUrl: notification.actionUrl
    }),
    scheduledFor: serializeDate(notification.scheduledFor),
    expiresAt: serializeDate(notification.expiresAt),
    sentAt: serializeDate(notification.sentAt),
    readAt: serializeDate(notification.readAt),
    createdAt: notification.createdAt.toISOString()
  };
}

export function resolveEffectiveNotificationPreference(
  type: NotificationType,
  stored?: { inAppEnabled: boolean; reminderHoursBefore: number | null }
): EffectiveNotificationPreference {
  const defaults = NOTIFICATION_CATALOG[type].defaultPreference;

  return {
    type,
    inAppEnabled: stored?.inAppEnabled ?? defaults.inAppEnabled,
    reminderHoursBefore: NOTIFICATION_CATALOG[type].supportsReminder
      ? stored?.reminderHoursBefore ?? defaults.reminderHoursBefore
      : null,
    isDefault: !stored
  };
}

export const notificationService = {
  async getEffectivePreferencesForUsers(
    userIds: string[],
    type: NotificationType,
    database?: NotificationDatabase
  ) {
    const uniqueUserIds = [...new Set(userIds)];
    const [activeUsers, preferences] = await Promise.all([
      notificationRepository.findActiveUsersByIds(uniqueUserIds, database),
      notificationRepository.listPreferences(uniqueUserIds, [type], database)
    ]);
    const activeUserIds = new Set(activeUsers.map((user) => user.id));
    const byUser = new Map(preferences.map((preference) => [preference.userId, preference]));

    return uniqueUserIds.map((userId) => ({
      userId,
      active: activeUserIds.has(userId),
      preference: resolveEffectiveNotificationPreference(type, byUser.get(userId))
    }));
  },

  async createBatch(
    rawInputs: NotificationCreateInput[],
    database?: NotificationDatabase
  ) {
    const inputs = rawInputs.map((input) => notificationCreateSchema.parse(input));
    if (!inputs.length) {
      return { requested: 0, eligible: 0, created: 0, skipped: 0 };
    }

    const userIds = [...new Set(inputs.map((input) => input.userId))];
    const types = [...new Set(inputs.map((input) => input.type))];
    const [activeUsers, preferences] = await Promise.all([
      notificationRepository.findActiveUsersByIds(userIds, database),
      notificationRepository.listPreferences(userIds, types, database)
    ]);
    const activeUserIds = new Set(activeUsers.map((user) => user.id));
    const preferenceByUserAndType = new Map(
      preferences.map((preference) => [
        `${preference.userId}:${preference.type}`,
        preference
      ])
    );
    const eligibleInputs = inputs.filter((input) => {
      if (!activeUserIds.has(input.userId)) return false;
      return resolveEffectiveNotificationPreference(
        input.type,
        preferenceByUserAndType.get(`${input.userId}:${input.type}`)
      ).inAppEnabled;
    });
    const result = eligibleInputs.length
      ? await notificationRepository.createMany(eligibleInputs, database)
      : { count: 0 };

    return {
      requested: inputs.length,
      eligible: eligibleInputs.length,
      created: result.count,
      skipped: inputs.length - eligibleInputs.length
    };
  },

  async listForUser(
    userId: string,
    filters: NotificationListQueryInput
  ): Promise<NotificationListResult> {
    const result = await notificationRepository.listForUser(userId, filters);

    return {
      notifications: result.notifications.map(serialize),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / filters.pageSize))
      },
      unreadCount: result.unreadCount
    };
  },

  async create(rawInput: NotificationCreateInput) {
    const input = notificationCreateSchema.parse(rawInput);
    const [activeUsers, preferences] = await Promise.all([
      notificationRepository.findActiveUsersByIds([input.userId]),
      notificationRepository.listPreferences([input.userId], [input.type])
    ]);

    if (!activeUsers.length) {
      return { created: false as const, reason: "USER_INACTIVE" as const, notification: null };
    }

    const preference = resolveEffectiveNotificationPreference(input.type, preferences[0]);
    if (!preference.inAppEnabled) {
      return {
        created: false as const,
        reason: "PREFERENCE_DISABLED" as const,
        notification: null
      };
    }

    if (input.deduplicationKey) {
      const result = await notificationRepository.createMany([input]);
      const existing = await notificationRepository.findByDeduplicationKey(
        input.userId,
        input.deduplicationKey
      );
      if (!existing) {
        throw new AppError(
          "Nao foi possivel localizar a notificacao criada.",
          500,
          "NOTIFICATION_CREATE_FAILED"
        );
      }
      return {
        created: result.count === 1,
        reason: result.count === 1 ? null : ("DUPLICATE" as const),
        notification: serialize(existing)
      };
    }

    const notification = await notificationRepository.create(input);
    return { created: true as const, reason: null, notification: serialize(notification) };
  },

  async createMany(rawInput: NotificationBulkCreateInput) {
    const input = notificationBulkCreateSchema.parse(rawInput);
    const userIds = [...new Set(input.userIds)];
    const [activeUsers, preferences] = await Promise.all([
      notificationRepository.findActiveUsersByIds(userIds),
      notificationRepository.listPreferences(userIds, [input.type])
    ]);
    const activeUserIds = new Set(activeUsers.map((user) => user.id));
    const preferenceByUser = new Map(
      preferences.map((preference) => [preference.userId, preference])
    );
    const eligibleUserIds = userIds.filter((userId) => {
      if (!activeUserIds.has(userId)) return false;
      return resolveEffectiveNotificationPreference(
        input.type,
        preferenceByUser.get(userId)
      ).inAppEnabled;
    });
    const notifications = eligibleUserIds.map((userId) =>
      notificationCreateSchema.parse({
        ...input,
        userIds: undefined,
        userId
      })
    );
    const result = notifications.length
      ? await notificationRepository.createMany(notifications)
      : { count: 0 };

    return {
      requested: userIds.length,
      eligible: eligibleUserIds.length,
      created: result.count,
      skipped: userIds.length - eligibleUserIds.length
    };
  },

  async markRead(id: string, userId: string) {
    const current = await notificationRepository.findByIdForUser(id, userId);
    if (!current) {
      throw new AppError("Notificacao nao encontrada.", 404, "NOTIFICATION_NOT_FOUND");
    }

    if (!current.readAt) {
      await notificationRepository.updateReadAt(id, userId, new Date());
    }

    const updated = await notificationRepository.findByIdForUser(id, userId);
    if (!updated) {
      throw new AppError("Notificacao nao encontrada.", 404, "NOTIFICATION_NOT_FOUND");
    }
    return serialize(updated);
  },

  async markAllRead(userId: string) {
    const result = await notificationRepository.markAllRead(userId, new Date());
    return { updated: result.count };
  },

  async remove(id: string, userId: string) {
    const current = await notificationRepository.findByIdForUser(id, userId);
    if (!current) {
      throw new AppError("Notificacao nao encontrada.", 404, "NOTIFICATION_NOT_FOUND");
    }
    await notificationRepository.hide(id, userId);
    return { id, deleted: true };
  },

  async getPreferences(userId: string): Promise<NotificationPreferenceResult> {
    const stored = await notificationRepository.listPreferencesForUser(userId);
    const byType = new Map(stored.map((preference) => [preference.type, preference]));

    return {
      preferences: notificationTypes.map((type) =>
        resolveEffectiveNotificationPreference(type, byType.get(type))
      )
    };
  },

  async updatePreferences(userId: string, input: NotificationPreferencesUpdateInput) {
    await notificationRepository.updatePreferences(userId, input);
    return this.getPreferences(userId);
  },

  async markSent(ids: string[], database?: NotificationDatabase) {
    if (!ids.length) return { updated: 0 };
    const result = await notificationRepository.markSent([...new Set(ids)], new Date(), database);
    return { updated: result.count };
  },

  async cancelScheduled(ids: string[], database?: NotificationDatabase) {
    if (!ids.length) return { updated: 0 };
    const result = await notificationRepository.cancelScheduled([...new Set(ids)], database);
    return { updated: result.count };
  }
};
