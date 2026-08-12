import { strict as assert } from "node:assert";
import { EventStatus, NotificationType } from "@prisma/client";
import { eventRepository } from "../src/repositories/event.repository";
import { notificationRepository } from "../src/repositories/notification.repository";
import { eventService } from "../src/services/event.service";
import { notificationPublisher } from "../src/services/notification-publisher.service";
import { pushNotificationService } from "../src/services/push-notification.service";
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

const ADMIN_ID = "clh2gko3d0000s9h5dwv9nwyb";
const RECIPIENT_ID = "clh2gko3d0000s9h5dwv9nwyc";
const OTHER_RECIPIENT_ID = "clh2gko3d0000s9h5dwv9nwyd";

const event = (overrides: Record<string, unknown> = {}) => ({
  id: "event-1",
  title: "Culto de Celebracao",
  slug: "culto-de-celebracao",
  description: null,
  type: "SERVICE",
  status: EventStatus.DRAFT,
  publishedAt: null,
  notificationVersion: 0,
  ministry: null,
  responsibleMember: null,
  startDate: new Date("2030-08-16T00:00:00.000Z"),
  endDate: null,
  startTime: "19:00",
  endTime: null,
  location: null,
  address: null,
  capacity: null,
  requiresRegistration: false,
  isPublic: true,
  imageUrl: null,
  observations: null,
  createdAt: new Date("2030-08-01T00:00:00.000Z"),
  updatedAt: new Date("2030-08-01T00:00:00.000Z"),
  ...overrides
});

async function main() {
  let scenarios = 0;
  const check = (value: unknown, message: string) => {
    assert(value, message);
    scenarios += 1;
    console.info(`PASS ${scenarios}: ${message}`);
  };
  const repository = eventRepository as unknown as Mutable;
  const notifications = notificationRepository as unknown as Mutable;
  const publisher = notificationPublisher as unknown as Mutable;
  const push = pushNotificationService as unknown as Mutable;

  let current = event();
  let recipientIds = [RECIPIENT_ID];
  let publishedInputs: NotificationCreateInput[] = [];
  let publishedBatches: NotificationCreateInput[][] = [];
  let pushAttempts = 0;
  let transactionTail = Promise.resolve();
  let failNotificationWrites = false;

  const captureError = async (operation: () => Promise<unknown>) => {
    try {
      await operation();
      return null;
    } catch (error) {
      return error;
    }
  };

  try {
    replace(repository, "transaction", ((callback: (database: unknown) => Promise<unknown>) => {
      const result = transactionTail.then(async () => {
        const previousEvent = current;
        const previousBatches = publishedBatches;
        try {
          return await callback({});
        } catch (error) {
          current = previousEvent;
          publishedBatches = previousBatches;
          throw error;
        }
      });
      transactionTail = result.then(
        () => undefined,
        () => undefined
      );
      return result;
    }) as never);
    replace(repository, "findById", (() => Promise.resolve(current)) as never);
    replace(repository, "transitionStatus", (() => {
      current = event({
        ...current,
        status: EventStatus.PUBLISHED,
        publishedAt: new Date("2030-08-10T12:00:00.000Z"),
        notificationVersion: current.notificationVersion + 1
      });
      return Promise.resolve(current);
    }) as never);
    replace(repository, "listActivePortalUsers", (() => Promise.resolve(recipientIds.map((id) => ({ id })))) as never);
    replace(publisher, "preferences", ((userIds: string[], type: NotificationType) => Promise.resolve(
      userIds.map((userId) => ({
        userId,
        active: true,
        preference: { type, inAppEnabled: true, reminderHoursBefore: 24, isDefault: true }
      }))
    )) as never);
    replace(publisher, "publish", ((inputs: NotificationCreateInput[]) => {
      if (failNotificationWrites) {
        return Promise.reject(new Error("Simulated notification write failure"));
      }
      inputs.forEach((item) => notificationCreateSchema.parse(item));
      publishedInputs = inputs;
      if (inputs.length) publishedBatches = [...publishedBatches, inputs];
      return Promise.resolve({
        requested: inputs.length,
        eligible: inputs.length,
        created: inputs.length,
        skipped: 0,
        notificationIds: inputs.map((_, index) => `notification-${index}`)
      });
    }) as never);
    replace(notifications, "findDeliverableByIds", (() => Promise.resolve([{}])) as never);
    replace(push, "sendNotifications", (() => {
      pushAttempts += 1;
      return Promise.reject(new Error("Simulated Web Push failure"));
    }) as never);

    const published = await eventService.publish(current.id, ADMIN_ID);
    check(published.status === EventStatus.PUBLISHED, "publicar um evento DRAFT conclui a transicao para PUBLISHED");
    check(
      publishedInputs.some((item) => item.type === NotificationType.EVENT_CREATED) &&
        publishedInputs.some((item) => item.type === NotificationType.EVENT_REMINDER),
      "EVENT_CREATED e EVENT_REMINDER validos nao bloqueiam a publicacao"
    );
    check(
      publishedInputs.find((item) => item.type === NotificationType.EVENT_CREATED)?.deduplicationKey ===
        `event:published:v1:event-1:${RECIPIENT_ID}`,
      "reproduz a chave versionada que antes era rejeitada pelo validator"
    );
    const eventCreated = publishedInputs.find((item) => item.type === NotificationType.EVENT_CREATED);
    const keys = [
      `event:published:v1:event-1:${RECIPIENT_ID}`,
      `event:published:v2:event-1:${RECIPIENT_ID}`,
      `event:published:v1:event-2:${RECIPIENT_ID}`,
      `event:published:v1:event-1:${OTHER_RECIPIENT_ID}`
    ];
    const keyVariants = eventCreated
      ? [
          eventCreated,
          { ...eventCreated, deduplicationKey: keys[1] },
          { ...eventCreated, entityId: "event-2", deduplicationKey: keys[2] },
          { ...eventCreated, userId: OTHER_RECIPIENT_ID, deduplicationKey: keys[3] }
        ]
      : [];
    check(
      keyVariants.length === keys.length &&
        keyVariants.every((item) => notificationCreateSchema.safeParse(item).success) &&
        new Set(keys).size === keys.length,
      "validator aceita chaves namespaced, versionadas e deterministicas distintas por versao, evento e usuario"
    );
    check(pushAttempts === 1, "falha de Web Push e tratada pelo publisher apos o commit sem bloquear a publicacao");

    const batchesAfterFirstPublication = publishedBatches.length;
    const repeated = await eventService.publish(current.id, ADMIN_ID);
    check(repeated.status === EventStatus.PUBLISHED && current.notificationVersion === 1, "publicacao repetida preserva o estado e a notificationVersion");
    check(publishedBatches.length === batchesAfterFirstPublication, "publicacao repetida nao cria uma segunda notificacao logica");

    current = event({ id: "event-concurrent" });
    recipientIds = [RECIPIENT_ID];
    publishedInputs = [];
    publishedBatches = [];
    pushAttempts = 0;
    const concurrent = await Promise.all([
      eventService.publish(current.id, ADMIN_ID),
      eventService.publish(current.id, ADMIN_ID)
    ]);
    check(concurrent.every((item) => item.status === EventStatus.PUBLISHED) && current.notificationVersion === 1, "duas publicacoes simultaneas convergem para PUBLISHED com uma unica versao");
    check(publishedBatches.length === 1 && publishedBatches[0]?.filter((item) => item.type === NotificationType.EVENT_CREATED).length === 1, "concorrencia cria uma unica EVENT_CREATED por usuario elegivel sem duplicidade");

    current = event({ id: "event-no-time", startTime: null });
    publishedInputs = [];
    pushAttempts = 0;
    const withoutStartTime = await eventService.publish(current.id, ADMIN_ID);
    check(withoutStartTime.status === EventStatus.PUBLISHED, "evento sem horario continua sendo publicado");
    check(
      publishedInputs.length === 1 && publishedInputs[0]?.type === NotificationType.EVENT_CREATED,
      "evento sem horario cria EVENT_CREATED e omite somente o reminder"
    );

    current = event({ id: "event-without-recipients", startTime: null });
    recipientIds = [];
    publishedInputs = [];
    pushAttempts = 0;
    const withoutRecipients = await eventService.publish(current.id, ADMIN_ID);
    check(withoutRecipients.status === EventStatus.PUBLISHED, "zero destinatarios nao bloqueia a publicacao");
    check(publishedInputs.length === 0 && pushAttempts === 0, "zero destinatarios nao cria notificacao nem tenta Web Push");

    current = event({ id: "event-rollback" });
    recipientIds = [RECIPIENT_ID];
    publishedInputs = [];
    publishedBatches = [];
    pushAttempts = 0;
    failNotificationWrites = true;
    const rollbackError = await captureError(() => eventService.publish(current.id, ADMIN_ID));
    failNotificationWrites = false;
    check(rollbackError instanceof Error && rollbackError.message === "Simulated notification write failure", "falha estrutural anterior ao commit e propagada");
    check(current.status === EventStatus.DRAFT && current.notificationVersion === 0 && publishedBatches.length === 0, "rollback estrutural preserva evento DRAFT sem notificacoes persistidas");
    check(pushAttempts === 0, "rollback estrutural nao dispara Web Push");

    console.info(`Event publication regression: ${scenarios} scenarios passed.`);
  } finally {
    for (const { target, key, value } of originals) target[key] = value;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
