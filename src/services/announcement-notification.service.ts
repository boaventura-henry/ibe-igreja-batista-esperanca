import { NotificationType } from "@prisma/client";
import { NOTIFICATION_ENTITY_TYPES } from "@/lib/notification-catalog";
import { announcementRepository, type AnnouncementDatabase, type AnnouncementRecord } from "@/repositories/announcement.repository";
import { notificationRepository } from "@/repositories/notification.repository";
import { notificationPublisher } from "@/services/notification-publisher.service";
import type { NotificationCreateInput } from "@/validators/notification.validator";

function input(announcement: AnnouncementRecord, userId: string, values: { type: NotificationType; title: string; message: string; createdById: string; deduplicationKey: string }): NotificationCreateInput {
  return { userId, createdById: values.createdById, type: values.type, title: values.title, message: values.message, entityType: NOTIFICATION_ENTITY_TYPES.NOTICE, entityId: announcement.id, deduplicationKey: values.deduplicationKey };
}

export const announcementNotificationService = {
  async publishInitial(announcement: AnnouncementRecord, createdById: string, database: AnnouncementDatabase) {
    const recipients = await announcementRepository.listActivePortalUsers(announcement, database);
    return notificationPublisher.publish(recipients.map((recipient) => input(announcement, recipient.id, {
      type: NotificationType.NOTICE_CREATED, title: "Novo aviso", message: `Foi publicado um novo aviso: "${announcement.title}".`, createdById,
      deduplicationKey: `announcement:published:v${announcement.notificationVersion}:${announcement.id}:${recipient.id}`
    })), database);
  },

  async cancelled(announcement: AnnouncementRecord, createdById: string, database: AnnouncementDatabase) {
    const publishedRecipientIds = await notificationRepository.listRecipientUserIdsByEntity(
      NOTIFICATION_ENTITY_TYPES.NOTICE,
      announcement.id,
      NotificationType.NOTICE_CREATED,
      database
    );
    const recipientIds = publishedRecipientIds.length
      ? publishedRecipientIds
      : (await announcementRepository.listActivePortalUsers(announcement, database)).map((recipient) => recipient.id);
    return notificationPublisher.publish(recipientIds.map((userId) => input(announcement, userId, {
      type: NotificationType.NOTICE_CANCELED, title: "Aviso cancelado", message: `O aviso "${announcement.title}" foi cancelado.`, createdById,
      deduplicationKey: `announcement:canceled:v${announcement.notificationVersion}:${announcement.id}:${userId}`
    })), database);
  }
};
