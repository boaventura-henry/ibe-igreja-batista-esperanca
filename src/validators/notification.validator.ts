import { NotificationType } from "@prisma/client";
import { z } from "zod";
import {
  isSafeInternalNotificationUrl,
  NOTIFICATION_CATALOG,
  NOTIFICATION_ENTITY_TYPES,
  type NotificationEntityType
} from "@/lib/notification-catalog";

function emptyToUndefined(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export { isSafeInternalNotificationUrl } from "@/lib/notification-catalog";

const optionalText = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

export const notificationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(["all", "unread", "read"]).default("all"),
  type: z.preprocess(emptyToUndefined, z.enum(NotificationType).optional())
});

export const notificationIdSchema = z.string().cuid("Notificacao invalida.");

const notificationCreateBaseSchema = z.object({
  userId: z.string().cuid(),
  createdById: z.string().cuid().optional(),
  type: z.enum(NotificationType),
  title: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(500),
  entityType: z.preprocess(
    emptyToUndefined,
    z.enum(NOTIFICATION_ENTITY_TYPES).optional()
  ),
  entityId: optionalText(191),
  actionUrl: z
    .preprocess(emptyToUndefined, z.string().trim().max(2048).optional())
    .refine(
      isSafeInternalNotificationUrl,
      "O destino da notificacao deve ser uma rota interna valida."
    ),
  scheduledFor: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
  deduplicationKey: optionalText(191).refine(
    (value) =>
      !value ||
      /^[a-z][a-z0-9-]*(?::[a-z][a-z0-9-]*)*:v[1-9]\d*(?::[A-Za-z0-9._-]+)+$/.test(
        value
      ),
    "A chave de deduplicacao deve ser namespaced, versionada e deterministica."
  )
});

type CanonicalNotificationInput = {
  type: NotificationType;
  entityType?: NotificationEntityType;
  entityId?: string;
  actionUrl?: string;
  scheduledFor?: Date;
  expiresAt?: Date;
};

function validateCanonicalNotificationInput(
  data: CanonicalNotificationInput,
  context: z.RefinementCtx
) {
  if (Boolean(data.entityType) !== Boolean(data.entityId)) {
    context.addIssue({
      code: "custom",
      message: "entityType e entityId devem ser informados em conjunto.",
      path: data.entityType ? ["entityId"] : ["entityType"]
    });
  }

  if (data.entityType && data.actionUrl) {
    context.addIssue({
      code: "custom",
      message: "actionUrl e permitido somente quando nao existe entidade relacionada.",
      path: ["actionUrl"]
    });
  }

  if (data.entityType && NOTIFICATION_CATALOG[data.type].entityType !== data.entityType) {
    context.addIssue({
      code: "custom",
      message: "A entidade informada nao corresponde ao tipo de notificacao.",
      path: ["entityType"]
    });
  }

  if (data.scheduledFor && data.expiresAt && data.expiresAt <= data.scheduledFor) {
    context.addIssue({
      code: "custom",
      message: "expiresAt deve ser posterior a scheduledFor.",
      path: ["expiresAt"]
    });
  }
}

export const notificationCreateSchema = notificationCreateBaseSchema.superRefine(
  validateCanonicalNotificationInput
);

export const notificationBulkCreateSchema = notificationCreateBaseSchema
  .omit({ userId: true })
  .extend({
    userIds: z.array(z.string().cuid()).min(1).max(500)
  })
  .superRefine(validateCanonicalNotificationInput);

const preferenceItemSchema = z.object({
  type: z.enum(NotificationType),
  inAppEnabled: z.boolean(),
  reminderHoursBefore: z.number().int().min(1).max(168).nullable().optional()
});

export const notificationPreferencesUpdateSchema = z
  .object({
    preferences: z.array(preferenceItemSchema).min(1).max(Object.values(NotificationType).length)
  })
  .superRefine((data, context) => {
    const types = new Set<NotificationType>();

    data.preferences.forEach((preference, index) => {
      if (types.has(preference.type)) {
        context.addIssue({
          code: "custom",
          message: "Cada tipo de notificacao pode ser informado apenas uma vez.",
          path: ["preferences", index, "type"]
        });
      }
      types.add(preference.type);

      if (
        !NOTIFICATION_CATALOG[preference.type].supportsReminder &&
        preference.reminderHoursBefore != null
      ) {
        context.addIssue({
          code: "custom",
          message: "A antecedencia e permitida apenas para lembretes de escala.",
          path: ["preferences", index, "reminderHoursBefore"]
        });
      }
    });
  });

export type NotificationListQueryInput = z.infer<typeof notificationListQuerySchema>;
export type NotificationCreateInput = z.infer<typeof notificationCreateSchema>;
export type NotificationBulkCreateInput = z.infer<typeof notificationBulkCreateSchema>;
export type NotificationPreferencesUpdateInput = z.infer<
  typeof notificationPreferencesUpdateSchema
>;
