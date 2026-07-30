import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NotificationType } from "@prisma/client";
import { AppError } from "../src/lib/errors";
import {
  isNotificationEntityType,
  NOTIFICATION_CATALOG,
  NOTIFICATION_ENTITY_CATALOG,
  NOTIFICATION_ENTITY_TYPES,
  resolveEntityDestination,
  resolveNotificationDestination
} from "../src/lib/notification-catalog";
import {
  buildNotificationCreateData,
  buildNotificationListWhere,
  notificationRepository
} from "../src/repositories/notification.repository";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  notificationService,
  resolveEffectiveNotificationPreference
} from "../src/services/notification.service";
import {
  isSafeInternalNotificationUrl,
  notificationBulkCreateSchema,
  notificationCreateSchema,
  notificationListQuerySchema,
  notificationPreferencesUpdateSchema
} from "../src/validators/notification.validator";

type RepositoryMethod = (...args: never[]) => unknown;

const userId = "cm00000000000000000000001";
const userId2 = "cm00000000000000000000002";
const notificationId = "cm00000000000000000000003";
const now = new Date("2026-07-27T12:00:00.000Z");

function notificationRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: notificationId,
    userId,
    createdById: null,
    type: NotificationType.NOTICE_CREATED,
    title: "Novo comunicado",
    message: "Uma nova atualizacao esta disponivel.",
    entityType: "NOTICE",
    entityId: "announcement-1",
    actionUrl: null,
    scheduledFor: null,
    expiresAt: null,
    sentAt: now,
    readAt: null,
    createdAt: now,
    updatedAt: now,
    hiddenAt: null,
    cancelledAt: null,
    ...overrides
  };
}

async function captureError(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    return error;
  }
  assert.fail("A operacao deveria ter falhado.");
}

async function main() {
  let scenarios = 0;
  const check = (condition: unknown, message: string) => {
    assert(condition, message);
    scenarios += 1;
  };

  const defaults = notificationListQuerySchema.parse({});
  check(
    defaults.page === 1 && defaults.pageSize === 10 && defaults.status === "all",
    "1: listagem possui filtros e paginacao seguros"
  );
  check(
    !notificationListQuerySchema.safeParse({ pageSize: 51 }).success,
    "2: listagem limita o volume por pagina"
  );
  check(
    isSafeInternalNotificationUrl("/portal/avisos?origem=notificacao") &&
      !isSafeInternalNotificationUrl("https://example.com") &&
      !isSafeInternalNotificationUrl("//example.com") &&
      !isSafeInternalNotificationUrl("/\\example.com"),
    "3: somente destinos internos seguros sao aceitos"
  );

  check(
    Object.values(NotificationType).every((type) => {
      const entry = NOTIFICATION_CATALOG[type];
      return Boolean(
        entry.label &&
          entry.icon &&
          entry.entityRoute &&
          entry.defaultPreference &&
          isNotificationEntityType(entry.entityType)
      );
    }),
    "4: catalogo central cobre todos os tipos e metadados obrigatorios"
  );
  check(
    NOTIFICATION_CATALOG.SCHEDULE_REMINDER.supportsReminder &&
      !NOTIFICATION_CATALOG.EVENT_CREATED.supportsReminder,
    "5: capacidade de lembrete pertence ao catalogo"
  );
  check(
    Object.keys(NOTIFICATION_ENTITY_CATALOG).length ===
      Object.keys(NOTIFICATION_ENTITY_TYPES).length &&
      !isNotificationEntityType("Announcement"),
    "6: entityType usa contrato fechado e compartilhado"
  );
  check(
    resolveEntityDestination(NOTIFICATION_ENTITY_TYPES.SCHEDULE, "schedule/1") ===
      "/portal/minhas-escalas?schedule=schedule%2F1" &&
      resolveNotificationDestination({
        entityType: NOTIFICATION_ENTITY_TYPES.NOTICE,
        entityId: "notice-80",
        actionUrl: "/rota-antiga"
      }) === "/portal/avisos?notification=notice-80",
    "7: resolvedor central deriva e codifica rotas canonicas"
  );
  check(
    resolveNotificationDestination({ actionUrl: "/portal/avisos" }) === "/portal/avisos" &&
      resolveNotificationDestination({
        entityType: "UNKNOWN",
        entityId: "1",
        actionUrl: "/portal/avisos?legacy=1"
      }) === "/portal/avisos?legacy=1",
    "8: actionUrl e fallback seguro para referencia ausente ou legada"
  );

  const parsedOverride = notificationCreateSchema.parse({
    userId,
    type: NotificationType.NOTICE_CREATED,
    title: "Aviso",
    message: "Mensagem",
    actionUrl: "/portal/avisos"
  });
  check(parsedOverride.actionUrl === "/portal/avisos", "9: override sem entidade e aceito");

  const expiresAt = new Date("2026-07-28T13:00:00.000Z");
  const scheduledFor = new Date("2026-07-28T12:00:00.000Z");
  const parsedEntity = notificationCreateSchema.parse({
    userId,
    createdById: userId2,
    type: NotificationType.SCHEDULE_REMINDER,
    title: "Lembrete",
    message: "Escala em breve.",
    entityType: NOTIFICATION_ENTITY_TYPES.SCHEDULE,
    entityId: "schedule-1",
    scheduledFor,
    expiresAt,
    deduplicationKey: "schedule:reminder:v1:schedule-1:user-1"
  });
  check(
    parsedEntity.createdById === userId2 && parsedEntity.expiresAt?.getTime() === expiresAt.getTime(),
    "10: validade e rastreabilidade fazem parte do contrato de criacao"
  );
  check(
    !notificationCreateSchema.safeParse({
      ...parsedEntity,
      entityType: "Announcement"
    }).success &&
      !notificationCreateSchema.safeParse({ ...parsedEntity, entityId: undefined }).success &&
      !notificationCreateSchema.safeParse({
        ...parsedEntity,
        entityType: NOTIFICATION_ENTITY_TYPES.EVENT
      }).success,
    "11: texto livre, referencia incompleta e entidade incompativel sao rejeitados"
  );
  check(
    !notificationCreateSchema.safeParse({ ...parsedEntity, actionUrl: "/escalas/1" }).success,
    "12: integracoes nao podem construir actionUrl quando existe entidade"
  );
  check(
    !notificationCreateSchema.safeParse({ ...parsedEntity, expiresAt: scheduledFor }).success,
    "13: expiresAt deve ser posterior a scheduledFor"
  );
  check(
    !notificationCreateSchema.safeParse({
      ...parsedOverride,
      deduplicationKey: "notice:1"
    }).success &&
      notificationCreateSchema.safeParse({
        ...parsedOverride,
        deduplicationKey: "notice:v1:1:user-1"
      }).success,
    "14: deduplicationKey exige namespace, versao e identificadores"
  );

  const duplicatePreferences = notificationPreferencesUpdateSchema.safeParse({
    preferences: [
      { type: NotificationType.BIRTHDAY, inAppEnabled: true },
      { type: NotificationType.BIRTHDAY, inAppEnabled: false }
    ]
  });
  const invalidReminder = notificationPreferencesUpdateSchema.safeParse({
    preferences: [
      {
        type: NotificationType.EVENT_CREATED,
        inAppEnabled: true,
        reminderHoursBefore: 24
      }
    ]
  });
  check(
    !duplicatePreferences.success && !invalidReminder.success,
    "15: preferencias duplicadas e lembretes incompativeis sao rejeitados"
  );
  check(
    Object.values(DEFAULT_NOTIFICATION_PREFERENCES).every((item) => item.inAppEnabled) &&
      resolveEffectiveNotificationPreference(NotificationType.SCHEDULE_REMINDER)
        .reminderHoursBefore === 24,
    "16: defaults sao derivados do catalogo central"
  );

  const listWhere = buildNotificationListWhere(userId, {
    page: 1,
    pageSize: 10,
    status: "unread",
    type: NotificationType.EVENT_CREATED
  });
  const serializedWhere = JSON.stringify(listWhere);
  check(
    serializedWhere.includes(`"userId":"${userId}"`) &&
      serializedWhere.includes('"hiddenAt":null') &&
      serializedWhere.includes('"cancelledAt":null') &&
      serializedWhere.includes('"sentAt":{"not":null}') &&
      serializedWhere.includes('"readAt":null') &&
      serializedWhere.includes('"deletedAt":null'),
    "17: listagem combina contrato legado e novos estados"
  );

  const immediate = buildNotificationCreateData(parsedOverride, now);
  const scheduled = buildNotificationCreateData(parsedEntity, now);
  check(
    immediate.sentAt instanceof Date && immediate.scheduledFor === null,
    "18: notificacao imediata nasce enviada"
  );
  check(
    scheduled.sentAt === null &&
      scheduled.scheduledFor instanceof Date && scheduled.scheduledFor.getTime() === scheduledFor.getTime() &&
      scheduled.expiresAt instanceof Date && scheduled.expiresAt.getTime() === expiresAt.getTime() &&
      scheduled.createdById === userId2 &&
      scheduled.actionUrl === null,
    "19: agendamento persiste validade, ator e referencia canonica"
  );

  const mutableRepository = notificationRepository as unknown as Record<
    string,
    RepositoryMethod
  >;
  const originals = new Map<string, RepositoryMethod>();
  const replace = (name: string, implementation: RepositoryMethod) => {
    if (!originals.has(name)) originals.set(name, mutableRepository[name]);
    mutableRepository[name] = implementation;
  };

  try {
    let createCalls = 0;
    replace("findActiveUsersByIds", () => Promise.resolve([]));
    replace("listPreferences", () => Promise.resolve([]));
    replace("create", () => {
      createCalls += 1;
      return Promise.resolve(notificationRecord());
    });
    const inactive = await notificationService.create(parsedOverride);
    check(
      !inactive.created && inactive.reason === "USER_INACTIVE" && createCalls === 0,
      "20: usuario inativo nao recebe notificacao"
    );

    replace("findActiveUsersByIds", () => Promise.resolve([{ id: userId }]));
    replace("listPreferences", () =>
      Promise.resolve([
        {
          userId,
          type: NotificationType.NOTICE_CREATED,
          inAppEnabled: false,
          reminderHoursBefore: null
        }
      ])
    );
    const disabled = await notificationService.create(parsedOverride);
    check(
      !disabled.created && disabled.reason === "PREFERENCE_DISABLED" && createCalls === 0,
      "21: preferencia desabilitada impede criacao"
    );

    replace("listPreferences", () => Promise.resolve([]));
    const created = await notificationService.create(parsedOverride);
    check(
      created.created && created.notification?.id === notificationId && createCalls === 1,
      "22: usuario ativo recebe pelo default"
    );
    check(
      created.notification?.actionUrl === "/portal/avisos?notification=announcement-1",
      "23: resposta deriva destino da referencia canonica"
    );

    replace("createMany", () => Promise.resolve({ count: 0 }));
    replace("findByDeduplicationKey", () =>
      Promise.resolve(
        notificationRecord({ deduplicationKey: "notice:v1:1:user-1" })
      )
    );
    const duplicate = await notificationService.create({
      ...parsedOverride,
      deduplicationKey: "notice:v1:1:user-1"
    });
    check(
      !duplicate.created && duplicate.reason === "DUPLICATE",
      "24: corrida de deduplicacao e absorvida pelo indice unico"
    );

    let activeQueries = 0;
    let preferenceQueries = 0;
    replace("findActiveUsersByIds", () => {
      activeQueries += 1;
      return Promise.resolve([{ id: userId }, { id: userId2 }]);
    });
    replace("listPreferences", () => {
      preferenceQueries += 1;
      return Promise.resolve([
        {
          userId: userId2,
          type: NotificationType.BIRTHDAY,
          inAppEnabled: false,
          reminderHoursBefore: null
        }
      ]);
    });
    replace("createMany", (inputs: unknown) =>
      Promise.resolve({ count: Array.isArray(inputs) ? inputs.length : 0 })
    );
    const bulk = await notificationService.createMany(
      notificationBulkCreateSchema.parse({
        userIds: [userId, userId2, userId],
        type: NotificationType.BIRTHDAY,
        title: "Aniversario",
        message: "Hoje temos aniversariante."
      })
    );
    check(
      bulk.requested === 2 && bulk.eligible === 1 && bulk.created === 1 &&
        activeQueries === 1 && preferenceQueries === 1,
      "25: lote deduplica destinatarios, respeita preferencia e evita N+1"
    );

    replace("findByIdForUser", () => Promise.resolve(null));
    const foreignRead = await captureError(() =>
      notificationService.markRead(notificationId, userId)
    );
    check(
      foreignRead instanceof AppError &&
        foreignRead.statusCode === 404 &&
        foreignRead.code === "NOTIFICATION_NOT_FOUND",
      "26: notificacao alheia e indistinguivel de inexistente"
    );

    let readUpdates = 0;
    replace("findByIdForUser", () => Promise.resolve(notificationRecord({ readAt: now })));
    replace("updateReadAt", () => {
      readUpdates += 1;
      return Promise.resolve({ count: 1 });
    });
    const alreadyRead = await notificationService.markRead(notificationId, userId);
    check(
      alreadyRead.readAt === now.toISOString() && readUpdates === 0,
      "27: leitura permanece idempotente"
    );

    let hideCalls = 0;
    replace("hide", () => {
      hideCalls += 1;
      return Promise.resolve({ count: 1 });
    });
    const removed = await notificationService.remove(notificationId, userId);
    check(
      removed.deleted && hideCalls === 1,
      "28: DELETE preserva contrato externo e usa hiddenAt internamente"
    );

    replace("listPreferencesForUser", () => Promise.resolve([]));
    const effective = await notificationService.getPreferences(userId);
    check(
      effective.preferences.length === Object.values(NotificationType).length &&
        effective.preferences.every((item) => item.isDefault),
      "29: ausencia de linhas usa defaults sem preenchimento em massa"
    );
  } finally {
    for (const [name, implementation] of originals) mutableRepository[name] = implementation;
  }

  const routes = [
    "src/app/api/notifications/route.ts",
    "src/app/api/notifications/[id]/route.ts",
    "src/app/api/notifications/[id]/read/route.ts",
    "src/app/api/notifications/read-all/route.ts",
    "src/app/api/notification-preferences/route.ts"
  ].map((path) => readFileSync(path, "utf8"));
  check(
    routes.every((source) => source.includes("requireCurrentUser()")) &&
      routes.every((source) => !source.includes("request.json()).userId")) &&
      !routes.some((source) => source.includes("export async function POST")),
    "30: APIs preservam ownership da sessao e nao adicionam envio generico"
  );

  const baseMigration = readFileSync(
    "prisma/migrations/20260727135942_add_internal_notifications/migration.sql",
    "utf8"
  );
  const expandMigration = readFileSync(
    "prisma/migrations/20260728120000_expand_notification_lifecycle/migration.sql",
    "utf8"
  );
  const backfillMigration = readFileSync(
    "prisma/migrations/20260728120100_backfill_notification_lifecycle/migration.sql",
    "utf8"
  );
  const concurrentIndexMigrations = [
    "20260728120200_add_notification_user_hidden_index",
    "20260728120300_add_notification_user_read_hidden_index",
    "20260728120400_add_notification_user_type_hidden_index",
    "20260728120500_add_notification_scheduling_index"
  ].map((name) => readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8"));
  check(
    baseMigration.includes('CREATE UNIQUE INDEX "Notification_userId_deduplicationKey_key"') &&
      expandMigration.includes("BEGIN;") &&
      expandMigration.includes("COMMIT;") &&
      expandMigration.includes("SET LOCAL lock_timeout = '5s'") &&
      expandMigration.includes("NOT VALID") &&
      !expandMigration.includes("DROP COLUMN") &&
      !expandMigration.includes("DROP INDEX"),
    "31: expand e atomico, limitado por timeout e preserva o contrato antigo"
  );
  check(
    backfillMigration.includes('SET "hiddenAt" = "deletedAt"') &&
      backfillMigration.includes('SET "cancelledAt" = "deletedAt"') &&
      backfillMigration.includes('"hiddenAt" IS NULL') &&
      backfillMigration.includes('"cancelledAt" IS NULL') &&
      !backfillMigration.includes('SET "actionUrl"') &&
      !backfillMigration.includes('SET "entityType"') &&
      !backfillMigration.includes("DELETE FROM"),
    "32: backfill e preservador, seletivo e nao sobrescreve dados migrados"
  );
  check(
    concurrentIndexMigrations.every(
      (source) =>
        source.includes("CREATE INDEX CONCURRENTLY") &&
        !source.includes("BEGIN;") &&
        (source.match(/CREATE INDEX CONCURRENTLY/g)?.length ?? 0) === 1
    ),
    "33: cada indice concorrente possui migration nao transacional isolada"
  );
  const schemaSource = readFileSync("prisma/schema.prisma", "utf8");
  check(
    schemaSource.includes("hiddenAt") &&
      schemaSource.includes("cancelledAt") &&
      schemaSource.includes("deletedAt") &&
      schemaSource.includes("actionUrl") &&
      ![expandMigration, backfillMigration, ...concurrentIndexMigrations].some(
        (source) =>
          source.includes('DROP COLUMN "deletedAt"') ||
          source.includes('SET "actionUrl" = NULL')
      ),
    "34: schema expandido e migrations nao removem notificacoes nem destinos"
  );
  const repositorySource = readFileSync(
    "src/repositories/notification.repository.ts",
    "utf8"
  );
  check(
    repositorySource.includes("data: { hiddenAt, deletedAt: hiddenAt }") &&
      repositorySource.includes("data: { cancelledAt, deletedAt: cancelledAt }") &&
      repositorySource.includes("expiresAt: { gt: sentAt }") &&
      repositorySource.includes("deletedAt: null"),
    "35: repositorio faz leitura compativel e dual-write de estados"
  );
  check(
    repositorySource.includes("skip,") &&
      repositorySource.includes("take: filters.pageSize") &&
      repositorySource.includes('orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }]'),
    "36: paginacao e ordenacao continuam no banco"
  );

  const secondOriginals = new Map<string, RepositoryMethod>();
  const replaceAgain = (name: string, implementation: RepositoryMethod) => {
    if (!secondOriginals.has(name)) secondOriginals.set(name, mutableRepository[name]);
    mutableRepository[name] = implementation;
  };
  try {
    replaceAgain("listForUser", () =>
      Promise.resolve({
        notifications: [
          notificationRecord({
            entityType: "LEGACY_NOTICE",
            entityId: "legacy-1",
            actionUrl: "/portal/avisos?legacy=1"
          })
        ],
        total: 1,
        unreadCount: 1
      })
    );
    const legacyList = await notificationService.listForUser(userId, {
      page: 1,
      pageSize: 10,
      status: "all"
    });
    check(
      legacyList.notifications[0]?.actionUrl === "/portal/avisos?legacy=1",
      "37: entityType legado permanece atualizavel e usa actionUrl como fallback"
    );

    replaceAgain("listForUser", () =>
      Promise.resolve({ notifications: [], total: 0, unreadCount: 0 })
    );
    const empty = await notificationService.listForUser(userId, {
      page: 2,
      pageSize: 10,
      status: "all"
    });
    check(
      empty.notifications.length === 0 && empty.pagination.totalPages === 1,
      "38: resposta vazia preserva paginacao"
    );

    let cancelledIds: string[] = [];
    replaceAgain("cancelScheduled", (ids: unknown) => {
      cancelledIds = ids as string[];
      return Promise.resolve({ count: cancelledIds.length });
    });
    const cancelled = await notificationService.cancelScheduled([notificationId, notificationId]);
    check(
      cancelled.updated === 1 && cancelledIds.length === 1,
      "39: cancelamento usa IDs unicos"
    );

    let sentIds: string[] = [];
    replaceAgain("markSent", (ids: unknown) => {
      sentIds = ids as string[];
      return Promise.resolve({ count: sentIds.length });
    });
    const sent = await notificationService.markSent([notificationId, notificationId]);
    check(sent.updated === 1 && sentIds.length === 1, "40: envio permanece idempotente por ID");
  } finally {
    for (const [name, implementation] of secondOriginals) {
      mutableRepository[name] = implementation;
    }
  }

  const bellSource = readFileSync("src/components/notifications/NotificationBell.tsx", "utf8");
  const centerSource = readFileSync(
    "src/components/notifications/NotificationCenter.tsx",
    "utf8"
  );
  check(
    bellSource.includes("Carregando...") &&
      bellSource.includes("Nenhuma notificacao.") &&
      centerSource.includes("Nenhuma notificacao encontrada."),
    "41: UX existente preserva loading e estados vazios"
  );
  check(
    !bellSource.includes("dangerouslySetInnerHTML") &&
      !centerSource.includes("dangerouslySetInnerHTML") &&
      centerSource.includes("NOTIFICATION_CATALOG[notification.type].label"),
    "42: conteudo continua seguro e labels usam o catalogo"
  );

  const documentation = readFileSync("docs/notification-system.md", "utf8");
  const rolloutDocumentation = readFileSync(
    "docs/notification-migration-expand-contract.md",
    "utf8"
  );
  check(
    documentation.includes("## Retencao futura") &&
      documentation.includes("nao substitui uma trilha de") &&
      documentation.includes("schedule:published:v1:123:user456") &&
      documentation.includes("`scheduledFor` indica") &&
      documentation.includes("`expiresAt` indica") &&
      rolloutDocumentation.includes("## Recuperacao apos falha") &&
      rolloutDocumentation.includes("## Futura fase contract") &&
      rolloutDocumentation.includes("indisvalid"),
    "43: retencao, rollout, recuperacao e contract futuro estao documentados"
  );

  console.log(`Notification system: ${scenarios} scenarios passed.`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Notification system tests failed.");
  process.exitCode = 1;
});
