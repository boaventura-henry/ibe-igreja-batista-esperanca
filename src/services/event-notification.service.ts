import { EventStatus, NotificationType, Prisma } from "@prisma/client";
import { performance } from "node:perf_hooks";
import { NOTIFICATION_ENTITY_TYPES } from "@/lib/notification-catalog";
import {
  EVENT_REMINDERS_CRON_LOCK_KEY,
  notificationRepository,
  type NotificationDatabase
} from "@/repositories/notification.repository";
import { eventRepository, type EventRecord } from "@/repositories/event.repository";
import { notificationPublisher } from "@/services/notification-publisher.service";
import type { NotificationCreateInput } from "@/validators/notification.validator";

const EVENT_TIME_ZONE = "America/Sao_Paulo";
export const DEFAULT_EVENT_REMINDER_BATCH_SIZE = 100;
export const MAX_EVENT_REMINDER_TRANSACTION_ATTEMPTS = 3;
const TRANSIENT_TRANSACTION_CODES = new Set(["P2034", "40001", "40P01"]);

type ProcessingReason = "already_running" | "empty_batch" | "processed";
export type EventReminderProcessingPhase =
  | "acquire_advisory_lock"
  | "select_batch"
  | "validate_eligibility"
  | "update_reminders"
  | "commit_transaction";

export class EventReminderProcessingError extends Error {
  constructor(
    public readonly originalError: unknown,
    public readonly phase: EventReminderProcessingPhase,
    public readonly attempt: number
  ) {
    super(originalError instanceof Error ? originalError.message : "Event reminder processing failed.");
    this.name = "EventReminderProcessingError";
    this.cause = originalError;
  }
}

export function eventReminderProcessingErrorContext(error: unknown) {
  if (error instanceof EventReminderProcessingError) {
    return { error: error.originalError, phase: error.phase, attempt: error.attempt };
  }
  return { error, phase: "commit_transaction" as const, attempt: 1 };
}

type PhaseTimings = { lockMs: number; selectionMs: number; validationMs: number; updateMs: number };
export type EventReminderProcessingResult = {
  executed: boolean;
  reason: ProcessingReason;
  found: number;
  sent: number;
  cancelled: number;
  skipped: number;
  lockAcquired: boolean;
  attempts: number;
  timings: PhaseTimings & { transactionMs: number; totalServiceMs: number };
};

function datePart(event: EventRecord) {
  return event.startDate.toISOString().slice(0, 10);
}

function eventOccurrenceKey(event: EventRecord) {
  return `${datePart(event).replaceAll("-", "")}${(event.startTime ?? "0000").replace(":", "")}`;
}

export function eventStartAt(event: EventRecord) {
  if (!event.startTime) return null;
  const [year, month, day] = datePart(event).split("-").map(Number);
  const [hour, minute] = event.startTime.split(":").map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: EVENT_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date(utcGuess)).map((part) => [part.type, part.value])
  );
  const represented = Date.UTC(
    Number(values.year), Number(values.month) - 1, Number(values.day),
    Number(values.hour), Number(values.minute)
  );
  return new Date(utcGuess - (represented - utcGuess));
}

function formatEventContext(event: EventRecord) {
  const date = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(event.startDate);
  const time = event.startTime ? ` as ${event.startTime}` : "";
  return `${event.title} para ${date}${time}`;
}

function input(
  event: EventRecord,
  userId: string,
  values: { type: NotificationType; title: string; message: string; createdById?: string; scheduledFor?: Date; expiresAt?: Date; deduplicationKey: string }
): NotificationCreateInput {
  return {
    userId,
    createdById: values.createdById,
    type: values.type,
    title: values.title,
    message: values.message,
    entityType: NOTIFICATION_ENTITY_TYPES.EVENT,
    entityId: event.id,
    scheduledFor: values.scheduledFor,
    expiresAt: values.expiresAt,
    deduplicationKey: values.deduplicationKey
  };
}

async function reminderInputs(
  event: EventRecord,
  userIds: string[],
  createdById: string | undefined,
  database: NotificationDatabase,
  now: Date
) {
  const startAt = eventStartAt(event);
  if (!startAt || startAt <= now || event.status !== EventStatus.PUBLISHED) return [];
  const preferences = await notificationPublisher.preferences(userIds, NotificationType.EVENT_REMINDER, database);
  return preferences.flatMap(({ userId, active, preference }) => {
    const hours = preference.reminderHoursBefore ?? 24;
    const scheduledFor = new Date(startAt.getTime() - hours * 60 * 60 * 1000);
    if (!active || !preference.inAppEnabled || scheduledFor <= now) return [];
    return [input(event, userId, {
      type: NotificationType.EVENT_REMINDER,
      title: "Lembrete de evento",
      message: `Amanha acontece o evento ${formatEventContext(event)}.`,
      createdById,
      scheduledFor,
      expiresAt: new Date(startAt.getTime() + 12 * 60 * 60 * 1000),
      deduplicationKey: `event:reminder:v${event.notificationVersion}:${event.id}:${userId}:${eventOccurrenceKey(event)}`
    })];
  });
}

function eventReminderVersion(key: string | null) {
  const match = key?.match(/^event:reminder:v(\d+):/);
  return match ? Number(match[1]) : null;
}

function duration(startedAt: number) {
  return Number((performance.now() - startedAt).toFixed(3));
}

function transientCode(error: unknown): string | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError && TRANSIENT_TRANSACTION_CODES.has(error.code)) return error.code;
  if (!error || typeof error !== "object") return null;
  const candidate = error as { code?: unknown; meta?: { code?: unknown } | null; cause?: unknown };
  if (typeof candidate.code === "string" && TRANSIENT_TRANSACTION_CODES.has(candidate.code)) {
    return candidate.code;
  }
  if (typeof candidate.meta?.code === "string" && TRANSIENT_TRANSACTION_CODES.has(candidate.meta.code)) {
    return candidate.meta.code;
  }
  return transientCode(candidate.cause);
}

async function processBatch(now: Date, batchSize: number, attempt: number) {
  const phaseTimings: PhaseTimings = { lockMs: 0, selectionMs: 0, validationMs: 0, updateMs: 0 };
  let phase: EventReminderProcessingPhase = "acquire_advisory_lock";
  try {
    return await notificationRepository.transaction(async (database) => {
      const lockStartedAt = performance.now();
      const lockAcquired = await notificationRepository.tryAcquireInternalJobLock(EVENT_REMINDERS_CRON_LOCK_KEY, database);
      phaseTimings.lockMs = duration(lockStartedAt);
      if (!lockAcquired) return { executed: false as const, reason: "already_running" as const, found: 0, sent: 0, cancelled: 0, skipped: 0, lockAcquired: false, phaseTimings, notificationIds: [] as string[] };

      phase = "select_batch";
      const selectionStartedAt = performance.now();
      const pending = await notificationRepository.listDueScheduled(NotificationType.EVENT_REMINDER, now, batchSize, database);
      phaseTimings.selectionMs = duration(selectionStartedAt);
      if (!pending.length) return { executed: true as const, reason: "empty_batch" as const, found: 0, sent: 0, cancelled: 0, skipped: 0, lockAcquired: true, phaseTimings, notificationIds: [] as string[] };

      phase = "validate_eligibility";
      const validationStartedAt = performance.now();
      const eventIds = [...new Set(pending.filter((item) => item.entityType === NOTIFICATION_ENTITY_TYPES.EVENT && item.entityId).map((item) => item.entityId as string))];
      const userIds = [...new Set(pending.map((item) => item.userId))];
      const [events, activeUsers, preferences] = await Promise.all([
        eventRepository.listPublishedByIds(eventIds, database),
        eventRepository.listActivePortalUsersByIds(userIds, database),
        notificationPublisher.preferences(userIds, NotificationType.EVENT_REMINDER, database)
      ]);
      const eventById = new Map(events.map((event) => [event.id, event]));
      const activeUserIds = new Set(activeUsers.map((user) => user.id));
      const preferenceByUser = new Map(preferences.map((item) => [item.userId, item]));
      const deliverable: string[] = [];
      const cancelled: string[] = [];
      for (const reminder of pending) {
        const event = reminder.entityId ? eventById.get(reminder.entityId) : undefined;
        const preference = preferenceByUser.get(reminder.userId);
        const version = eventReminderVersion(reminder.deduplicationKey);
        if (
          event && version === event.notificationVersion && activeUserIds.has(reminder.userId) &&
          preference?.active && preference.preference.inAppEnabled &&
          reminder.expiresAt !== null && reminder.expiresAt > now
        ) deliverable.push(reminder.id);
        else cancelled.push(reminder.id);
      }
      phaseTimings.validationMs = duration(validationStartedAt);

      phase = "update_reminders";
      const updateStartedAt = performance.now();
      const [sent, invalidated] = await Promise.all([
        notificationRepository.markSent(deliverable, now, database),
        notificationRepository.cancelScheduled(cancelled, database)
      ]);
      phaseTimings.updateMs = duration(updateStartedAt);
      phase = "commit_transaction";
      return { executed: true as const, reason: "processed" as const, found: pending.length, sent: sent.count, cancelled: invalidated.count, skipped: pending.length - sent.count - invalidated.count, lockAcquired: true, phaseTimings, notificationIds: deliverable };
    });
  } catch (error) {
    throw new EventReminderProcessingError(error, phase, attempt);
  }
}

export const eventNotificationService = {
  async publishInitial(event: EventRecord, createdById: string, database: NotificationDatabase, now = new Date()) {
    const recipients = await eventRepository.listActivePortalUsers(database);
    const userIds = recipients.map((user) => user.id);
    const publication = userIds.map((userId) => input(event, userId, {
      type: NotificationType.EVENT_CREATED,
      title: "Novo evento",
      message: `Foi publicado o evento ${formatEventContext(event)}.`,
      createdById,
      deduplicationKey: `event:published:v${event.notificationVersion}:${event.id}:${userId}`
    }));
    const reminders = await reminderInputs(event, userIds, createdById, database, now);
    return notificationPublisher.publish([...publication, ...reminders], database);
  },

  async rescheduleReminders(event: EventRecord, createdById: string, database: NotificationDatabase, now = new Date()) {
    await notificationPublisher.cancelPendingForEntity({ entityType: NOTIFICATION_ENTITY_TYPES.EVENT, entityId: event.id, type: NotificationType.EVENT_REMINDER, database });
    const recipients = await eventRepository.listActivePortalUsers(database);
    return notificationPublisher.publish(
      await reminderInputs(event, recipients.map((user) => user.id), createdById, database, now),
      database
    );
  },

  cancelPendingReminders(eventId: string, database: NotificationDatabase) {
    return notificationPublisher.cancelPendingForEntity({ entityType: NOTIFICATION_ENTITY_TYPES.EVENT, entityId: eventId, type: NotificationType.EVENT_REMINDER, database });
  },

  async processPendingReminders(now = new Date(), limit = DEFAULT_EVENT_REMINDER_BATCH_SIZE): Promise<EventReminderProcessingResult> {
    const totalStartedAt = performance.now();
    let transactionMs = 0;
    for (let attempt = 1; attempt <= MAX_EVENT_REMINDER_TRANSACTION_ATTEMPTS; attempt += 1) {
      const transactionStartedAt = performance.now();
      try {
        const result = await processBatch(now, Math.max(1, Math.floor(limit)), attempt);
        transactionMs += duration(transactionStartedAt);
        await notificationPublisher.deliverPush(result.notificationIds);
        return { ...result, attempts: attempt, timings: { ...result.phaseTimings, transactionMs, totalServiceMs: duration(totalStartedAt) } };
      } catch (error) {
        transactionMs += duration(transactionStartedAt);
        const code = transientCode(error);
        if (!code || attempt === MAX_EVENT_REMINDER_TRANSACTION_ATTEMPTS) throw error;
        console.warn("[EventReminderCron] transient transaction retrying.", { attempt, code });
      }
    }
    throw new Error("Event reminder retry loop exhausted.");
  }
};
