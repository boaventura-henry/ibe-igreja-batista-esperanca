import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { AnnouncementStatus, EventStatus, ScheduleStatus } from "@prisma/client";
import { applicationDateOnlyCutoff, applicationDayStart } from "../src/lib/application-time";
import { buildAnnouncementWhere } from "../src/repositories/announcement.repository";
import { buildEventWhere } from "../src/repositories/event.repository";
import {
  LIFECYCLE_LOCK_KEYS,
  lifecycleRepository
} from "../src/repositories/lifecycle.repository";
import { SCHEDULE_REMINDERS_CRON_LOCK_KEY } from "../src/repositories/notification.repository";
import { buildMyScheduleWhere } from "../src/repositories/my-schedule.repository";
import { buildScheduleWhere } from "../src/repositories/schedule.repository";
import { lifecycleService } from "../src/services/lifecycle.service";
import { scheduledJobsService } from "../src/services/scheduled-jobs.service";
import { scheduleNotificationService } from "../src/services/schedule-notification.service";

type MutableMethods = Record<string, (...args: never[]) => unknown>;
const repository = lifecycleRepository as unknown as MutableMethods;
const lifecycle = lifecycleService as unknown as MutableMethods;
const reminders = scheduleNotificationService as unknown as MutableMethods;
const originals: Array<{ target: MutableMethods; method: string; value: MutableMethods[string] }> = [];

function replace(target: MutableMethods, method: string, implementation: (...args: never[]) => unknown) {
  if (!originals.some((original) => original.target === target && original.method === method)) {
    originals.push({ target, method, value: target[method] });
  }
  target[method] = implementation;
}

async function main() {
  let scenarios = 0;
  const check = (condition: unknown, message: string) => {
    assert(condition, message);
    scenarios += 1;
    console.info(`PASS ${scenarios}: ${message}`);
  };

  const reference = new Date("2026-08-04T15:00:00.000Z");
  check(applicationDateOnlyCutoff(reference).toISOString() === "2026-08-04T00:00:00.000Z", "data de corte preserva o dia civil de Sao Paulo");
  check(applicationDayStart(reference).toISOString() === "2026-08-04T03:00:00.000Z", "inicio do dia converte Sao Paulo para UTC");

  replace(repository, "transaction", ((callback: (database: unknown) => Promise<unknown>) => callback({})) as never);
  let lockAcquired = true;
  replace(repository, "tryAcquireLock", (() => Promise.resolve(lockAcquired)) as never);

  let scheduleIds = [{ id: "schedule-expired" }];
  let completedScheduleIds: string[] = [];
  replace(repository, "listExpiredScheduleIds", (() => Promise.resolve(scheduleIds)) as never);
  replace(repository, "completeSchedules", ((ids: string[]) => {
    completedScheduleIds = ids;
    return Promise.resolve({ count: ids.length, cancelledReminders: ids.length });
  }) as never);
  const schedules = await lifecycleService.processExpiredSchedules(reference);
  check(schedules.updated === 1 && completedScheduleIds[0] === "schedule-expired", "escala publicada vencida e concluida");
  check(schedules.cancelledReminders === 1, "conclusao automatica cancela lembrete pendente");
  scheduleIds = [];
  check((await lifecycleService.processExpiredSchedules(reference)).updated === 0, "reexecucao de escalas e idempotente");

  let eventIds = [{ id: "event-expired" }];
  replace(repository, "listExpiredEventIds", (() => Promise.resolve(eventIds)) as never);
  replace(repository, "archiveEvents", ((ids: string[]) => Promise.resolve({ count: ids.length })) as never);
  check((await lifecycleService.processExpiredEvents(reference)).updated === 1, "evento vencido e arquivado");
  eventIds = [];
  check((await lifecycleService.processExpiredEvents(reference)).updated === 0, "reexecucao de eventos e idempotente");

  let announcementIds = [{ id: "announcement-expired" }];
  replace(repository, "listExpiredAnnouncementIds", (() => Promise.resolve(announcementIds)) as never);
  replace(repository, "archiveAnnouncements", ((ids: string[]) => Promise.resolve({ count: ids.length })) as never);
  check((await lifecycleService.processExpiredAnnouncements(reference)).updated === 1, "comunicado vencido e arquivado");
  announcementIds = [];
  check((await lifecycleService.processExpiredAnnouncements(reference)).updated === 0, "comunicado sem candidato permanece inalterado");

  lockAcquired = false;
  check(!(await lifecycleService.processExpiredSchedules(reference)).executed, "lock concorrente impede processamento duplicado");
  lockAcquired = true;

  check(
    new Set([SCHEDULE_REMINDERS_CRON_LOCK_KEY, ...Object.values(LIFECYCLE_LOCK_KEYS)]).size === 4,
    "cada processador usa chave de advisory lock independente"
  );

  let transactionAttempts = 0;
  replace(repository, "transaction", (async (callback: (database: unknown) => Promise<unknown>) => {
    transactionAttempts += 1;
    if (transactionAttempts === 1) throw { code: "P2034" };
    return callback({});
  }) as never);
  scheduleIds = [];
  await lifecycleService.processExpiredSchedules(reference);
  check(transactionAttempts === 2, "falha transitoria refaz a transacao em tentativa limitada");
  replace(repository, "transaction", ((callback: (database: unknown) => Promise<unknown>) => callback({})) as never);

  replace(reminders, "processPendingReminders", (() => Promise.resolve({ reason: "empty_batch" })) as never);
  replace(lifecycle, "processExpiredSchedules", (() => Promise.resolve({ updated: 1 })) as never);
  replace(lifecycle, "processExpiredEvents", (() => Promise.resolve({ updated: 2 })) as never);
  replace(lifecycle, "processExpiredAnnouncements", (() => Promise.resolve({ updated: 3 })) as never);
  const orchestrated = await scheduledJobsService.run(reference);
  check(orchestrated.lifecycle.schedules !== undefined, "orquestrador executa lifecycle de escalas");
  check(orchestrated.lifecycle.events !== undefined, "orquestrador executa lifecycle de eventos");
  check(orchestrated.lifecycle.announcements !== undefined, "orquestrador executa lifecycle de comunicados");

  let schedulesAttempted = false;
  let eventsAttempted = false;
  let announcementsAttempted = false;
  replace(reminders, "processPendingReminders", (() => Promise.reject(new Error("reminder failure"))) as never);
  replace(lifecycle, "processExpiredSchedules", (() => {
    schedulesAttempted = true;
    return Promise.resolve({ updated: 0 });
  }) as never);
  replace(lifecycle, "processExpiredEvents", (() => {
    eventsAttempted = true;
    return Promise.resolve({ updated: 0 });
  }) as never);
  replace(lifecycle, "processExpiredAnnouncements", (() => {
    announcementsAttempted = true;
    return Promise.resolve({ updated: 0 });
  }) as never);
  await assert.rejects(() => scheduledJobsService.run(reference), /reminder failure/);
  check(
    schedulesAttempted && eventsAttempted && announcementsAttempted,
    "falha de lembretes nao impede tentativa dos processadores de lifecycle"
  );

  let remindersAttempted = false;
  schedulesAttempted = false;
  announcementsAttempted = false;
  replace(reminders, "processPendingReminders", (() => {
    remindersAttempted = true;
    return Promise.resolve({ reason: "empty_batch" });
  }) as never);
  replace(lifecycle, "processExpiredSchedules", (() => {
    schedulesAttempted = true;
    return Promise.resolve({ updated: 0 });
  }) as never);
  replace(lifecycle, "processExpiredEvents", (() => Promise.reject(new Error("event failure"))) as never);
  replace(lifecycle, "processExpiredAnnouncements", (() => {
    announcementsAttempted = true;
    return Promise.resolve({ updated: 0 });
  }) as never);
  await assert.rejects(() => scheduledJobsService.run(reference), /event failure/);
  check(
    remindersAttempted && schedulesAttempted && announcementsAttempted,
    "falha de eventos permanece isolada dos outros processadores"
  );

  const basePage = { page: 1, pageSize: 10 };
  const scheduleWhere = buildScheduleWhere({ ...basePage, sortBy: "date", sortOrder: "asc", includeCompleted: false });
  check(JSON.stringify(scheduleWhere).includes(ScheduleStatus.COMPLETED), "listagem de escalas filtra encerradas no servidor");
  check(JSON.stringify(scheduleWhere).includes('"date":{"gte"'), "escala DRAFT vencida fica oculta apenas pelo corte da listagem");
  const allScheduleWhere = buildScheduleWhere({ ...basePage, sortBy: "date", sortOrder: "asc", includeCompleted: true });
  check(!JSON.stringify(allScheduleWhere).includes(ScheduleStatus.COMPLETED), "apresentar todas as escalas remove apenas o filtro de lifecycle");

  const eventWhere = buildEventWhere({ ...basePage, sortBy: "startDate", sortDirection: "asc", includeArchived: false });
  check(JSON.stringify(eventWhere).includes(EventStatus.ARCHIVED), "listagem de eventos filtra arquivados no servidor");
  const allEventWhere = buildEventWhere({ ...basePage, sortBy: "startDate", sortDirection: "asc", includeArchived: true });
  check(!JSON.stringify(allEventWhere).includes(EventStatus.ARCHIVED), "apresentar todos os eventos remove apenas o filtro de lifecycle");

  const announcementWhere = buildAnnouncementWhere({ ...basePage, sortBy: "createdAt", sortDirection: "desc", includeArchived: false });
  check(JSON.stringify(announcementWhere).includes(AnnouncementStatus.ARCHIVED), "listagem de comunicados filtra arquivados no servidor");
  const allAnnouncementWhere = buildAnnouncementWhere({ ...basePage, sortBy: "createdAt", sortDirection: "desc", includeArchived: true });
  check(!JSON.stringify(allAnnouncementWhere).includes(AnnouncementStatus.ARCHIVED), "apresentar todos os comunicados remove apenas o filtro de lifecycle");

  const myScheduleWhere = buildMyScheduleWhere("member-1", { includeCompleted: false });
  check(JSON.stringify(myScheduleWhere).includes(ScheduleStatus.COMPLETED), "minhas escalas filtra concluidas no servidor");
  const allMyScheduleWhere = buildMyScheduleWhere("member-1", { includeCompleted: true });
  check(!JSON.stringify(allMyScheduleWhere).includes(ScheduleStatus.COMPLETED), "minhas escalas pode apresentar historico completo");

  const lifecycleRepositorySource = readFileSync("src/repositories/lifecycle.repository.ts", "utf8");
  const lifecycleServiceSource = readFileSync("src/services/lifecycle.service.ts", "utf8");
  const backfill = readFileSync(
    "prisma/migrations/20260804120100_backfill_expired_lifecycle_statuses/migration.sql",
    "utf8"
  );
  const eventBackfill = backfill.slice(backfill.indexOf('UPDATE "Event"'), backfill.indexOf('UPDATE "Announcement"'));
  const scheduleProcessor = lifecycleRepositorySource.slice(
    lifecycleRepositorySource.indexOf("listExpiredScheduleIds"),
    lifecycleRepositorySource.indexOf("listExpiredEventIds")
  );
  const eventProcessor = lifecycleRepositorySource.slice(
    lifecycleRepositorySource.indexOf("listExpiredEventIds"),
    lifecycleRepositorySource.indexOf("listExpiredAnnouncementIds")
  );
  check(
    scheduleProcessor.includes("ScheduleStatus.PUBLISHED") &&
      !scheduleProcessor.includes("ScheduleStatus.DRAFT"),
    "escala DRAFT vencida nao participa do encerramento automatico"
  );
  check(
    !eventBackfill.includes("'COMPLETED'") &&
      !eventProcessor.includes("EventStatus.COMPLETED"),
    "eventos concluidos permanecem concluidos no runtime e no backfill"
  );
  check(
    eventBackfill.includes("'DRAFT', 'PUBLISHED'") && backfill.includes('"status" = \'PUBLISHED\''),
    "backfill inclui rascunhos vencidos e limita escalas ao status publicado"
  );
  check(
    backfill.match(/AS "todayDate"/g)?.length === 2 &&
      backfill.match(/AS "todayStartUtc"/g)?.length === 1 &&
      eventBackfill.includes('boundary."todayDate"'),
    "backfill separa data civil de escalas e eventos do instante de comunicados"
  );
  check(
    !backfill.includes('"notificationVersion"') &&
      !backfill.includes('"publishedAt"') &&
      !backfill.includes('"createdAt"') &&
      !backfill.includes('"updatedById"'),
    "backfill nao altera auditoria imutavel nem estado de notificacao"
  );
  check(
    backfill.match(/"deletedAt" IS NULL/g)?.length === 3,
    "backfill preserva soft delete nos tres dominios"
  );
  check(
    !lifecycleRepositorySource.includes("notificationPublisher") &&
      !lifecycleServiceSource.includes("notificationPublisher"),
    "encerramento automatico nao publica notificacoes"
  );

  console.info(`Expired lifecycle: ${scenarios} scenarios passed.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    for (const { target, method, value } of originals) target[method] = value;
  });
