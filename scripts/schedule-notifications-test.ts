import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  NotificationType,
  ScheduleMemberRole,
  ScheduleMemberStatus,
  ScheduleScope,
  ScheduleStatus
} from "@prisma/client";
import type { ScheduleAuthorization } from "../src/lib/schedule-authorization";
import { getScheduleMemberRolePresentation } from "../src/lib/schedule-member-role";
import { notificationRepository } from "../src/repositories/notification.repository";
import {
  scheduleRepository,
  type ScheduleMemberRecord,
  type ScheduleRecord
} from "../src/repositories/schedule.repository";
import { notificationPublisher } from "../src/services/notification-publisher.service";
import { scheduleService } from "../src/services/schedule.service";
import {
  activeScheduleRecipients,
  describeScheduleChanges,
  scheduleNotificationService,
  scheduleStartAt
} from "../src/services/schedule-notification.service";
import type { NotificationCreateInput } from "../src/validators/notification.validator";

type MutableMethods = Record<string, (...args: never[]) => unknown>;
  const publisher = notificationPublisher as unknown as MutableMethods;
  const notificationRepo = notificationRepository as unknown as MutableMethods;
  const scheduleRepo = scheduleRepository as unknown as MutableMethods;
  const scheduleNotifications = scheduleNotificationService as unknown as MutableMethods;
const originals = new Map<string, { target: MutableMethods; value: MutableMethods[string] }>();

function replace(
  key: string,
  target: MutableMethods,
  method: string,
  implementation: (...args: never[]) => unknown
) {
  originals.set(key, { target, value: target[method] });
  target[method] = implementation;
}

function member(
  id: string,
  userId: string | null,
  overrides: Partial<ScheduleMemberRecord> = {}
): ScheduleMemberRecord {
  return {
    id,
    roles: [{ role: ScheduleMemberRole.VOCAL }],
    status: ScheduleMemberStatus.PENDING,
    confirmedAt: null,
    declinedAt: null,
    declineReason: null,
    observations: null,
    createdAt: new Date("2026-07-29T10:00:00.000Z"),
    updatedAt: new Date("2026-07-29T10:00:00.000Z"),
    member: {
      id: `member-${id}`,
      name: `Membro ${id}`,
      nickname: null,
      status: "ACTIVE",
      user: userId ? { id: userId } : null
    },
    replacedByMember: null,
    instrumentAssignments: [],
    ...overrides
  } as ScheduleMemberRecord;
}

function schedule(
  overrides: Partial<ScheduleRecord> = {}
): ScheduleRecord {
  return {
    id: "schedule-1",
    title: "Culto de domingo",
    description: null,
    date: new Date("2026-08-02T00:00:00.000Z"),
    startTime: "19:00",
    endTime: "20:30",
    location: "Templo Principal",
    status: ScheduleStatus.PUBLISHED,
    publishedAt: new Date("2026-07-29T12:00:00.000Z"),
    notificationVersion: 1,
    observations: null,
    createdAt: new Date("2026-07-28T12:00:00.000Z"),
    updatedAt: new Date("2026-07-29T12:00:00.000Z"),
    ministry: {
      id: "ministry-1",
      name: "Louvor",
      color: "#123456",
      isActive: true
    },
    event: null,
    members: [
      member("participant-1", "user-1", {
        roles: [{ role: ScheduleMemberRole.INSTRUMENT }]
      })
    ],
    ...overrides
  };
}

async function captureError(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    return error;
  }
  assert.fail("A operacao deveria falhar.");
}

async function main() {
  let scenarios = 0;
  const check = (condition: unknown, message: string) => {
    assert(condition, message);
    scenarios += 1;
    console.log(`PASS ${scenarios}: ${message}`);
  };
  let published: NotificationCreateInput[] = [];
  let cancelledUsers: string[] | undefined;
  const deliveredPushBatches: string[][] = [];

  replace(
    "publisher:publish",
    publisher,
    "publish",
    ((inputs: NotificationCreateInput[]) => {
      published.push(...inputs);
      return Promise.resolve({
        requested: inputs.length,
        eligible: inputs.length,
        created: inputs.length,
        skipped: 0
      });
    }) as never
  );
  replace(
    "publisher:preferences",
    publisher,
    "preferences",
    ((userIds: string[]) =>
      Promise.resolve(
        userIds.map((userId) => ({
          userId,
          active: true,
          preference: {
            type: NotificationType.SCHEDULE_REMINDER,
            inAppEnabled: true,
            reminderHoursBefore: 24,
            isDefault: true
          }
        }))
      )) as never
  );
  replace(
    "publisher:deliverPush",
    publisher,
    "deliverPush",
    ((notificationIds: string[]) => {
      if (notificationIds.length) deliveredPushBatches.push([...notificationIds]);
      return Promise.resolve({ notifications: notificationIds.length, attempted: notificationIds.length, sent: 0, failed: notificationIds.length });
    }) as never
  );
  replace(
    "publisher:cancel",
    publisher,
    "cancelPendingForEntity",
    ((input: { userIds?: string[] }) => {
      cancelledUsers = input.userIds;
      return Promise.resolve({ cancelled: 1 });
    }) as never
  );

  try {
    const primary = member("one", "user-1", {
      roles: [{ role: ScheduleMemberRole.INSTRUMENT }]
    });
    const duplicate = member("two", "user-1");
    const withoutUser = member("three", null);
    const replacement = member("four", "old-user", {
      status: ScheduleMemberStatus.REPLACED,
      replacedByMember: {
        id: "replacement-member",
        name: "Substituto",
        nickname: null,
        status: "ACTIVE",
        user: { id: "new-user" }
      }
    });
    const recipients = activeScheduleRecipients([
      primary,
      duplicate,
      withoutUser,
      replacement
    ]);
    check(recipients.length === 2, "destinatarios sao deduplicados por usuario");
    check(recipients.some((item) => item.userId === "user-1"), "participante principal elegivel");
    check(!recipients.some((item) => item.userId === "old-user"), "substituido deixa de ser participante atual");
    check(recipients.some((item) => item.userId === "new-user"), "substituto passa a ser destinatario");
    check(!recipients.some((item) => item.userId === ""), "membro sem usuario e ignorado");

    const startsAt = scheduleStartAt(schedule());
    check(startsAt?.toISOString() === "2026-08-02T22:00:00.000Z", "horario usa America/Sao_Paulo");
    check(scheduleStartAt(schedule({ startTime: null })) === null, "sem horario nao agenda lembrete");
    check(describeScheduleChanges(["date"]).includes("a data"), "mudanca unica e descrita");
    check(
      describeScheduleChanges(["date", "startTime", "location"]).includes("o local"),
      "mudancas multiplas sao consolidadas"
    );
    const expectedRoleLabels: Record<ScheduleMemberRole, string> = {
      MINISTER: "Ministro",
      LEADER: "Líder",
      VOCAL: "Vocal",
      BACKING: "Backing",
      INSTRUMENT: "Instrumento",
      MEDIA: "Mídia",
      RECEPTION: "Recepção",
      CHILDREN: "Infantil",
      SUPPORT: "Apoio",
      OTHER: "Outro"
    };
    check(
      Object.entries(expectedRoleLabels).every(
        ([role, label]) => getScheduleMemberRolePresentation(role).label === label
      ),
      "todas as funcoes possuem labels amigaveis com ortografia correta"
    );
    check(
      Object.values(ScheduleMemberRole).every(
        (role) => getScheduleMemberRolePresentation(role).label !== role
      ),
      "nenhuma funcao conhecida expoe o enum tecnico"
    );
    check(
      getScheduleMemberRolePresentation("UNKNOWN_ROLE").label === "Função não informada",
      "funcao desconhecida utiliza fallback seguro"
    );

    published = [];
    await scheduleNotificationService.publishInitial(
      schedule(),
      "creator-1",
      {} as never,
      new Date("2026-07-29T12:00:00.000Z")
    );
    check(published.length === 2, "primeira publicacao cria inclusao e lembrete futuro");
    check(published[0].type === NotificationType.SCHEDULE_PUBLISHED, "inclusao usa tipo geral de escalas");
    check(published[1].type === NotificationType.SCHEDULE_REMINDER, "lembrete usa tipo especifico");
    check(published[0].entityType === "SCHEDULE", "entidade canonica e utilizada");
    check(!published[0].actionUrl, "actionUrl manual nao e construido");
    check(published[0].message.includes("Louvor"), "mensagem inclui o ministerio da escala");
    check(published[0].message.includes("Funcao: Instrumento."), "publicacao usa funcao amigavel");
    check(!published[0].message.includes("INSTRUMENT"), "publicacao nao expoe enum tecnico da funcao");
    check(
      published[0].deduplicationKey === "schedule:published:v1:schedule-1:user-1",
      "publicacao possui chave deterministica"
    );
    check(
      published[1].scheduledFor?.toISOString() === "2026-08-01T22:00:00.000Z",
      "lembrete respeita antecedencia de 24 horas"
    );
    check(!published[1].message.includes("INSTRUMENT"), "lembrete nao expoe enum tecnico da funcao");

    published = [];
    await scheduleNotificationService.publishInitial(
      schedule({ date: new Date("2026-07-29T00:00:00.000Z"), startTime: "20:00" }),
      "creator-1",
      {} as never,
      new Date("2026-07-29T12:00:00.000Z")
    );
    check(published.length === 1, "publicacao dentro da janela nao duplica com lembrete imediato");

    published = [];
    await scheduleNotificationService.participantAdded(
      schedule({ notificationVersion: 2 }),
      primary,
      "creator-1",
      {} as never,
      new Date("2026-07-29T12:00:00.000Z")
    );
    check(published[0].title === "Voce foi escalado", "inclusao posterior notifica somente o novo participante");
    check(published[0].message.includes("Funcao: Instrumento."), "inclusao e substituicao usam funcao amigavel");
    check(
      published[0].deduplicationKey?.includes("participant-added:v2"),
      "inclusao posterior usa versao da operacao"
    );

    published = [];
    cancelledUsers = undefined;
    await scheduleNotificationService.participantRemoved(
      schedule({ notificationVersion: 3 }),
      primary,
      "creator-1",
      {} as never
    );
    check(cancelledUsers?.[0] === "user-1", "remocao cancela lembrete do participante");
    check(published.length === 1, "remocao cria uma notificacao");
    check(published[0].title === "Voce foi removido da escala", "remocao possui mensagem especifica");
    check(
      published[0].deduplicationKey?.includes("participant-removed:v3"),
      "remocao usa versao deterministica"
    );

    published = [];
    await scheduleNotificationService.updated(
      schedule({ notificationVersion: 4 }),
      ["date", "startTime", "location"],
      "creator-1",
      {} as never
    );
    check(published.length === 1, "alteracao em lote gera uma notificacao por usuario");
    check(published[0].message.includes("a data"), "resumo inclui os campos alterados");
    check(!published[0].message.includes("INSTRUMENT"), "alteracao nao expoe enum tecnico da funcao");
    check(
      published[0].deduplicationKey === "schedule:updated:v4:schedule-1:user-1",
      "alteracao usa versao semantica"
    );

    published = [];
    await scheduleNotificationService.updated(
      schedule(),
      [],
      "creator-1",
      {} as never
    );
    check(published.length === 0, "salvar sem diferenca nao gera notificacao");

    published = [];
    cancelledUsers = ["sentinel"];
    await scheduleNotificationService.cancelled(
      schedule({ notificationVersion: 5 }),
      "creator-1",
      {} as never
    );
    check(cancelledUsers === undefined, "cancelamento invalida todos os lembretes da escala");
    check(published[0].title === "Escala cancelada", "cancelamento notifica participantes");
    check(
      published[0].deduplicationKey === "schedule:cancelled:v5:schedule-1:user-1",
      "cancelamento e idempotente por versao"
    );

    const scheduleServiceSource = readFileSync("src/services/schedule.service.ts", "utf8");
    const validatorSource = readFileSync("src/validators/schedule.validator.ts", "utf8");
    check(
      scheduleServiceSource.includes("transactionalSchedule.status === ScheduleStatus.PUBLISHED"),
      "integracao de participantes exige escala publicada"
    );
    check(
      scheduleServiceSource.includes("current.status === ScheduleStatus.PUBLISHED && current.publishedAt"),
      "repetir publicacao retorna sem nova transicao"
    );
    check(
      validatorSource.includes("z.literal(ScheduleStatus.DRAFT)"),
      "criacao aceita somente rascunho"
    );
    check(
      validatorSource.includes(
        "scheduleUpdateSchema = scheduleBaseSchema.partial().superRefine"
      ),
      "update parcial nao aceita status"
    );
    check(
      scheduleServiceSource.includes("scheduleNotificationService.cancelled"),
      "exclusao e cancelamento publicados tratam notificacoes"
    );
    check(
      scheduleServiceSource.includes("rescheduleReminders"),
      "mudanca de data ou horario recalcula lembretes"
    );

    replace(
      "notification:transaction",
      notificationRepo,
      "transaction",
      ((callback: (database: unknown) => Promise<unknown>) => callback({})) as never
    );
    replace(
      "notification:tryAcquireScheduleReminderProcessingLock",
      notificationRepo,
      "tryAcquireScheduleReminderProcessingLock",
      (() => Promise.resolve(true)) as never
    );
    replace(
      "notification:listDue",
      notificationRepo,
      "listDueScheduled",
      (() =>
        Promise.resolve([
          {
            id: "notification-1",
            userId: "user-1",
            entityType: "SCHEDULE",
            entityId: "schedule-1",
            expiresAt: null,
            deduplicationKey: "schedule:reminder:v1:schedule-1:participant-1:202608021900"
          },
          {
            id: "notification-2",
            userId: "user-2",
            entityType: "SCHEDULE",
            entityId: "schedule-2",
            expiresAt: null,
            deduplicationKey: "schedule:reminder:v1:schedule-2:participant-2:202608021900"
          }
        ])) as never
    );
    let eligibilityQueries = 0;
    replace(
      "schedule:eligible",
      scheduleRepo,
      "listPublishedScheduleRecipientLinks",
      (() => {
        eligibilityQueries += 1;
        return Promise.resolve([
          {
            id: "schedule-1",
            notificationVersion: 1,
            members: [
              {
                status: ScheduleMemberStatus.PENDING,
                member: { user: { id: "user-1" } },
                replacedByMember: null
              }
            ]
          }
        ]);
      }) as never
    );
    replace(
      "notification:markSent",
      notificationRepo,
      "markSent",
      ((ids: string[]) => Promise.resolve({ count: ids.length })) as never
    );
    replace(
      "notification:cancelScheduled",
      notificationRepo,
      "cancelScheduled",
      ((ids: string[]) => Promise.resolve({ count: ids.length })) as never
    );
    const processing = await scheduleNotificationService.processPendingReminders(
      new Date("2026-08-01T22:00:00.000Z")
    );
    check(processing.found === 2, "processador encontra lembretes vencidos");
    check(processing.sent === 1, "processador envia apenas participacao ainda elegivel");
    check(processing.cancelled === 1, "processador cancela participacao inelegivel");
    check(processing.skipped === 0, "processamento conclui lote sem perda");
    check(eligibilityQueries === 1, "elegibilidade do lote usa uma unica consulta");

    const authorization = {
      user: { id: "creator-1" },
      accessContext: {
        scope: ScheduleScope.ALL,
        memberId: null,
        authorizedMinistryIds: null
      }
    } as ScheduleAuthorization;
    let lifecycleSchedule = schedule({
      status: ScheduleStatus.DRAFT,
      publishedAt: null,
      notificationVersion: 0,
      members: []
    });
    let transactionTail = Promise.resolve();
    let initialPublicationCalls = 0;
    let updateNotificationCalls = 0;
    let reminderRefreshCalls = 0;
    let latestReminderVersion: number | null = null;
    let participantAddedCalls = 0;
    let participantRemovedCalls = 0;
    let cancellationCalls = 0;
    let pendingReminderCancellationCalls = 0;
    let failNotificationWrites = false;
    let lifecycleNotificationSequence = 0;
    let deleted = false;
    const lifecycleMembers = new Map<string, ScheduleMemberRecord>();
    const actualRescheduleReminders = scheduleNotificationService.rescheduleReminders;

    replace(
      "lifecycle:transaction",
      scheduleRepo,
      "transaction",
      ((callback: (database: unknown) => Promise<unknown>) => {
        const result = transactionTail.then(async () => {
          const previousSchedule = lifecycleSchedule;
          const previousDeleted = deleted;
          const previousMembers = new Map(lifecycleMembers);
          try {
            return await callback({});
          } catch (error) {
            lifecycleSchedule = previousSchedule;
            deleted = previousDeleted;
            lifecycleMembers.clear();
            for (const [id, participant] of previousMembers) {
              lifecycleMembers.set(id, participant);
            }
            throw error;
          }
        });
        transactionTail = result.then(
          () => undefined,
          () => undefined
        );
        return result;
      }) as never
    );
    replace(
      "lifecycle:lockByIdWithinScope",
      scheduleRepo,
      "lockByIdWithinScope",
      (() => Promise.resolve(deleted ? null : lifecycleSchedule)) as never
    );
    replace(
      "lifecycle:findByIdWithinScope",
      scheduleRepo,
      "findByIdWithinScope",
      (() => Promise.resolve(deleted ? null : lifecycleSchedule)) as never
    );
    replace(
      "lifecycle:transitionStatusWithinScope",
      scheduleRepo,
      "transitionStatusWithinScope",
      ((
        _id: string,
        fromStatuses: ScheduleStatus[],
        status: ScheduleStatus,
        _userId: string,
        _context: unknown,
        _database: unknown,
        options: { publishedAt?: Date; incrementNotificationVersion?: boolean } = {}
      ) => {
        if (!fromStatuses.includes(lifecycleSchedule.status)) return Promise.resolve(null);
        lifecycleSchedule = {
          ...lifecycleSchedule,
          status,
          publishedAt: options.publishedAt ?? lifecycleSchedule.publishedAt,
          notificationVersion:
            lifecycleSchedule.notificationVersion +
            (options.incrementNotificationVersion ? 1 : 0)
        };
        return Promise.resolve(lifecycleSchedule);
      }) as never
    );
    replace(
      "lifecycle:incrementNotificationVersion",
      scheduleRepo,
      "incrementNotificationVersion",
      (() => {
        lifecycleSchedule = {
          ...lifecycleSchedule,
          notificationVersion: lifecycleSchedule.notificationVersion + 1
        };
        return Promise.resolve({
          notificationVersion: lifecycleSchedule.notificationVersion
        });
      }) as never
    );
    replace(
      "lifecycle:updateWithinScope",
      scheduleRepo,
      "updateWithinScope",
      ((_id: string, data: Record<string, unknown>) => {
        const nextEvent =
          data.eventId === undefined
            ? lifecycleSchedule.event
            : data.eventId === null
              ? null
              : {
                  id: String(data.eventId),
                  title: "Evento atualizado",
                  startDate: new Date("2026-08-02T00:00:00.000Z"),
                  ministryId: lifecycleSchedule.ministry.id
                };
        lifecycleSchedule = {
          ...lifecycleSchedule,
          ...(data.title !== undefined ? { title: String(data.title) } : {}),
          ...(data.date !== undefined
            ? { date: new Date(`${String(data.date)}T00:00:00.000Z`) }
            : {}),
          ...(data.location !== undefined
            ? { location: data.location ? String(data.location) : null }
            : {}),
          event: nextEvent
        };
        return Promise.resolve(lifecycleSchedule);
      }) as never
    );
    replace(
      "lifecycle:findEventById",
      scheduleRepo,
      "findEventById",
      ((id: string) =>
        Promise.resolve({
          id,
          title: "Evento atualizado",
          ministryId: lifecycleSchedule.ministry.id
        })) as never
    );
    replace(
      "lifecycle:findAnyMemberTimeConflict",
      scheduleRepo,
      "findAnyMemberTimeConflict",
      (() => Promise.resolve(null)) as never
    );
    replace(
      "lifecycle:publishInitial",
      scheduleNotifications,
      "publishInitial",
      (() => {
        if (failNotificationWrites) {
          return Promise.reject(new Error("notification write failed"));
        }
        initialPublicationCalls += 1;
        return Promise.resolve({ requested: 1, eligible: 1, created: 1, skipped: 0, notificationIds: [`lifecycle-${++lifecycleNotificationSequence}`] });
      }) as never
    );
    replace(
      "lifecycle:updated",
      scheduleNotifications,
      "updated",
      (() => {
        updateNotificationCalls += 1;
        return Promise.resolve({ requested: 1, eligible: 1, created: 1, skipped: 0, notificationIds: [`lifecycle-${++lifecycleNotificationSequence}`] });
      }) as never
    );
    replace(
      "lifecycle:rescheduleReminders",
      scheduleNotifications,
      "rescheduleReminders",
      ((current: ScheduleRecord) => {
        reminderRefreshCalls += 1;
        latestReminderVersion = current.notificationVersion;
        return Promise.resolve({ requested: 1, eligible: 1, created: 1, skipped: 0, notificationIds: [] });
      }) as never
    );
    replace(
      "lifecycle:cancelPendingReminders",
      scheduleNotifications,
      "cancelPendingReminders",
      (() => {
        pendingReminderCancellationCalls += 1;
        return Promise.resolve({ cancelled: 1 });
      }) as never
    );
    replace(
      "lifecycle:participantAdded",
      scheduleNotifications,
      "participantAdded",
      (() => {
        participantAddedCalls += 1;
        return Promise.resolve({ requested: 1, eligible: 1, created: 1, skipped: 0, notificationIds: [`lifecycle-${++lifecycleNotificationSequence}`] });
      }) as never
    );
    replace(
      "lifecycle:participantRemoved",
      scheduleNotifications,
      "participantRemoved",
      (() => {
        participantRemovedCalls += 1;
        return Promise.resolve({ requested: 1, eligible: 1, created: 1, skipped: 0, notificationIds: [`lifecycle-${++lifecycleNotificationSequence}`] });
      }) as never
    );
    replace(
      "lifecycle:cancelled",
      scheduleNotifications,
      "cancelled",
      (() => {
        cancellationCalls += 1;
        return Promise.resolve({ requested: 1, eligible: 1, created: 1, skipped: 0, notificationIds: [`lifecycle-${++lifecycleNotificationSequence}`] });
      }) as never
    );

    failNotificationWrites = true;
    const deliveriesBeforeFailedPublication = deliveredPushBatches.length;
    const failedPublication = await captureError(() =>
      scheduleService.publish("schedule-1", authorization)
    );
    failNotificationWrites = false;
    check(
      failedPublication instanceof Error &&
        failedPublication.message === "notification write failed",
      "falha de notificacao e propagada pela publicacao"
    );
    check(
      lifecycleSchedule.status === ScheduleStatus.DRAFT &&
        lifecycleSchedule.notificationVersion === 0,
      "falha de notificacao reverte status e versao na mesma transacao"
    );
    check(
      deliveredPushBatches.length === deliveriesBeforeFailedPublication,
      "rollback nao dispara Web Push"
    );

    const concurrentPublication = await Promise.all([
      scheduleService.publish("schedule-1", authorization),
      scheduleService.publish("schedule-1", authorization)
    ]);
    check(
      concurrentPublication.every((item) => item.status === ScheduleStatus.PUBLISHED),
      "duas publicacoes simultaneas convergem para PUBLISHED"
    );
    check(initialPublicationCalls === 1, "publicacao concorrente cria notificacoes uma unica vez");
    check(lifecycleSchedule.notificationVersion === 1, "publicacao concorrente incrementa a versao uma unica vez");
    check(
      deliveredPushBatches.length === deliveriesBeforeFailedPublication + 1 &&
        deliveredPushBatches.at(-1)?.length === 1,
      "commit concorrente dispara um unico lote logico de Web Push"
    );

    await scheduleService.publish("schedule-1", authorization);
    check(initialPublicationCalls === 1, "publicar novamente permanece idempotente");
    check(lifecycleSchedule.notificationVersion === 1, "republicacao nao altera notificationVersion");
    check(
      deliveredPushBatches.length === deliveriesBeforeFailedPublication + 1,
      "republicacao idempotente nao duplica Web Push"
    );

    await scheduleService.update(
      "schedule-1",
      { title: lifecycleSchedule.title },
      authorization
    );
    check(updateNotificationCalls === 0, "salvar os mesmos dados nao notifica");
    check(lifecycleSchedule.notificationVersion === 1, "no-op nao incrementa notificationVersion");

    await scheduleService.update(
      "schedule-1",
      { eventId: "event-2" },
      authorization
    );
    check(lifecycleSchedule.event?.id === "event-2", "alteracao administrativa de evento e persistida");
    check(updateNotificationCalls === 0, "alteracao somente de evento nao notifica participantes");
    check(lifecycleSchedule.notificationVersion === 1, "campo nao notificavel nao altera a versao");

    await scheduleService.update(
      "schedule-1",
      { title: "Culto de celebracao" },
      authorization
    );
    await scheduleService.update(
      "schedule-1",
      { location: "Auditorio" },
      authorization
    );
    await scheduleService.update(
      "schedule-1",
      { date: "2026-08-09" },
      authorization
    );
    check(updateNotificationCalls === 3, "alteracoes relevantes consecutivas geram uma notificacao por versao");
    check(reminderRefreshCalls === 3, "cada alteracao relevante recalcula lembretes");
    check(lifecycleSchedule.notificationVersion === 4, "alteracoes relevantes incrementam a versao");
    check(latestReminderVersion === 4, "somente a versao mais recente permanece como referencia do lembrete");

    replace(
      "lifecycle:findMemberById",
      scheduleRepo,
      "findMemberById",
      ((id: string) => Promise.resolve({ id, name: id, status: "ACTIVE" })) as never
    );
    replace(
      "lifecycle:findActiveScheduleMember",
      scheduleRepo,
      "findActiveScheduleMember",
      ((_scheduleId: string, memberId: string, ignoreId?: string) =>
        Promise.resolve(
          [...lifecycleMembers.values()].find(
            (item) => item.member.id === memberId && item.id !== ignoreId
          ) ?? null
        )) as never
    );
    replace(
      "lifecycle:findScheduleMemberTimeConflict",
      scheduleRepo,
      "findScheduleMemberTimeConflict",
      (() => Promise.resolve(null)) as never
    );
    replace(
      "lifecycle:findActiveMemberMinistry",
      scheduleRepo,
      "findActiveMemberMinistry",
      (() => Promise.resolve({ id: "link-1" })) as never
    );
    replace(
      "lifecycle:addMember",
      scheduleRepo,
      "addMember",
      ((_scheduleId: string, data: { memberId: string }) => {
        const created = member(`participant-${data.memberId}`, `user-${data.memberId}`, {
          member: {
            id: data.memberId,
            name: data.memberId,
            nickname: null,
            status: "ACTIVE",
            user: { id: `user-${data.memberId}` }
          }
        });
        lifecycleMembers.set(created.id, created);
        lifecycleSchedule = {
          ...lifecycleSchedule,
          members: [...lifecycleMembers.values()]
        };
        return Promise.resolve(created);
      }) as never
    );
    replace(
      "lifecycle:findScheduleMemberById",
      scheduleRepo,
      "findScheduleMemberById",
      ((id: string) => Promise.resolve(lifecycleMembers.get(id) ?? null)) as never
    );
    replace(
      "lifecycle:lockScheduleMemberById",
      scheduleRepo,
      "lockScheduleMemberById",
      ((id: string) => Promise.resolve(lifecycleMembers.get(id) ?? null)) as never
    );
    replace(
      "lifecycle:updateMember",
      scheduleRepo,
      "updateMember",
      ((id: string, data: { status?: ScheduleMemberStatus; replacedByMemberId?: string }) => {
        const current = lifecycleMembers.get(id);
        assert(current);
        const updated = {
          ...current,
          status: data.status ?? current.status,
          replacedByMember: data.replacedByMemberId
            ? {
                id: data.replacedByMemberId,
                name: data.replacedByMemberId,
                nickname: null,
                status: "ACTIVE",
                user: { id: `user-${data.replacedByMemberId}` }
              }
            : current.replacedByMember
        } as ScheduleMemberRecord;
        lifecycleMembers.set(id, updated);
        lifecycleSchedule = {
          ...lifecycleSchedule,
          members: [...lifecycleMembers.values()]
        };
        return Promise.resolve(updated);
      }) as never
    );
    replace(
      "lifecycle:softDeleteMember",
      scheduleRepo,
      "softDeleteMember",
      ((id: string) => {
        lifecycleMembers.delete(id);
        lifecycleSchedule = {
          ...lifecycleSchedule,
          members: [...lifecycleMembers.values()]
        };
        return Promise.resolve({ id, deletedAt: new Date() });
      }) as never
    );

    const createMemberInput = {
      memberId: "member-a",
      roles: [ScheduleMemberRole.VOCAL],
      status: ScheduleMemberStatus.PENDING,
      allowMinistryException: false
    };
    const firstParticipant = await scheduleService.addMember(
      "schedule-1",
      createMemberInput,
      authorization
    );
    check(participantAddedCalls === 1, "adicionar participante em escala publicada notifica o novo membro");
    await scheduleService.removeMember(
      "schedule-1",
      firstParticipant.id,
      authorization
    );
    check(participantRemovedCalls === 1, "remover participante cancela seu lembrete e notifica");
    await scheduleService.addMember("schedule-1", createMemberInput, authorization);
    check(participantAddedCalls === 2, "participante removido pode ser adicionado novamente com nova versao");

    const activeParticipant = [...lifecycleMembers.values()][0];
    await scheduleService.updateMember(
      "schedule-1",
      activeParticipant.id,
      {
        status: ScheduleMemberStatus.REPLACED,
        replacedByMemberId: "member-b",
        allowMinistryException: false
      },
      authorization
    );
    check(participantRemovedCalls === 2, "substituicao notifica a retirada do participante anterior");
    check(participantAddedCalls === 3, "substituicao notifica apenas o novo participante");

    lifecycleSchedule = {
      ...lifecycleSchedule,
      status: ScheduleStatus.PUBLISHED,
      publishedAt: lifecycleSchedule.publishedAt ?? new Date()
    };
    await scheduleService.cancel("schedule-1", authorization);
    check(lifecycleSchedule.status === ScheduleStatus.CANCELED, "cancelamento conclui a transicao");
    check(cancellationCalls === 1, "cancelamento publicado invalida lembretes e notifica uma vez");

    lifecycleSchedule = {
      ...lifecycleSchedule,
      status: ScheduleStatus.PUBLISHED,
      publishedAt: lifecycleSchedule.publishedAt ?? new Date()
    };
    const updatesBeforeComplete = updateNotificationCalls;
    await scheduleService.complete("schedule-1", authorization);
    check(lifecycleSchedule.status === ScheduleStatus.COMPLETED, "conclusao preserva o ciclo de status");
    check(updateNotificationCalls === updatesBeforeComplete, "conclusao publicada nao gera notificacao de alteracao");
    check(pendingReminderCancellationCalls === 1, "conclusao cancela somente lembretes pendentes");
    const versionAfterComplete = lifecycleSchedule.notificationVersion;
    const notificationsAfterComplete = participantAddedCalls;
    await scheduleService.update("schedule-1", { observations: "Registro posterior" }, authorization);
    const participantAfterComplete = await scheduleService.addMember(
      "schedule-1",
      { ...createMemberInput, memberId: "member-after-complete" },
      authorization
    );
    await scheduleService.updateMember(
      "schedule-1",
      participantAfterComplete.id,
      { observations: "Observacao posterior" },
      authorization
    );
    await scheduleService.complete("schedule-1", authorization);
    check(
      lifecycleSchedule.status === ScheduleStatus.COMPLETED,
      "salvar escala e participante depois da conclusao nao reabre o status"
    );
    check(
      lifecycleSchedule.notificationVersion === versionAfterComplete &&
        participantAddedCalls === notificationsAfterComplete &&
        pendingReminderCancellationCalls === 1,
      "operacoes posteriores a conclusao nao recriam notificacoes ou lembretes"
    );

    lifecycleSchedule = {
      ...lifecycleSchedule,
      status: ScheduleStatus.PUBLISHED,
      publishedAt: lifecycleSchedule.publishedAt ?? new Date()
    };
    replace(
      "lifecycle:softDeleteWithinScope",
      scheduleRepo,
      "softDeleteWithinScope",
      (() => {
        deleted = true;
        return Promise.resolve({ id: "schedule-1", deletedAt: new Date() });
      }) as never
    );
    await scheduleService.remove("schedule-1", authorization);
    check(deleted, "exclusao utiliza soft delete");
    check(cancellationCalls === 2, "soft delete de escala publicada invalida lembretes e notifica");
    check(
      !("restore" in scheduleService),
      "nao existe fluxo de restauracao para escalas nesta Story"
    );

    published = [];
    cancelledUsers = ["sentinel"];
    await actualRescheduleReminders(
      schedule({
        date: new Date("2026-07-29T00:00:00.000Z"),
        startTime: "20:00",
        notificationVersion: 99
      }),
      "creator-1",
      {} as never,
      new Date("2026-07-29T12:00:00.000Z")
    );
    check(cancelledUsers === undefined, "alteracao dentro da janela cancela lembrete antigo");
    check(published.length === 0, "alteracao dentro da janela nao cria lembrete atrasado");

    const migration = readFileSync(
      "prisma/migrations/20260729120000_add_schedule_notification_state/migration.sql",
      "utf8"
    );
    check(migration.includes('ADD COLUMN "publishedAt"'), "migration adiciona publishedAt");
    check(migration.includes('"notificationVersion" INTEGER NOT NULL DEFAULT 0'), "migration adiciona versao segura");
    check(migration.includes("COALESCE"), "migration preserva estado publicado existente");
    check(!migration.includes("DROP "), "migration e exclusivamente aditiva");
    const repositorySource = readFileSync("src/repositories/schedule.repository.ts", "utf8");
    check(repositorySource.includes("FOR UPDATE"), "mutacoes concorrentes usam lock pessimista por escala");
    check(
      repositorySource.includes("status: { in: fromStatuses }"),
      "transicoes mantem atualizacao condicional pelo status de origem"
    );
    check(
      readFileSync("src/repositories/notification.repository.ts", "utf8").includes(
        "skipDuplicates: true"
      ),
      "notificacoes utilizam gravacao em lote com deduplicacao"
    );

    console.log(`Schedule notifications: ${scenarios} scenarios passed.`);
  } finally {
    for (const [key, { target, value }] of originals) {
      const method = key.split(":").at(-1);
      if (method) target[method] = value;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
