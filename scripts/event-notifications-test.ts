import { strict as assert } from "node:assert";
import { EventStatus, NotificationType } from "@prisma/client";
import { eventRepository } from "../src/repositories/event.repository";
import { notificationRepository } from "../src/repositories/notification.repository";
import { eventNotificationService, eventStartAt } from "../src/services/event-notification.service";
import { notificationPublisher } from "../src/services/notification-publisher.service";
import {
  notificationCreateSchema,
  type NotificationCreateInput
} from "../src/validators/notification.validator";

type Mutable = Record<string, (...args: never[]) => unknown>;
const originals: Array<{ target: Mutable; key: string; value: Mutable[string] }> = [];

function replace(target: Mutable, key: string, value: (...args: never[]) => unknown) {
  if (!originals.some((item) => item.target === target && item.key === key)) {
    originals.push({ target, key, value: target[key] });
  }
  target[key] = value;
}

const event = (overrides: Record<string, unknown> = {}) => ({
  id: "event-1", title: "Culto de Celebracao", slug: "culto", description: null,
  type: "SERVICE", status: EventStatus.PUBLISHED, publishedAt: new Date("2026-08-10T12:00:00.000Z"),
  notificationVersion: 1, ministry: null, responsibleMember: null,
  startDate: new Date("2026-08-16T00:00:00.000Z"), endDate: null,
  startTime: "19:00", endTime: null, location: null, address: null, capacity: null,
  requiresRegistration: false, isPublic: true, imageUrl: null, observations: null,
  createdAt: new Date(), updatedAt: new Date(), ...overrides
});

const ADMIN_ID = "clh2gko3d0000s9h5dwv9nwyb";
const RECIPIENT_IDS = [
  "clh2gko3d0000s9h5dwv9nwyb",
  "clh2gko3d0000s9h5dwv9nwyc"
];

async function main() {
  let scenarios = 0;
  const check = (value: unknown, message: string) => {
    assert(value, message); scenarios += 1; console.info(`PASS ${scenarios}: ${message}`);
  };
  const repository = eventRepository as unknown as Mutable;
  const notifications = notificationRepository as unknown as Mutable;
  const publisher = notificationPublisher as unknown as Mutable;
  try {
    const startsAt = eventStartAt(event() as never);
    check(startsAt?.toISOString() === "2026-08-16T22:00:00.000Z", "horario de Sao Paulo converte corretamente para UTC");

    let published: NotificationCreateInput[] = [];
    replace(repository, "listActivePortalUsers", (() => Promise.resolve(RECIPIENT_IDS.map((id) => ({ id })))) as never);
    replace(publisher, "preferences", ((ids: string[], type: NotificationType) => Promise.resolve(ids.map((userId) => ({ userId, active: true, preference: { type, inAppEnabled: true, reminderHoursBefore: 24, isDefault: true } })))) as never);
    replace(publisher, "publish", ((inputs: NotificationCreateInput[]) => {
      inputs.forEach((item) => notificationCreateSchema.parse(item));
      published = inputs;
      return Promise.resolve({ requested: inputs.length, eligible: inputs.length, created: inputs.length, skipped: 0, notificationIds: inputs.map((_, index) => `n-${index}`) });
    }) as never);
    await eventNotificationService.publishInitial(event() as never, ADMIN_ID, {} as never, new Date("2026-08-10T12:00:00.000Z"));
    check(published.filter((item) => item.type === NotificationType.EVENT_CREATED).length === 2, "primeira publicacao cria uma notificacao por usuario elegivel");
    check(published.filter((item) => item.type === NotificationType.EVENT_REMINDER).length === 2, "evento futuro cria reminder por usuario elegivel");
    check(published.every((item) => item.deduplicationKey?.includes(item.userId)), "deduplicacao e persistente por evento e usuario");
    check(
      published
        .filter((item) => item.type === NotificationType.EVENT_CREATED)
        .every((item) => item.deduplicationKey === `event:published:v1:event-1:${item.userId}`),
      "notificacao inicial usa a chave de deduplicacao versionada aceita pelo validator"
    );
    check(published.some((item) => item.message.includes("16/08/2026 as 19:00")), "mensagem de publicacao e amigavel e usa data e horario");

    published = [];
    await eventNotificationService.publishInitial(event({ startDate: new Date("2026-08-10T00:00:00.000Z"), startTime: "18:00" }) as never, ADMIN_ID, {} as never, new Date("2026-08-10T20:00:00.000Z"));
    check(published.length === 2 && published.every((item) => item.type === NotificationType.EVENT_CREATED), "publicacao dentro de 24 horas nao cria reminder imediato redundante");

    let cancelled = 0;
    replace(publisher, "cancelPendingForEntity", (() => { cancelled += 1; return Promise.resolve({ cancelled: 2 }); }) as never);
    published = [];
    await eventNotificationService.rescheduleReminders(event({ notificationVersion: 2 }) as never, ADMIN_ID, {} as never, new Date("2026-08-10T12:00:00.000Z"));
    check(cancelled === 1 && published.every((item) => item.type === NotificationType.EVENT_REMINDER), "alteracao temporal cancela reminder anterior e cria apenas o novo elegivel");

    let lock = true;
    let sent: string[] = [];
    let invalidated: string[] = [];
    replace(notifications, "transaction", ((callback: (database: unknown) => Promise<unknown>) => callback({})) as never);
    replace(notifications, "tryAcquireInternalJobLock", (() => Promise.resolve(lock)) as never);
    replace(notifications, "listDueScheduled", (() => Promise.resolve([{ id: "reminder-1", userId: "user-a", entityType: "EVENT", entityId: "event-1", expiresAt: new Date("2026-08-17T10:00:00.000Z"), deduplicationKey: "event:reminder:v1:event-1:user-a:202608161900" }])) as never);
    replace(notifications, "markSent", ((ids: string[]) => { sent = ids; return Promise.resolve({ count: ids.length }); }) as never);
    replace(notifications, "cancelScheduled", ((ids: string[]) => { invalidated = ids; return Promise.resolve({ count: ids.length }); }) as never);
    replace(repository, "listPublishedByIds", (() => Promise.resolve([event()])) as never);
    replace(repository, "listActivePortalUsersByIds", (() => Promise.resolve([{ id: "user-a" }])) as never);
    replace(publisher, "deliverPush", (() => Promise.resolve({})) as never);
    const processed = await eventNotificationService.processPendingReminders(new Date("2026-08-15T22:00:00.000Z"));
    check(processed.sent === 1 && sent[0] === "reminder-1" && invalidated.length === 0, "processor envia reminder elegivel uma unica vez");
    lock = false;
    const locked = await eventNotificationService.processPendingReminders();
    check(!locked.executed && locked.reason === "already_running", "advisory lock de eventos isola execucoes concorrentes");

    const source = await import("node:fs").then(({ readFileSync }) => readFileSync("src/services/scheduled-jobs.service.ts", "utf8"));
    check(source.includes("eventNotificationService.processPendingReminders"), "orquestrador reutiliza o Cron externo para reminders de eventos");
    check(source.includes("Promise.allSettled"), "falha de job nao impede tentativa dos demais processadores");
    const lifecycleSource = await import("node:fs").then(({ readFileSync }) => readFileSync("src/repositories/lifecycle.repository.ts", "utf8"));
    check(lifecycleSource.includes('"EVENT"') && lifecycleSource.includes("NotificationType.EVENT_REMINDER"), "arquivamento automatico invalida reminders pendentes de eventos");
    console.info(`Event notifications: ${scenarios} scenarios passed.`);
  } finally {
    for (const { target, key, value } of originals) target[key] = value;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
