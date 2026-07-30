import {
  NotificationType,
  Prisma,
  ScheduleMemberStatus,
  ScheduleStatus
} from "@prisma/client";
import { performance } from "node:perf_hooks";
import { NOTIFICATION_ENTITY_TYPES } from "@/lib/notification-catalog";
import {
  notificationRepository,
  type NotificationDatabase
} from "@/repositories/notification.repository";
import {
  scheduleRepository,
  type ScheduleMemberRecord,
  type ScheduleRecord
} from "@/repositories/schedule.repository";
import { notificationPublisher } from "@/services/notification-publisher.service";
import type { NotificationCreateInput } from "@/validators/notification.validator";

const SCHEDULE_TIME_ZONE = "America/Sao_Paulo";
export const DEFAULT_SCHEDULE_REMINDER_BATCH_SIZE = 100;
export const MAX_SCHEDULE_REMINDER_TRANSACTION_ATTEMPTS = 3;

const TRANSIENT_TRANSACTION_CODES = new Set(["P2034", "40001", "40P01"]);

type ProcessingReason = "already_running" | "empty_batch" | "processed";

type ProcessingPhaseTimings = {
  lockMs: number;
  selectionMs: number;
  validationMs: number;
  updateMs: number;
};

export type ScheduleReminderProcessingResult = {
  executed: boolean;
  reason: ProcessingReason;
  found: number;
  sent: number;
  cancelled: number;
  skipped: number;
  lockAcquired: boolean;
  attempts: number;
  timings: ProcessingPhaseTimings & {
    transactionMs: number;
    totalServiceMs: number;
  };
};

type Recipient = {
  userId: string;
  participantId: string;
  role: string;
  status: ScheduleMemberStatus;
};

export type ScheduleRelevantChange =
  | "title"
  | "description"
  | "date"
  | "startTime"
  | "endTime"
  | "location"
  | "ministryId"
  | "observations"
  | "role"
  | "status";

const changeLabels: Record<ScheduleRelevantChange, string> = {
  title: "o titulo",
  description: "a descricao",
  date: "a data",
  startTime: "o horario inicial",
  endTime: "o horario final",
  location: "o local",
  ministryId: "o ministerio",
  observations: "as observacoes",
  role: "a funcao",
  status: "o status"
};

function datePart(schedule: ScheduleRecord) {
  return schedule.date.toISOString().slice(0, 10);
}

function occurrenceKey(schedule: ScheduleRecord) {
  return `${datePart(schedule).replaceAll("-", "")}${(schedule.startTime ?? "0000").replace(":", "")}`;
}

export function scheduleStartAt(schedule: ScheduleRecord) {
  if (!schedule.startTime) return null;
  const [year, month, day] = datePart(schedule).split("-").map(Number);
  const [hour, minute] = schedule.startTime.split(":").map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SCHEDULE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(utcGuess));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const represented = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute)
  );
  return new Date(utcGuess - (represented - utcGuess));
}

export function activeScheduleRecipients(
  members: ScheduleMemberRecord[]
): Recipient[] {
  const byUser = new Map<string, Recipient>();

  for (const participant of members) {
    const actualMember =
      participant.status === ScheduleMemberStatus.REPLACED
        ? participant.replacedByMember
        : participant.member;
    const userId = actualMember?.user?.id;
    if (!userId || byUser.has(userId)) continue;
    byUser.set(userId, {
      userId,
      participantId: participant.id,
      role: participant.role,
      status: participant.status
    });
  }

  return [...byUser.values()];
}

function formatScheduleContext(schedule: ScheduleRecord) {
  const date = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(schedule.date);
  const time = schedule.startTime ? `, as ${schedule.startTime}` : "";
  const location = schedule.location ? `, em ${schedule.location}` : "";
  return `${schedule.title} (${schedule.ministry.name}), em ${date}${time}${location}`;
}

function notificationInput(
  schedule: ScheduleRecord,
  recipient: Recipient,
  input: {
    title: string;
    message: string;
    deduplicationKey: string;
    createdById?: string;
    type?: NotificationType;
    scheduledFor?: Date;
    expiresAt?: Date;
  }
): NotificationCreateInput {
  return {
    userId: recipient.userId,
    createdById: input.createdById,
    type: input.type ?? NotificationType.SCHEDULE_PUBLISHED,
    title: input.title,
    message: input.message,
    entityType: NOTIFICATION_ENTITY_TYPES.SCHEDULE,
    entityId: schedule.id,
    scheduledFor: input.scheduledFor,
    expiresAt: input.expiresAt,
    deduplicationKey: input.deduplicationKey
  };
}

async function reminderInputs(
  schedule: ScheduleRecord,
  recipients: Recipient[],
  createdById: string | undefined,
  database: NotificationDatabase,
  now: Date
) {
  const startAt = scheduleStartAt(schedule);
  if (!startAt || startAt <= now || schedule.status !== ScheduleStatus.PUBLISHED) return [];

  const preferences = await notificationPublisher.preferences(
    recipients.map((recipient) => recipient.userId),
    NotificationType.SCHEDULE_REMINDER,
    database
  );
  const preferenceByUser = new Map(preferences.map((item) => [item.userId, item]));

  return recipients.flatMap((recipient) => {
    if (
      recipient.status !== ScheduleMemberStatus.PENDING &&
      recipient.status !== ScheduleMemberStatus.CONFIRMED &&
      recipient.status !== ScheduleMemberStatus.REPLACED
    ) {
      return [];
    }
    const effective = preferenceByUser.get(recipient.userId);
    const hours = effective?.preference.reminderHoursBefore ?? 24;
    const scheduledFor = new Date(startAt.getTime() - hours * 60 * 60 * 1000);
    if (!effective?.active || !effective.preference.inAppEnabled || scheduledFor <= now) {
      return [];
    }

    return [
      notificationInput(schedule, recipient, {
        type: NotificationType.SCHEDULE_REMINDER,
        title: "Lembrete de escala",
        message: `Lembrete: voce participara da escala ${formatScheduleContext(schedule)}.`,
        createdById,
        scheduledFor,
        expiresAt: new Date(startAt.getTime() + 12 * 60 * 60 * 1000),
        deduplicationKey: `schedule:reminder:v${schedule.notificationVersion}:${schedule.id}:${recipient.participantId}:${occurrenceKey(schedule)}`
      })
    ];
  });
}

export function describeScheduleChanges(changes: ScheduleRelevantChange[]) {
  if (changes.length === 1) {
    return `Sua escala foi atualizada: ${changeLabels[changes[0]]} foi alterado.`;
  }
  return `Sua escala foi atualizada. Foram alterados ${changes
    .map((change) => changeLabels[change])
    .join(", ")}.`;
}

export function reminderNotificationVersion(deduplicationKey: string | null) {
  const match = deduplicationKey?.match(/^schedule:reminder:v(\d+):/);
  return match ? Number(match[1]) : null;
}

function durationSince(startedAt: number) {
  return Number((performance.now() - startedAt).toFixed(3));
}

function nestedErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const candidate = error as {
    code?: unknown;
    meta?: { code?: unknown } | null;
    cause?: unknown;
  };
  if (typeof candidate.code === "string" && TRANSIENT_TRANSACTION_CODES.has(candidate.code)) {
    return candidate.code;
  }
  if (
    typeof candidate.meta?.code === "string" &&
    TRANSIENT_TRANSACTION_CODES.has(candidate.meta.code)
  ) {
    return candidate.meta.code;
  }
  return candidate.cause ? nestedErrorCode(candidate.cause) : null;
}

export function transientScheduleReminderTransactionCode(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    TRANSIENT_TRANSACTION_CODES.has(error.code)
  ) {
    return error.code;
  }
  return nestedErrorCode(error);
}

async function processPendingReminderBatch(now: Date, batchSize: number) {
  const phaseTimings: ProcessingPhaseTimings = {
    lockMs: 0,
    selectionMs: 0,
    validationMs: 0,
    updateMs: 0
  };

  return notificationRepository.transaction(async (database) => {
    const lockStartedAt = performance.now();
    const lockAcquired =
      await notificationRepository.tryAcquireScheduleReminderProcessingLock(database);
    phaseTimings.lockMs = durationSince(lockStartedAt);
    if (!lockAcquired) {
      return {
        executed: false as const,
        reason: "already_running" as const,
        found: 0,
        sent: 0,
        cancelled: 0,
        skipped: 0,
        lockAcquired: false,
        phaseTimings
      };
    }

    const selectionStartedAt = performance.now();
    const pending = await notificationRepository.listDueScheduled(
      NotificationType.SCHEDULE_REMINDER,
      now,
      batchSize,
      database
    );
    phaseTimings.selectionMs = durationSince(selectionStartedAt);
    if (!pending.length) {
      return {
        executed: true as const,
        reason: "empty_batch" as const,
        found: 0,
        sent: 0,
        cancelled: 0,
        skipped: 0,
        lockAcquired: true,
        phaseTimings
      };
    }

    const validationStartedAt = performance.now();
    const deliverable: string[] = [];
    const cancelled: string[] = [];
    const preferences = await notificationPublisher.preferences(
      pending.map((item) => item.userId),
      NotificationType.SCHEDULE_REMINDER,
      database
    );
    const preferenceByUser = new Map(preferences.map((item) => [item.userId, item]));
    const scheduleIds = [
      ...new Set(
        pending
          .filter(
            (item) =>
              item.entityType === NOTIFICATION_ENTITY_TYPES.SCHEDULE && item.entityId
          )
          .map((item) => item.entityId as string)
      )
    ];
    const userIds = [...new Set(pending.map((item) => item.userId))];
    const recipientLinks = await scheduleRepository.listPublishedScheduleRecipientLinks(
      scheduleIds,
      userIds,
      database
    );
    const eligiblePairs = new Set<string>();
    const currentVersionBySchedule = new Map<string, number>();

    for (const schedule of recipientLinks) {
      currentVersionBySchedule.set(schedule.id, schedule.notificationVersion);
      for (const participant of schedule.members) {
        const userId =
          participant.status === ScheduleMemberStatus.REPLACED
            ? participant.replacedByMember?.user?.id
            : participant.member.user?.id;
        if (userId) eligiblePairs.add(`${schedule.id}:${userId}`);
      }
    }

    for (const item of pending) {
      const preference = preferenceByUser.get(item.userId);
      const notificationVersion = reminderNotificationVersion(item.deduplicationKey);
      if (
        (!item.expiresAt || item.expiresAt > now) &&
        preference?.active &&
        preference.preference.inAppEnabled &&
        item.entityType === NOTIFICATION_ENTITY_TYPES.SCHEDULE &&
        item.entityId &&
        notificationVersion !== null &&
        currentVersionBySchedule.get(item.entityId) === notificationVersion &&
        eligiblePairs.has(`${item.entityId}:${item.userId}`)
      ) {
        deliverable.push(item.id);
      } else {
        cancelled.push(item.id);
      }
    }
    phaseTimings.validationMs = durationSince(validationStartedAt);

    const updateStartedAt = performance.now();
    const [sent, invalidated] = await Promise.all([
      notificationRepository.markSent(deliverable, now, database),
      notificationRepository.cancelScheduled(cancelled, database)
    ]);
    phaseTimings.updateMs = durationSince(updateStartedAt);

    return {
      executed: true as const,
      reason: "processed" as const,
      found: pending.length,
      sent: sent.count,
      cancelled: invalidated.count,
      skipped: pending.length - sent.count - invalidated.count,
      lockAcquired: true,
      phaseTimings
    };
  });
}

export const scheduleNotificationService = {
  async publishInitial(
    schedule: ScheduleRecord,
    createdById: string,
    database: NotificationDatabase,
    now = new Date()
  ) {
    const recipients = activeScheduleRecipients(schedule.members);
    const immediate = recipients.map((recipient) =>
      notificationInput(schedule, recipient, {
        title: "Voce foi escalado",
        message: `Voce foi incluido na escala ${formatScheduleContext(schedule)}. Funcao: ${recipient.role}.`,
        createdById,
        deduplicationKey: `schedule:published:v${schedule.notificationVersion}:${schedule.id}:${recipient.userId}`
      })
    );
    const reminders = await reminderInputs(schedule, recipients, createdById, database, now);
    return notificationPublisher.publish([...immediate, ...reminders], database);
  },

  async participantAdded(
    schedule: ScheduleRecord,
    participant: ScheduleMemberRecord,
    createdById: string,
    database: NotificationDatabase,
    now = new Date()
  ) {
    const recipients = activeScheduleRecipients([participant]);
    const immediate = recipients.map((recipient) =>
      notificationInput(schedule, recipient, {
        title: "Voce foi escalado",
        message: `Voce foi incluido na escala ${formatScheduleContext(schedule)}. Funcao: ${recipient.role}.`,
        createdById,
        deduplicationKey: `schedule:participant-added:v${schedule.notificationVersion}:${schedule.id}:${participant.id}`
      })
    );
    const reminders = await reminderInputs(schedule, recipients, createdById, database, now);
    return notificationPublisher.publish([...immediate, ...reminders], database);
  },

  async participantRemoved(
    schedule: ScheduleRecord,
    participant: ScheduleMemberRecord,
    createdById: string,
    database: NotificationDatabase
  ) {
    const recipients = activeScheduleRecipients([participant]);
    await notificationPublisher.cancelPendingForEntity({
      entityType: NOTIFICATION_ENTITY_TYPES.SCHEDULE,
      entityId: schedule.id,
      type: NotificationType.SCHEDULE_REMINDER,
      userIds: recipients.map((recipient) => recipient.userId),
      database
    });
    return notificationPublisher.publish(
      recipients.map((recipient) =>
        notificationInput(schedule, recipient, {
          title: "Voce foi removido da escala",
          message: `Sua participacao na escala ${formatScheduleContext(schedule)} foi removida.`,
          createdById,
          deduplicationKey: `schedule:participant-removed:v${schedule.notificationVersion}:${schedule.id}:${participant.id}`
        })
      ),
      database
    );
  },

  async updated(
    schedule: ScheduleRecord,
    changes: ScheduleRelevantChange[],
    createdById: string,
    database: NotificationDatabase,
    recipients = activeScheduleRecipients(schedule.members)
  ) {
    if (!changes.length || !recipients.length) return { requested: 0, eligible: 0, created: 0, skipped: 0 };
    return notificationPublisher.publish(
      recipients.map((recipient) =>
        notificationInput(schedule, recipient, {
          title: "Sua escala foi atualizada",
          message: describeScheduleChanges(changes),
          createdById,
          deduplicationKey: `schedule:updated:v${schedule.notificationVersion}:${schedule.id}:${recipient.userId}`
        })
      ),
      database
    );
  },

  async cancelled(
    schedule: ScheduleRecord,
    createdById: string,
    database: NotificationDatabase
  ) {
    const recipients = activeScheduleRecipients(schedule.members);
    await notificationPublisher.cancelPendingForEntity({
      entityType: NOTIFICATION_ENTITY_TYPES.SCHEDULE,
      entityId: schedule.id,
      type: NotificationType.SCHEDULE_REMINDER,
      database
    });
    return notificationPublisher.publish(
      recipients.map((recipient) =>
        notificationInput(schedule, recipient, {
          title: "Escala cancelada",
          message: `A escala ${formatScheduleContext(schedule)} foi cancelada.`,
          createdById,
          deduplicationKey: `schedule:cancelled:v${schedule.notificationVersion}:${schedule.id}:${recipient.userId}`
        })
      ),
      database
    );
  },

  async rescheduleReminders(
    schedule: ScheduleRecord,
    createdById: string,
    database: NotificationDatabase,
    now = new Date()
  ) {
    await notificationPublisher.cancelPendingForEntity({
      entityType: NOTIFICATION_ENTITY_TYPES.SCHEDULE,
      entityId: schedule.id,
      type: NotificationType.SCHEDULE_REMINDER,
      database
    });
    const inputs = await reminderInputs(
      schedule,
      activeScheduleRecipients(schedule.members),
      createdById,
      database,
      now
    );
    return notificationPublisher.publish(inputs, database);
  },

  async refreshParticipantReminder(
    schedule: ScheduleRecord,
    participant: ScheduleMemberRecord,
    createdById: string,
    database: NotificationDatabase,
    now = new Date()
  ) {
    const recipients = activeScheduleRecipients([participant]);
    await notificationPublisher.cancelPendingForEntity({
      entityType: NOTIFICATION_ENTITY_TYPES.SCHEDULE,
      entityId: schedule.id,
      type: NotificationType.SCHEDULE_REMINDER,
      userIds: recipients.map((recipient) => recipient.userId),
      database
    });
    const inputs = await reminderInputs(schedule, recipients, createdById, database, now);
    return notificationPublisher.publish(inputs, database);
  },

  async processPendingReminders(
    now = new Date(),
    limit = DEFAULT_SCHEDULE_REMINDER_BATCH_SIZE
  ): Promise<ScheduleReminderProcessingResult> {
    const batchSize = Math.max(1, Math.floor(limit));
    const serviceStartedAt = performance.now();
    let transactionMs = 0;

    for (
      let attempt = 1;
      attempt <= MAX_SCHEDULE_REMINDER_TRANSACTION_ATTEMPTS;
      attempt += 1
    ) {
      const transactionStartedAt = performance.now();
      try {
        const result = await processPendingReminderBatch(now, batchSize);
        transactionMs += durationSince(transactionStartedAt);
        return {
          ...result,
          attempts: attempt,
          timings: {
            ...result.phaseTimings,
            transactionMs: Number(transactionMs.toFixed(3)),
            totalServiceMs: durationSince(serviceStartedAt)
          }
        };
      } catch (error) {
        transactionMs += durationSince(transactionStartedAt);
        const code = transientScheduleReminderTransactionCode(error);
        if (!code || attempt === MAX_SCHEDULE_REMINDER_TRANSACTION_ATTEMPTS) {
          if (code) {
            console.warn("[ScheduleReminderCron] transient transaction retry exhausted.", {
              attempt,
              code
            });
          }
          throw error;
        }
        console.warn("[ScheduleReminderCron] retrying transient transaction.", {
          attempt,
          nextAttempt: attempt + 1,
          code
        });
      }
    }

    throw new Error("Schedule reminder transaction attempts exhausted.");
  }
};
