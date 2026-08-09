import type { NotificationType } from "@prisma/client";
import type { NotificationEntityType } from "@/lib/notification-catalog";

export type NotificationStatusFilter = "all" | "unread" | "read";

export type NotificationSummary = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType: NotificationEntityType | null;
  entityId: string | null;
  actionUrl: string | null;
  scheduledFor: string | null;
  expiresAt: string | null;
  sentAt: string | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationListResult = {
  notifications: NotificationSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  unreadCount: number;
};

export type NotificationUnreadCountResult = {
  count: number;
};

export type EffectiveNotificationPreference = {
  type: NotificationType;
  inAppEnabled: boolean;
  reminderHoursBefore: number | null;
  isDefault: boolean;
};

export type NotificationPreferenceResult = {
  preferences: EffectiveNotificationPreference[];
};
