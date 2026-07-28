import { NotificationType } from "@prisma/client";

export const NOTIFICATION_ENTITY_TYPES = {
  SCHEDULE: "SCHEDULE",
  NOTICE: "NOTICE",
  EVENT: "EVENT",
  MEMBER: "MEMBER",
  CONTRIBUTION: "CONTRIBUTION",
  MINISTRY: "MINISTRY",
  USER: "USER"
} as const;

export type NotificationEntityType =
  (typeof NOTIFICATION_ENTITY_TYPES)[keyof typeof NOTIFICATION_ENTITY_TYPES];

type NotificationDefaultPreference = {
  inAppEnabled: boolean;
  reminderHoursBefore: number | null;
};

type NotificationCatalogEntry = {
  type: NotificationType;
  label: string;
  icon: string;
  supportsReminder: boolean;
  entityType: NotificationEntityType;
  entityRoute: string;
  defaultPreference: NotificationDefaultPreference;
};

type EntityDestinationEntry = {
  route: string;
  resolve: (entityId: string) => string;
};

function encodeEntityId(entityId: string) {
  return encodeURIComponent(entityId);
}

export const NOTIFICATION_ENTITY_CATALOG: Readonly<
  Record<NotificationEntityType, EntityDestinationEntry>
> = {
  SCHEDULE: {
    route: "/escalas/:id",
    resolve: (entityId) => `/escalas/${encodeEntityId(entityId)}`
  },
  NOTICE: {
    route: "/portal/avisos?notification=:id",
    resolve: (entityId) => `/portal/avisos?notification=${encodeEntityId(entityId)}`
  },
  EVENT: {
    route: "/portal/eventos?notification=:id",
    resolve: (entityId) => `/portal/eventos?notification=${encodeEntityId(entityId)}`
  },
  MEMBER: {
    route: "/membros/:id",
    resolve: (entityId) => `/membros/${encodeEntityId(entityId)}`
  },
  CONTRIBUTION: {
    route: "/portal/minhas-contribuicoes?notification=:id",
    resolve: (entityId) =>
      `/portal/minhas-contribuicoes?notification=${encodeEntityId(entityId)}`
  },
  MINISTRY: {
    route: "/portal/meus-ministerios?notification=:id",
    resolve: (entityId) =>
      `/portal/meus-ministerios?notification=${encodeEntityId(entityId)}`
  },
  USER: {
    route: "/usuarios?notification=:id",
    resolve: (entityId) => `/usuarios?notification=${encodeEntityId(entityId)}`
  }
};

export const NOTIFICATION_CATALOG: Readonly<
  Record<NotificationType, NotificationCatalogEntry>
> = {
  SCHEDULE_PUBLISHED: {
    type: NotificationType.SCHEDULE_PUBLISHED,
    label: "Escala publicada",
    icon: "calendar-check",
    supportsReminder: false,
    entityType: NOTIFICATION_ENTITY_TYPES.SCHEDULE,
    entityRoute: NOTIFICATION_ENTITY_CATALOG.SCHEDULE.route,
    defaultPreference: { inAppEnabled: true, reminderHoursBefore: null }
  },
  SCHEDULE_REMINDER: {
    type: NotificationType.SCHEDULE_REMINDER,
    label: "Lembrete de escala",
    icon: "alarm-clock",
    supportsReminder: true,
    entityType: NOTIFICATION_ENTITY_TYPES.SCHEDULE,
    entityRoute: NOTIFICATION_ENTITY_CATALOG.SCHEDULE.route,
    defaultPreference: { inAppEnabled: true, reminderHoursBefore: 24 }
  },
  NOTICE_CREATED: {
    type: NotificationType.NOTICE_CREATED,
    label: "Novo comunicado",
    icon: "megaphone",
    supportsReminder: false,
    entityType: NOTIFICATION_ENTITY_TYPES.NOTICE,
    entityRoute: NOTIFICATION_ENTITY_CATALOG.NOTICE.route,
    defaultPreference: { inAppEnabled: true, reminderHoursBefore: null }
  },
  EVENT_CREATED: {
    type: NotificationType.EVENT_CREATED,
    label: "Novo evento",
    icon: "calendar-days",
    supportsReminder: false,
    entityType: NOTIFICATION_ENTITY_TYPES.EVENT,
    entityRoute: NOTIFICATION_ENTITY_CATALOG.EVENT.route,
    defaultPreference: { inAppEnabled: true, reminderHoursBefore: null }
  },
  BIRTHDAY: {
    type: NotificationType.BIRTHDAY,
    label: "Aniversario",
    icon: "cake",
    supportsReminder: false,
    entityType: NOTIFICATION_ENTITY_TYPES.MEMBER,
    entityRoute: NOTIFICATION_ENTITY_CATALOG.MEMBER.route,
    defaultPreference: { inAppEnabled: true, reminderHoursBefore: null }
  }
};

const entityTypes = new Set<string>(Object.values(NOTIFICATION_ENTITY_TYPES));

export function isNotificationEntityType(value: unknown): value is NotificationEntityType {
  return typeof value === "string" && entityTypes.has(value);
}

export function isSafeInternalNotificationUrl(value: string | null | undefined) {
  if (!value) return true;
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f]/.test(value)
  ) {
    return false;
  }

  try {
    const parsed = new URL(value, "https://ibe.local");
    return parsed.origin === "https://ibe.local";
  } catch {
    return false;
  }
}

export function resolveEntityDestination(
  entityType: NotificationEntityType,
  entityId: string
) {
  return NOTIFICATION_ENTITY_CATALOG[entityType].resolve(entityId);
}

export function resolveNotificationDestination(input: {
  entityType?: string | null;
  entityId?: string | null;
  actionUrl?: string | null;
}) {
  if (input.entityType && input.entityId && isNotificationEntityType(input.entityType)) {
    return resolveEntityDestination(input.entityType, input.entityId);
  }

  if (isSafeInternalNotificationUrl(input.actionUrl)) {
    return input.actionUrl ?? null;
  }

  return null;
}
