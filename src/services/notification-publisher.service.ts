import type { NotificationDatabase } from "@/repositories/notification.repository";
import { notificationRepository } from "@/repositories/notification.repository";
import { notificationService } from "@/services/notification.service";
import type { NotificationCreateInput } from "@/validators/notification.validator";

export const notificationPublisher = {
  publish(inputs: NotificationCreateInput[], database?: NotificationDatabase) {
    return notificationService.createBatch(inputs, database);
  },

  preferences(userIds: string[], type: NotificationCreateInput["type"], database?: NotificationDatabase) {
    return notificationService.getEffectivePreferencesForUsers(userIds, type, database);
  },

  async cancelPendingForEntity(input: {
    entityType: string;
    entityId: string;
    type: NotificationCreateInput["type"];
    userIds?: string[];
    database?: NotificationDatabase;
  }) {
    if (input.userIds && input.userIds.length === 0) {
      return { cancelled: 0 };
    }
    const result = await notificationRepository.cancelPendingByEntity(
      input.entityType,
      input.entityId,
      input.type,
      input.userIds,
      input.database
    );
    return { cancelled: result.count };
  }
};
