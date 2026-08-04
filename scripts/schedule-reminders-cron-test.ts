import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { NotificationType, Prisma, ScheduleMemberStatus } from "@prisma/client";
import { authorizeCronRequest } from "../src/lib/cron-auth";
import {
  INTERNAL_JOB_LOCK_NAMESPACE,
  notificationRepository,
  SCHEDULE_REMINDERS_CRON_LOCK_KEY
} from "../src/repositories/notification.repository";
import { scheduleRepository } from "../src/repositories/schedule.repository";
import { notificationPublisher } from "../src/services/notification-publisher.service";
import {
  DEFAULT_SCHEDULE_REMINDER_BATCH_SIZE,
  MAX_SCHEDULE_REMINDER_TRANSACTION_ATTEMPTS,
  reminderNotificationVersion,
  scheduleNotificationService,
  ScheduleReminderProcessingError,
  transientScheduleReminderTransactionCode
} from "../src/services/schedule-notification.service";
import { GET } from "../src/app/api/internal/cron/schedule-reminders/route";

type MutableMethods = Record<string, (...args: never[]) => unknown>;
type DueReminder = {
  id: string;
  userId: string;
  entityType: string | null;
  entityId: string | null;
  expiresAt: Date | null;
  deduplicationKey: string | null;
};

const notificationRepo = notificationRepository as unknown as MutableMethods;
const scheduleRepo = scheduleRepository as unknown as MutableMethods;
const publisher = notificationPublisher as unknown as MutableMethods;
const scheduleNotifications = scheduleNotificationService as unknown as MutableMethods;
const originals = new Map<string, { target: MutableMethods; method: string; value: MutableMethods[string] }>();

function replace(
  key: string,
  target: MutableMethods,
  method: string,
  implementation: (...args: never[]) => unknown
) {
  if (!originals.has(key)) {
    originals.set(key, { target, method, value: target[method] });
  }
  target[method] = implementation;
}

function reminder(
  id: string,
  overrides: Partial<DueReminder> = {}
): DueReminder {
  return {
    id,
    userId: `user-${id}`,
    entityType: "SCHEDULE",
    entityId: "schedule-1",
    expiresAt: null,
    deduplicationKey: `schedule:reminder:v1:schedule-1:participant-${id}:202608021900`,
    ...overrides
  };
}

function scheduleLink(
  userIds: string[],
  notificationVersion = 1
) {
  return {
    id: "schedule-1",
    notificationVersion,
    members: userIds.map((userId) => ({
      status: ScheduleMemberStatus.PENDING,
      member: { user: { id: userId } },
      replacedByMember: null
    }))
  };
}

async function responseBody(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

async function main() {
  let scenarios = 0;
  const check = (condition: unknown, message: string) => {
    assert(condition, message);
    scenarios += 1;
    originalInfo(`PASS ${scenarios}: ${message}`);
  };
  const originalSecret = process.env.CRON_SECRET;
  const originalInfo = console.info;
  const originalError = console.error;
  const originalWarn = console.warn;
  const operationalLogs: unknown[][] = [];
  console.info = (...args: unknown[]) => operationalLogs.push(args);
  console.error = (...args: unknown[]) => operationalLogs.push(args);
  console.warn = (...args: unknown[]) => operationalLogs.push(args);

  try {
    const request = (authorization?: string) =>
      new Request("https://example.test/api/internal/cron/schedule-reminders", {
        headers: authorization ? { Authorization: authorization } : undefined
      });

    check(
      authorizeCronRequest(request(), "secret-value").authorized === false,
      "autenticacao rejeita ausencia do header"
    );
    check(
      authorizeCronRequest(request("Basic secret-value"), "secret-value").authorized === false,
      "autenticacao rejeita esquema diferente de Bearer"
    );
    check(
      authorizeCronRequest(request("Bearer "), "secret-value").authorized === false,
      "autenticacao rejeita Bearer vazio"
    );
    check(
      authorizeCronRequest(request("Bearer wrong"), "secret-value").authorized === false,
      "autenticacao rejeita segredo incorreto"
    );
    const missingSecret = authorizeCronRequest(request("Bearer any"), "   ");
    check(
      !missingSecret.authorized && missingSecret.status === 503,
      "autenticacao falha de forma segura sem CRON_SECRET"
    );
    check(
      authorizeCronRequest(request("Bearer secret-value"), " secret-value ").authorized,
      "autenticacao aceita segredo correto com configuracao normalizada"
    );

    let serviceCalls = 0;
    const actualProcessor = scheduleNotifications.processPendingReminders;
    let routeResult = {
      executed: true,
      reason: "processed",
      found: 2,
      sent: 1,
      cancelled: 1,
      skipped: 0,
      lockAcquired: true,
      attempts: 1,
      phaseTimings: {
        lockMs: 0.1,
        selectionMs: 0.2,
        validationMs: 0.3,
        updateMs: 0.4
      },
      timings: {
        lockMs: 0.1,
        selectionMs: 0.2,
        validationMs: 0.3,
        updateMs: 0.4,
        transactionMs: 1,
        totalServiceMs: 1.1
      }
    };
    const checkSuccessEnvelope = (
      body: Record<string, unknown>,
      expectedReason: string,
      label: string
    ) => {
      const data = body.data as Record<string, unknown> | undefined;
      check(
        body.success === true && data !== undefined,
        `${label} possui success apenas no envelope e data presente`
      );
      assert(data);
      check(
        Object.keys(body).length === 2 && Object.keys(body).filter((key) => key === "data").length === 1,
        `${label} possui data uma unica vez sem payload duplicado`
      );
      check(
        [
          "executionId",
          "executed",
          "reason",
          "found",
          "sent",
          "cancelled",
          "skipped",
          "lockAcquired",
          "phaseTimings",
          "attempts",
          "timings"
        ].every((key) => !(key in body)),
        `${label} nao expoe dados operacionais na raiz`
      );
      check(
        typeof data.executionId === "string" &&
          data.reason === expectedReason &&
          typeof data.timings === "object" &&
          typeof data.phaseTimings === "object",
        `${label} preserva o contrato operacional dentro de data`
      );
      return data;
    };
    scheduleNotifications.processPendingReminders = (() => {
      serviceCalls += 1;
      return Promise.resolve(routeResult);
    }) as never;

    process.env.CRON_SECRET = "route-secret";
    for (const authorization of [undefined, "Basic route-secret", "Bearer ", "Bearer wrong"]) {
      const response = await GET(request(authorization));
      check(response.status === 401, `rota retorna 401 para Authorization invalido: ${authorization ?? "ausente"}`);
    }
    check(serviceCalls === 0, "rota nao chama o service em requisicoes nao autorizadas");

    delete process.env.CRON_SECRET;
    const unconfigured = await GET(request("Bearer route-secret"));
    check(unconfigured.status === 503, "rota retorna 503 quando CRON_SECRET nao esta configurado");
    check(serviceCalls === 0, "rota nao acessa o processador sem configuracao");

    process.env.CRON_SECRET = "route-secret";
    const success = await GET(request("Bearer route-secret"));
    const successBody = await responseBody(success);
    const successData = checkSuccessEnvelope(successBody, "processed", "processed");
    check(success.status === 200, "rota autenticada retorna 200");
    check(serviceCalls === 1, "rota chama o processador uma unica vez por requisicao");
    check(
      successData.found === 2 &&
        successData.executed === true &&
        successData.reason === "processed" &&
        successData.sent === 1 &&
        successData.cancelled === 1 &&
        successData.skipped === 0,
      "rota preserva o retorno tipado do processador"
    );
    check(success.headers.get("cache-control")?.includes("no-store"), "rota desabilita cache");
    check(
      !JSON.stringify(successBody).includes("route-secret"),
      "resposta nao expoe o segredo"
    );

    routeResult = {
      ...routeResult,
      executed: false,
      reason: "already_running",
      found: 0,
      sent: 0,
      cancelled: 0
    };
    const alreadyRunning = await GET(request("Bearer route-secret"));
    const alreadyRunningBody = await responseBody(alreadyRunning);
    const alreadyRunningData = checkSuccessEnvelope(
      alreadyRunningBody,
      "already_running",
      "already_running"
    );
    check(
      alreadyRunning.status === 200 &&
        alreadyRunningData.executed === false &&
        alreadyRunningData.reason === "already_running",
      "rota diferencia lock ocupado com already_running"
    );
    check(
      alreadyRunningData.found === 0 &&
        alreadyRunningData.sent === 0 &&
        alreadyRunningData.cancelled === 0,
      "lock ocupado retorna contadores zerados"
    );

    routeResult = {
      ...routeResult,
      executed: true,
      reason: "empty_batch",
      lockAcquired: true
    };
    const emptyRoute = await GET(request("Bearer route-secret"));
    const emptyRouteBody = await responseBody(emptyRoute);
    const emptyRouteData = checkSuccessEnvelope(
      emptyRouteBody,
      "empty_batch",
      "empty_batch"
    );
    check(
      emptyRoute.status === 200 &&
        emptyRouteData.executed === true &&
        emptyRouteData.reason === "empty_batch",
      "rota diferencia lote vazio com empty_batch"
    );

    scheduleNotifications.processPendingReminders = (() => {
      serviceCalls += 1;
      throw new TypeError("database detail");
    }) as never;
    const failure = await GET(request("Bearer route-secret"));
    const failureBody = await responseBody(failure);
    check(failure.status === 500, "falha estrutural do service retorna 500");
    check(
      JSON.stringify(failureBody) ===
        JSON.stringify({
          success: false,
          error: {
            code: "SCHEDULE_REMINDER_PROCESSING_FAILED",
            message: "Nao foi possivel processar os lembretes."
          }
        }),
      "resposta de erro permanece inalterada"
    );
    check(
      !JSON.stringify(failureBody).includes("database detail"),
      "resposta 500 nao expoe detalhe tecnico"
    );

    const prismaFailure = new Prisma.PrismaClientKnownRequestError(
      "Raw query failed. DATABASE_URL=postgresql://sensitive-value Authorization: Bearer sensitive-token",
      {
        code: "P2010",
        clientVersion: "6.19.3",
        meta: {
          code: "42883",
          message: "function pg_try_advisory_xact_lock(bigint, bigint) does not exist",
          query: "sensitive query parameters"
        }
      }
    );
    scheduleNotifications.processPendingReminders = (() => {
      throw new ScheduleReminderProcessingError(
        prismaFailure,
        "acquire_advisory_lock",
        2
      );
    }) as never;
    const prismaFailureResponse = await GET(request("Bearer route-secret"));
    const prismaFailureBody = await responseBody(prismaFailureResponse);
    const failureLog = operationalLogs.find(
      ([message, details]) =>
        message === "[ScheduleReminderCron] execution failed." &&
        typeof details === "object" &&
        details !== null &&
        (details as { phase?: unknown }).phase === "acquire_advisory_lock"
    );
    const failureDetails = failureLog?.[1] as
      | {
          phase?: string;
          attempt?: number;
          error?: {
            name?: string;
            code?: string | null;
            message?: string;
            meta?: Record<string, unknown> | null;
            clientVersion?: string | null;
          };
        }
      | undefined;
    check(
      prismaFailureResponse.status === 500 &&
        prismaFailureBody.error !== undefined &&
        !JSON.stringify(prismaFailureBody).includes("P2010") &&
        !JSON.stringify(prismaFailureBody).includes("42883"),
      "resposta Prisma permanece generica e nao expoe diagnostico"
    );
    check(
      failureDetails?.phase === "acquire_advisory_lock" &&
        failureDetails.attempt === 2,
      "log associa fase e tentativa ao executionId"
    );
    check(
      failureDetails?.error?.name === "PrismaClientKnownRequestError" &&
        failureDetails.error.code === "P2010" &&
        failureDetails.error.clientVersion === "6.19.3" &&
        failureDetails.error.meta?.code === "42883",
      "log registra diagnostico tipado do Prisma"
    );
    check(
      !JSON.stringify(failureDetails).includes("sensitive-value") &&
        !JSON.stringify(failureDetails).includes("sensitive-token") &&
        !JSON.stringify(failureDetails).includes("sensitive query parameters"),
      "log sanitiza URLs, Authorization e parametros sensiveis"
    );
    scheduleNotifications.processPendingReminders = actualProcessor;

    const routeSource = readFileSync(
      "src/app/api/internal/cron/schedule-reminders/route.ts",
      "utf8"
    );
    check(routeSource.includes("export async function GET"), "rota expoe GET exigido pelo Vercel Cron");
    check(!routeSource.includes("export async function POST"), "rota nao expoe metodo alternativo");
    check(routeSource.includes("await scheduleNotificationService.processPendingReminders()"), "rota aguarda a conclusao do processamento");
    check(!routeSource.includes("setTimeout") && !routeSource.includes("setInterval"), "rota nao usa timer em memoria");

    let lockOwner: unknown = null;
    let pending: DueReminder[] = [];
    const sentIds = new Set<string>();
    const cancelledIds = new Set<string>();
    const transactionDatabases = new Set<unknown>();
    const transactionFailures: unknown[] = [];
    let transactionCalls = 0;
    replace(
      "notification:transaction",
      notificationRepo,
      "transaction",
      (async (callback: (database: unknown) => Promise<unknown>) => {
        const database = {};
        transactionCalls += 1;
        transactionDatabases.add(database);
        const pendingSnapshot = [...pending];
        const sentSnapshot = new Set(sentIds);
        const cancelledSnapshot = new Set(cancelledIds);
        try {
          const transactionFailure = transactionFailures.shift();
          if (transactionFailure) throw transactionFailure;
          return await callback(database);
        } catch (error) {
          pending = pendingSnapshot;
          sentIds.clear();
          sentSnapshot.forEach((id) => sentIds.add(id));
          cancelledIds.clear();
          cancelledSnapshot.forEach((id) => cancelledIds.add(id));
          throw error;
        } finally {
          if (lockOwner === database) lockOwner = null;
        }
      }) as never
    );
    replace(
      "notification:lock",
      notificationRepo,
      "tryAcquireScheduleReminderProcessingLock",
      ((database: unknown) => {
        if (lockOwner !== null) return Promise.resolve(false);
        lockOwner = database;
        return Promise.resolve(true);
      }) as never
    );

    let listDelayMs = 0;
    let requestedLimit = 0;
    let listCalls = 0;
    replace(
      "notification:listDue",
      notificationRepo,
      "listDueScheduled",
      (async (_type: NotificationType, _now: Date, limit: number) => {
        listCalls += 1;
        requestedLimit = limit;
        if (listDelayMs) await new Promise((resolve) => setTimeout(resolve, listDelayMs));
        return pending.slice(0, limit);
      }) as never
    );

    let preferenceCalls = 0;
    let inactiveUsers = new Set<string>();
    let disabledUsers = new Set<string>();
    let preferenceFailure: Error | null = null;
    replace(
      "publisher:preferences",
      publisher,
      "preferences",
      ((userIds: string[]) => {
        preferenceCalls += 1;
        if (preferenceFailure) {
          const error = preferenceFailure;
          preferenceFailure = null;
          throw error;
        }
        return Promise.resolve(
          [...new Set(userIds)].map((userId) => ({
            userId,
            active: !inactiveUsers.has(userId),
            preference: {
              type: NotificationType.SCHEDULE_REMINDER,
              inAppEnabled: !disabledUsers.has(userId),
              reminderHoursBefore: 24,
              isDefault: true
            }
          }))
        );
      }) as never
    );

    let eligibleUserIds = new Set<string>();
    let currentVersion = 1;
    let eligibilityCalls = 0;
    let eligibilityFailure: Error | null = null;
    replace(
      "schedule:recipientLinks",
      scheduleRepo,
      "listPublishedScheduleRecipientLinks",
      (() => {
        eligibilityCalls += 1;
        if (eligibilityFailure) {
          const error = eligibilityFailure;
          eligibilityFailure = null;
          throw error;
        }
        return Promise.resolve(
          eligibleUserIds.size ? [scheduleLink([...eligibleUserIds], currentVersion)] : []
        );
      }) as never
    );

    let markSentFailure: Error | null = null;
    let cancelFailure: Error | null = null;
    replace(
      "notification:markSent",
      notificationRepo,
      "markSent",
      ((ids: string[]) => {
        if (markSentFailure) {
          const error = markSentFailure;
          markSentFailure = null;
          throw error;
        }
        ids.forEach((id) => sentIds.add(id));
        pending = pending.filter((item) => !ids.includes(item.id));
        return Promise.resolve({ count: ids.length });
      }) as never
    );
    replace(
      "notification:cancelScheduled",
      notificationRepo,
      "cancelScheduled",
      ((ids: string[]) => {
        if (cancelFailure) {
          const error = cancelFailure;
          cancelFailure = null;
          throw error;
        }
        ids.forEach((id) => cancelledIds.add(id));
        pending = pending.filter((item) => !ids.includes(item.id));
        return Promise.resolve({ count: ids.length });
      }) as never
    );

    const valid = reminder("valid");
    pending = [valid];
    eligibleUserIds = new Set([valid.userId]);
    listDelayMs = 25;
    const concurrencyStartedAt = performance.now();
    const [firstConcurrent, secondConcurrent] = await Promise.all([
      scheduleNotificationService.processPendingReminders(),
      scheduleNotificationService.processPendingReminders()
    ]);
    originalInfo(
      `BENCHMARK simulated concurrent-lock: total=${Number(
        (performance.now() - concurrencyStartedAt).toFixed(3)
      )}ms`
    );
    check(
      [firstConcurrent.lockAcquired, secondConcurrent.lockAcquired].filter(Boolean).length === 1,
      "duas execucoes simultaneas adquirem apenas um lock persistido"
    );
    const blockedConcurrent = [firstConcurrent, secondConcurrent].find(
      (result) => !result.lockAcquired
    );
    check(
      blockedConcurrent?.executed === false &&
        blockedConcurrent.reason === "already_running" &&
        blockedConcurrent.found === 0,
      "execucao concorrente bloqueada retorna contrato explicito e contadores zerados"
    );
    check(sentIds.size === 1, "o mesmo reminder e processado uma unica vez");
    check(listCalls === 1, "execucao sem lock nao seleciona o lote");

    listDelayMs = 0;
    const retryAfterSuccess = await scheduleNotificationService.processPendingReminders();
    check(
      retryAfterSuccess.executed &&
        retryAfterSuccess.reason === "empty_batch" &&
        retryAfterSuccess.found === 0,
      "nova execucao apos commit readquire o lock e permanece idempotente"
    );
    check(
      transactionDatabases.size === transactionCalls,
      "cada tentativa utiliza um contexto transacional novo"
    );

    const expired = reminder("expired", { expiresAt: new Date("2026-07-30T09:00:00.000Z") });
    const obsolete = reminder("obsolete", {
      deduplicationKey: "schedule:reminder:v0:schedule-1:participant-obsolete:202608021900"
    });
    const inactive = reminder("inactive");
    const disabled = reminder("disabled");
    const removed = reminder("removed");
    const cancelledSchedule = reminder("cancelled-schedule", { entityId: "schedule-cancelled" });
    const completedSchedule = reminder("completed-schedule", { entityId: "schedule-completed" });
    const deletedSchedule = reminder("deleted-schedule", { entityId: "schedule-deleted" });
    const malformed = reminder("malformed", { deduplicationKey: null });
    pending = [
      expired,
      obsolete,
      inactive,
      disabled,
      removed,
      cancelledSchedule,
      completedSchedule,
      deletedSchedule,
      malformed
    ];
    inactiveUsers = new Set([inactive.userId]);
    disabledUsers = new Set([disabled.userId]);
    eligibleUserIds = new Set([
      expired.userId,
      obsolete.userId,
      inactive.userId,
      disabled.userId
    ]);
    currentVersion = 1;
    const invalidated = await scheduleNotificationService.processPendingReminders(
      new Date("2026-07-30T10:00:00.000Z")
    );
    check(invalidated.sent === 0 && invalidated.cancelled === 9, "itens inelegiveis sao cancelados no mesmo lote");
    check(cancelledIds.has(expired.id), "reminder expirado e cancelado");
    check(cancelledIds.has(obsolete.id), "notificationVersion obsoleta e cancelada");
    check(cancelledIds.has(inactive.id), "reminder de usuario inativo e cancelado");
    check(cancelledIds.has(disabled.id), "preferencia desabilitada cancela reminder");
    check(cancelledIds.has(removed.id), "participante removido nao recebe reminder");
    check(
      [cancelledSchedule.id, completedSchedule.id, deletedSchedule.id].every((id) =>
        cancelledIds.has(id)
      ),
      "escalas cancelada, concluida ou excluida nao entregam reminder"
    );
    check(cancelledIds.has(malformed.id), "reminder sem versao valida e cancelado");
    check(preferenceCalls > 0 && eligibilityCalls > 0, "elegibilidade usa consultas em lote");

    const poison = reminder("poison", { deduplicationKey: "malformed" });
    const afterPoison = reminder("after-poison");
    pending = [poison, afterPoison];
    eligibleUserIds = new Set([poison.userId, afterPoison.userId]);
    const poisonResult = await scheduleNotificationService.processPendingReminders();
    check(
      poisonResult.sent === 1 && poisonResult.cancelled === 1,
      "reminder malformado nao bloqueia um reminder valido posterior no mesmo lote"
    );
    check(
      sentIds.has(afterPoison.id) && cancelledIds.has(poison.id),
      "poison reminder e isolado por classificacao de elegibilidade"
    );

    const batch = Array.from({ length: 205 }, (_, index) =>
      reminder(`batch-${String(index).padStart(3, "0")}`)
    );
    pending = [...batch];
    inactiveUsers = new Set();
    disabledUsers = new Set();
    eligibleUserIds = new Set(batch.map((item) => item.userId));
    sentIds.clear();
    const firstBatch = await scheduleNotificationService.processPendingReminders();
    const secondBatch = await scheduleNotificationService.processPendingReminders();
    const thirdBatch = await scheduleNotificationService.processPendingReminders();
    check(DEFAULT_SCHEDULE_REMINDER_BATCH_SIZE === 100, "tamanho padrao do lote e 100");
    check(requestedLimit === 100, "repository recebe o limite configurado");
    check(firstBatch.found === 100, "primeira execucao respeita o limite");
    check(secondBatch.found === 100, "segunda execucao continua o restante");
    check(thirdBatch.found === 5, "terceira execucao conclui o restante");
    check(sentIds.size === 205, "lote maior que o limite e concluido sem duplicidade");

    pending = Array.from({ length: 100 }, (_, index) => reminder(`exact-${index}`));
    eligibleUserIds = new Set(pending.map((item) => item.userId));
    const preferencesBeforeExact = preferenceCalls;
    const eligibilityBeforeExact = eligibilityCalls;
    const exactBatch = await scheduleNotificationService.processPendingReminders();
    check(exactBatch.found === 100, "lote exatamente no limite e processado");
    check(
      preferenceCalls - preferencesBeforeExact === 1 &&
        eligibilityCalls - eligibilityBeforeExact === 1,
      "lote de 100 resolve preferencias e vinculos uma vez cada, sem N+1"
    );

    const preferencesBeforeEmpty = preferenceCalls;
    const eligibilityBeforeEmpty = eligibilityCalls;
    pending = [];
    const emptyBatch = await scheduleNotificationService.processPendingReminders();
    check(
      emptyBatch.reason === "empty_batch" && emptyBatch.found === 0,
      "lote vazio retorna contrato explicito"
    );
    check(
      preferenceCalls === preferencesBeforeEmpty &&
        eligibilityCalls === eligibilityBeforeEmpty,
      "lote vazio nao executa consultas de elegibilidade"
    );

    const retriable = reminder("retriable");
    pending = [retriable];
    eligibleUserIds = new Set([retriable.userId]);
    const callsBeforeRetry = transactionCalls;
    const databasesBeforeRetry = transactionDatabases.size;
    transactionFailures.push({ code: "P2034" });
    const retried = await scheduleNotificationService.processPendingReminders();
    check(
      retried.attempts === 2 && retried.sent === 1,
      "conflito P2034 recebe um retry controlado e conclui"
    );
    check(
      transactionCalls - callsBeforeRetry === 2 &&
        transactionDatabases.size - databasesBeforeRetry === 2,
      "retry abre uma nova transacao e nao reutiliza a conexao logica anterior"
    );
    check(
      sentIds.has(retriable.id) && !pending.some((item) => item.id === retriable.id),
      "retry transacional nao duplica nem perde o reminder"
    );

    const exhausted = reminder("retry-exhausted");
    pending = [exhausted];
    eligibleUserIds = new Set([exhausted.userId]);
    const exhaustedError = { code: "40001" };
    transactionFailures.push(exhaustedError, exhaustedError, exhaustedError);
    const callsBeforeExhaustion = transactionCalls;
    await assert.rejects(
      () => scheduleNotificationService.processPendingReminders(),
      (error) =>
        error instanceof ScheduleReminderProcessingError &&
        error.originalError === exhaustedError &&
        error.attempt === MAX_SCHEDULE_REMINDER_TRANSACTION_ATTEMPTS
    );
    check(
      transactionCalls - callsBeforeExhaustion ===
        MAX_SCHEDULE_REMINDER_TRANSACTION_ATTEMPTS,
      "retry transacional possui limite estrito de tres tentativas"
    );
    check(
      pending.some((item) => item.id === exhausted.id) && !sentIds.has(exhausted.id),
      "esgotamento de retry preserva o reminder pendente"
    );

    const structural = reminder("structural");
    pending = [structural];
    eligibleUserIds = new Set([structural.userId]);
    const structuralError = { code: "P2002" };
    transactionFailures.push(structuralError);
    const callsBeforeStructural = transactionCalls;
    await assert.rejects(
      () => scheduleNotificationService.processPendingReminders(),
      (error) =>
        error instanceof ScheduleReminderProcessingError &&
        error.originalError === structuralError &&
        error.attempt === 1
    );
    check(
      transactionCalls - callsBeforeStructural === 1,
      "erro estrutural nao recebe retry"
    );

    check(
      transientScheduleReminderTransactionCode({ code: "P2034" }) === "P2034" &&
        transientScheduleReminderTransactionCode({ meta: { code: "40001" } }) ===
          "40001" &&
        transientScheduleReminderTransactionCode({
          cause: { code: "40P01" }
        }) === "40P01",
      "classificador reconhece apenas codigos transacionais tecnicos confiaveis"
    );
    check(
      transientScheduleReminderTransactionCode({ code: "P2028" }) === null &&
        transientScheduleReminderTransactionCode({ code: "P2002" }) === null &&
        transientScheduleReminderTransactionCode(new Error("P2034 in message")) ===
          null,
      "classificador nao usa texto da mensagem nem repete erros estruturais"
    );

    const firstPhase = reminder("failure-first");
    pending = [firstPhase];
    eligibleUserIds = new Set([firstPhase.userId]);
    preferenceFailure = new Error("first phase");
    await assert.rejects(
      () => scheduleNotificationService.processPendingReminders(),
      /first phase/
    );
    check(
      pending.some((item) => item.id === firstPhase.id),
      "falha no inicio da validacao faz rollback integral"
    );

    const middlePhase = reminder("failure-middle");
    pending = [middlePhase];
    eligibleUserIds = new Set([middlePhase.userId]);
    eligibilityFailure = new Error("middle phase");
    await assert.rejects(
      () => scheduleNotificationService.processPendingReminders(),
      /middle phase/
    );
    check(
      pending.some((item) => item.id === middlePhase.id),
      "falha no meio da validacao faz rollback integral"
    );

    const finalValid = reminder("failure-last-valid");
    const finalInvalid = reminder("failure-last-invalid", {
      deduplicationKey: "invalid"
    });
    pending = [finalValid, finalInvalid];
    eligibleUserIds = new Set([finalValid.userId, finalInvalid.userId]);
    const sentBeforeFinalFailure = new Set(sentIds);
    const cancelledBeforeFinalFailure = new Set(cancelledIds);
    cancelFailure = new Error("last phase");
    const rollbackStartedAt = performance.now();
    await assert.rejects(
      () => scheduleNotificationService.processPendingReminders(),
      /last phase/
    );
    originalInfo(
      `BENCHMARK simulated rollback-failure: total=${Number(
        (performance.now() - rollbackStartedAt).toFixed(3)
      )}ms`
    );
    check(
      pending.length === 2 &&
        pending.some((item) => item.id === finalValid.id) &&
        pending.some((item) => item.id === finalInvalid.id),
      "falha na atualizacao final restaura todo o lote"
    );
    check(
      [...sentIds].every((id) => sentBeforeFinalFailure.has(id)) &&
        [...cancelledIds].every((id) => cancelledBeforeFinalFailure.has(id)),
      "rollback nao deixa sucesso parcial observavel"
    );
    const resumed = await scheduleNotificationService.processPendingReminders();
    check(
      resumed.sent === 1 &&
        resumed.cancelled === 1 &&
        sentIds.has(finalValid.id) &&
        cancelledIds.has(finalInvalid.id),
      "execucao posterior ao rollback processa o lote exatamente uma vez"
    );

    const benchmark = async (
      label: string,
      items: DueReminder[],
      eligibleIds: string[]
    ) => {
      pending = [...items];
      eligibleUserIds = new Set(eligibleIds);
      const startedAt = performance.now();
      const result = await scheduleNotificationService.processPendingReminders();
      const elapsedMs = Number((performance.now() - startedAt).toFixed(3));
      originalInfo(
        `BENCHMARK simulated ${label}: total=${elapsedMs}ms transaction=${result.timings.transactionMs}ms selected=${result.found} sent=${result.sent} cancelled=${result.cancelled}`
      );
      return result;
    };

    await benchmark("empty", [], []);
    for (const size of [1, 10, 50, 100]) {
      const items = Array.from({ length: size }, (_, index) =>
        reminder(`benchmark-${size}-${index}`)
      );
      await benchmark(
        `eligible-${size}`,
        items,
        items.map((item) => item.userId)
      );
    }
    const mixedBenchmark = Array.from({ length: 100 }, (_, index) =>
      reminder(`benchmark-mixed-${index}`, {
        deduplicationKey:
          index % 2 === 0
            ? `schedule:reminder:v1:schedule-1:participant-benchmark-mixed-${index}:202608021900`
            : "invalid"
      })
    );
    await benchmark(
      "mixed-100",
      mixedBenchmark,
      mixedBenchmark.map((item) => item.userId)
    );
    const obsoleteBenchmark = Array.from({ length: 100 }, (_, index) =>
      reminder(`benchmark-obsolete-${index}`, {
        deduplicationKey: `schedule:reminder:v0:schedule-1:participant-benchmark-obsolete-${index}:202608021900`
      })
    );
    await benchmark(
      "obsolete-100",
      obsoleteBenchmark,
      obsoleteBenchmark.map((item) => item.userId)
    );

    check(reminderNotificationVersion(valid.deduplicationKey) === 1, "parser extrai notificationVersion");
    check(reminderNotificationVersion("invalid") === null, "parser rejeita chave invalida");

    const repositorySource = readFileSync("src/repositories/notification.repository.ts", "utf8");
    check(repositorySource.includes("FOR UPDATE SKIP LOCKED"), "selecao usa lock pessimista sem espera");
    check(
      repositorySource.includes('ORDER BY "scheduledFor" ASC, "createdAt" ASC, "id" ASC'),
      "lote possui ordenacao deterministica"
    );
    check(repositorySource.includes("pg_try_advisory_xact_lock"), "concorrencia usa advisory lock no PostgreSQL");
    check(
      repositorySource.includes(
        "CAST(${INTERNAL_JOB_LOCK_NAMESPACE} AS INTEGER)"
      ) &&
        repositorySource.includes(
          "CAST(${SCHEDULE_REMINDERS_CRON_LOCK_KEY} AS INTEGER)"
        ),
      "advisory lock usa a assinatura PostgreSQL integer, integer"
    );
    check(
      INTERNAL_JOB_LOCK_NAMESPACE === 0x00494245 &&
        SCHEDULE_REMINDERS_CRON_LOCK_KEY === 1,
      "namespace e chave do job sao explicitos e estaveis"
    );
    const reminderLockCoordinate: string =
      `${INTERNAL_JOB_LOCK_NAMESPACE}:${SCHEDULE_REMINDERS_CRON_LOCK_KEY}`;
    const futureJobLockCoordinate: string =
      `${INTERNAL_JOB_LOCK_NAMESPACE}:${SCHEDULE_REMINDERS_CRON_LOCK_KEY + 1}`;
    check(
      reminderLockCoordinate !== futureJobLockCoordinate,
      "um futuro job pode usar outra chave sem colidir com reminders"
    );
    check(
      repositorySource.includes("${INTERNAL_JOB_LOCK_NAMESPACE}") &&
        repositorySource.includes("${SCHEDULE_REMINDERS_CRON_LOCK_KEY}"),
      "query usa os identificadores nomeados em vez de hash ou numero inline"
    );
    check(repositorySource.includes("TransactionIsolationLevel.Serializable"), "transacao revalida conflitos concorrentes");
    check(
      repositorySource.includes('"cancelledAt" IS NULL') &&
        repositorySource.includes('"deletedAt" IS NULL'),
      "repository exclui reminders cancelados ou removidos antes da selecao"
    );

    const serviceSource = readFileSync(
      "src/services/schedule-notification.service.ts",
      "utf8"
    );
    check(
      serviceSource.includes("MAX_SCHEDULE_REMINDER_TRANSACTION_ATTEMPTS = 3"),
      "retry possui limite centralizado e documentavel"
    );
    check(
      !serviceSource.includes("setTimeout") && !serviceSource.includes("setInterval"),
      "retry nao mantem timer ou processo residente em ambiente serverless"
    );

    const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      crons?: unknown[];
    };
    check(
      !vercel.crons?.length,
      "Vercel nao registra Cron nativo no plano Hobby"
    );
    check(
      routeSource.includes("export async function GET"),
      "rota interna permanece disponivel para o agendador externo"
    );
    check(
      readFileSync(".env.example", "utf8").includes("CRON_SECRET="),
      "variavel CRON_SECRET esta documentada sem valor"
    );

    const serializedLogs = JSON.stringify(operationalLogs);
    check(!serializedLogs.includes("route-secret"), "logs operacionais nao registram o segredo");
    check(
      serializedLogs.includes("already_running") &&
        serializedLogs.includes("empty_batch") &&
        serializedLogs.includes("requestDurationMs"),
      "logs distinguem lock ocupado, lote vazio e duracao da requisicao"
    );
    check(
      serializedLogs.includes("retrying transient transaction") &&
        !serializedLogs.includes("P2034 in message"),
      "logs de retry usam codigo tecnico sem mensagem ou stack"
    );
    originalInfo(`Schedule reminders cron: ${scenarios} scenarios passed.`);
  } finally {
    if (originalSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalSecret;
    }
    console.info = originalInfo;
    console.error = originalError;
    console.warn = originalWarn;
    for (const { target, method, value } of originals.values()) {
      target[method] = value;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
