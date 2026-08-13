import { strict as assert } from "node:assert";
import { EventStatus } from "@prisma/client";
import { eventRepository } from "../src/repositories/event.repository";
import { eventService } from "../src/services/event.service";
import { eventNotificationService } from "../src/services/event-notification.service";
import { notificationPublisher } from "../src/services/notification-publisher.service";

type Mutable = Record<string, (...args: never[]) => unknown>;
const originals: Array<{ target: Mutable; key: string; value: Mutable[string] }> = [];

function replace(target: Mutable, key: string, value: (...args: never[]) => unknown) {
  if (!originals.some((item) => item.target === target && item.key === key)) {
    originals.push({ target, key, value: target[key] });
  }
  target[key] = value;
}

const ADMIN_ID = "clh2gko3d0000s9h5dwv9nwyb";

type EventState = ReturnType<typeof event> & { deletedAt?: Date };

function event(status: EventStatus, overrides: Record<string, unknown> = {}) {
  return {
    id: "event-1", title: "Culto de Celebracao", slug: "culto", description: null,
    type: "SERVICE", status, publishedAt: status === EventStatus.PUBLISHED ? new Date("2030-08-10T12:00:00.000Z") : null,
    notificationVersion: status === EventStatus.PUBLISHED ? 1 : 0, ministry: null, responsibleMember: null,
    startDate: new Date("2030-08-16T00:00:00.000Z"), endDate: null, startTime: "19:00", endTime: null,
    location: null, address: null, capacity: null, requiresRegistration: false, isPublic: true, imageUrl: null,
    observations: null, createdAt: new Date(), updatedAt: new Date(), ...overrides
  };
}

async function main() {
  let scenarios = 0;
  const check = (value: unknown, message: string) => {
    assert(value, message);
    scenarios += 1;
    console.info(`PASS ${scenarios}: ${message}`);
  };
  const repository = eventRepository as unknown as Mutable;
  const notifications = eventNotificationService as unknown as Mutable;
  const publisher = notificationPublisher as unknown as Mutable;
  let current: EventState = event(EventStatus.DRAFT);
  let transactionTail = Promise.resolve();
  let cancellationCalls = 0;
  let delivered: string[][] = [];
  let failNotificationWrite = false;

  const captureError = async (operation: () => Promise<unknown>) => {
    try { await operation(); return null; } catch (error) { return error; }
  };
  const reset = (status: EventStatus) => {
    current = event(status);
    cancellationCalls = 0;
    delivered = [];
    failNotificationWrite = false;
  };

  try {
    replace(repository, "transaction", ((callback: (database: unknown) => Promise<unknown>) => {
      const operation = transactionTail.then(async () => {
        const previous = current;
        try { return await callback({}); } catch (error) { current = previous; throw error; }
      });
      transactionTail = operation.then(() => undefined, () => undefined);
      return operation;
    }) as never);
    replace(repository, "findById", (() => Promise.resolve((current as { deletedAt?: Date }).deletedAt ? null : current)) as never);
    replace(repository, "transitionStatus", ((_id: string, from: EventStatus[], status: EventStatus) => {
      if (!from.includes(current.status)) return Promise.resolve(null);
      current = { ...current, status };
      return Promise.resolve(current);
    }) as never);
    replace(repository, "incrementNotificationVersion", (() => {
      current = { ...current, notificationVersion: current.notificationVersion + 1 };
      return Promise.resolve({ notificationVersion: current.notificationVersion });
    }) as never);
    replace(repository, "softDeleteWithinTransaction", (() => {
      current = { ...current, deletedAt: new Date() };
      return Promise.resolve({ count: 1 });
    }) as never);
    replace(notifications, "cancelled", (() => {
      if (failNotificationWrite) return Promise.reject(new Error("Simulated notification write failure"));
      cancellationCalls += 1;
      return Promise.resolve({ notificationIds: ["cancel-1"] });
    }) as never);
    replace(notifications, "cancelPendingReminders", (() => Promise.resolve({ cancelled: 1 })) as never);
    replace(publisher, "deliverPush", ((ids: string[]) => { delivered.push(ids); return Promise.resolve({}); }) as never);

    reset(EventStatus.DRAFT);
    await eventService.cancel(current.id, ADMIN_ID);
    check(current.status === EventStatus.CANCELED && cancellationCalls === 0 && delivered[0]?.length === 0, "DRAFT para CANCELED nao cria notificacao nem Web Push");

    reset(EventStatus.DRAFT);
    await eventService.remove(current.id, ADMIN_ID);
    check(Boolean((current as { deletedAt?: Date }).deletedAt) && cancellationCalls === 0 && delivered[0]?.length === 0, "soft delete de DRAFT nao cria notificacao nem Web Push");

    reset(EventStatus.PUBLISHED);
    await eventService.cancel(current.id, ADMIN_ID);
    check(current.status === EventStatus.CANCELED && current.notificationVersion === 2 && cancellationCalls === 1, "PUBLISHED para CANCELED gera um unico cancelamento versionado");
    check(delivered[0]?.join(",") === "cancel-1", "cancelamento entrega Web Push somente apos o commit");

    await eventService.remove(current.id, ADMIN_ID);
    check(cancellationCalls === 1, "CANCELED para soft delete nao gera um segundo cancelamento");

    reset(EventStatus.PUBLISHED);
    await eventService.remove(current.id, ADMIN_ID);
    check(Boolean((current as { deletedAt?: Date }).deletedAt) && current.notificationVersion === 2 && cancellationCalls === 1, "soft delete de PUBLISHED gera um unico cancelamento");

    reset(EventStatus.COMPLETED);
    await eventService.remove(current.id, ADMIN_ID);
    check(cancellationCalls === 0, "soft delete de COMPLETED nao cria EVENT_CANCELED");

    reset(EventStatus.ARCHIVED);
    const archivedError = await captureError(() => eventService.remove(current.id, ADMIN_ID));
    check(archivedError instanceof Error && cancellationCalls === 0, "ARCHIVED permanece imutavel e nao cria EVENT_CANCELED");

    reset(EventStatus.PUBLISHED);
    failNotificationWrite = true;
    const rollbackError = await captureError(() => eventService.cancel(current.id, ADMIN_ID));
    check(rollbackError instanceof Error && current.status === EventStatus.PUBLISHED && current.notificationVersion === 1 && delivered.length === 0, "falha estrutural faz rollback e nao dispara Push");

    reset(EventStatus.PUBLISHED);
    await Promise.all([eventService.cancel(current.id, ADMIN_ID), eventService.cancel(current.id, ADMIN_ID)]);
    check(cancellationCalls === 1 && current.status === EventStatus.CANCELED, "cancelamentos concorrentes convergem sem duplicidade");

    reset(EventStatus.PUBLISHED);
    await Promise.all([eventService.cancel(current.id, ADMIN_ID), eventService.remove(current.id, ADMIN_ID)]);
    check(cancellationCalls === 1 && Boolean((current as { deletedAt?: Date }).deletedAt), "cancelamento e exclusao concorrentes mantem no maximo uma notificacao");

    reset(EventStatus.PUBLISHED);
    const concurrentDeletes = await Promise.allSettled([eventService.remove(current.id, ADMIN_ID), eventService.remove(current.id, ADMIN_ID)]);
    check(
      cancellationCalls === 1 && concurrentDeletes.filter((result) => result.status === "fulfilled").length === 1,
      "dupla exclusao concorrente mantem uma ocorrencia logica sem duplicidade"
    );

    reset(EventStatus.PUBLISHED);
    await eventService.remove(current.id, ADMIN_ID);
    const deletedError = await captureError(() => eventService.remove(current.id, ADMIN_ID));
    check(deletedError instanceof Error && cancellationCalls === 1, "nova exclusao de evento removido nao cria novo cancelamento");

    console.info(`Event cancellation notifications: ${scenarios} scenarios passed.`);
  } finally {
    for (const { target, key, value } of originals) target[key] = value;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
