import {
  AnnouncementStatus,
  EventStatus,
  NotificationType,
  Prisma,
  ScheduleStatus
} from "@prisma/client";
import { prisma } from "@/prisma/client";
import {
  INTERNAL_JOB_LOCK_NAMESPACE,
  notificationRepository
} from "@/repositories/notification.repository";

type LifecycleDatabase = Prisma.TransactionClient;
export type LifecycleKind = "schedules" | "events" | "announcements";

export const LIFECYCLE_LOCK_KEYS: Record<LifecycleKind, number> = {
  schedules: 2,
  events: 3,
  announcements: 4
};

async function tryAcquireLock(kind: LifecycleKind, database: LifecycleDatabase) {
  const [result] = await database.$queryRaw<Array<{ acquired: boolean }>>`
    SELECT pg_try_advisory_xact_lock(
      CAST(${INTERNAL_JOB_LOCK_NAMESPACE} AS INTEGER),
      CAST(${LIFECYCLE_LOCK_KEYS[kind]} AS INTEGER)
    ) AS "acquired"
  `;
  return result?.acquired === true;
}

export const lifecycleRepository = {
  transaction<T>(callback: (database: LifecycleDatabase) => Promise<T>) {
    return prisma.$transaction(callback, { maxWait: 5_000, timeout: 30_000 });
  },

  tryAcquireLock,

  listExpiredScheduleIds(cutoff: Date, limit: number, database: LifecycleDatabase) {
    return database.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "Schedule"
      WHERE "status" = CAST(${ScheduleStatus.PUBLISHED} AS "ScheduleStatus")
        AND "date" < ${cutoff}
        AND "deletedAt" IS NULL
      ORDER BY "date" ASC, "id" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    `);
  },

  async completeSchedules(ids: string[], cutoff: Date, database: LifecycleDatabase) {
    if (ids.length === 0) return { count: 0, cancelledReminders: 0 };
    const updated = await database.schedule.updateMany({
      where: {
        id: { in: ids },
        status: ScheduleStatus.PUBLISHED,
        date: { lt: cutoff },
        deletedAt: null
      },
      data: { status: ScheduleStatus.COMPLETED }
    });
    const reminders = await notificationRepository.cancelPendingByEntities(
      "SCHEDULE",
      ids,
      NotificationType.SCHEDULE_REMINDER,
      database
    );
    return { count: updated.count, cancelledReminders: reminders.count };
  },

  listExpiredEventIds(cutoff: Date, limit: number, database: LifecycleDatabase) {
    return database.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "Event"
      WHERE "status" IN (
          CAST(${EventStatus.DRAFT} AS "EventStatus"),
          CAST(${EventStatus.PUBLISHED} AS "EventStatus")
        )
        AND COALESCE("endDate", "startDate") < ${cutoff}
        AND "deletedAt" IS NULL
      ORDER BY COALESCE("endDate", "startDate") ASC, "id" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    `);
  },

  async archiveEvents(ids: string[], cutoff: Date, database: LifecycleDatabase) {
    if (ids.length === 0) return { count: 0, cancelledReminders: 0 };
    const updated = await database.event.updateMany({
      where: {
        id: { in: ids },
        status: { in: [EventStatus.DRAFT, EventStatus.PUBLISHED] },
        OR: [{ endDate: { lt: cutoff } }, { endDate: null, startDate: { lt: cutoff } }],
        deletedAt: null
      },
      data: { status: EventStatus.ARCHIVED }
    });
    const reminders = await notificationRepository.cancelPendingByEntities(
      "EVENT",
      ids,
      NotificationType.EVENT_REMINDER,
      database
    );
    return { count: updated.count, cancelledReminders: reminders.count };
  },

  listExpiredAnnouncementIds(cutoff: Date, limit: number, database: LifecycleDatabase) {
    return database.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "Announcement"
      WHERE "status" IN (
          CAST(${AnnouncementStatus.DRAFT} AS "AnnouncementStatus"),
          CAST(${AnnouncementStatus.PUBLISHED} AS "AnnouncementStatus")
        )
        AND "expiresAt" IS NOT NULL
        AND "expiresAt" < ${cutoff}
        AND "deletedAt" IS NULL
      ORDER BY "expiresAt" ASC, "id" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    `);
  },

  archiveAnnouncements(ids: string[], cutoff: Date, database: LifecycleDatabase) {
    if (ids.length === 0) return Promise.resolve({ count: 0 });
    return database.announcement.updateMany({
      where: {
        id: { in: ids },
        status: { in: [AnnouncementStatus.DRAFT, AnnouncementStatus.PUBLISHED] },
        expiresAt: { not: null, lt: cutoff },
        deletedAt: null
      },
      data: { status: AnnouncementStatus.ARCHIVED }
    });
  }
};
