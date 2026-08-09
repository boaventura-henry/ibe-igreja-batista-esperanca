import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { NotificationType } from "@prisma/client";
import webpush from "web-push";
import { AppError } from "@/lib/errors";
import { notificationPublisher } from "@/services/notification-publisher.service";
import { notificationService } from "@/services/notification.service";
import { pushNotificationService } from "@/services/push-notification.service";
import { notificationRepository } from "@/repositories/notification.repository";
import { pushNotificationLogRepository, pushSubscriptionRepository } from "@/repositories";
import { pushSubscribeSchema } from "@/validators/push-notification.validator";
import { revokeCurrentPushSubscription } from "@/lib/push-subscription-client";

type Mutable = Record<string, unknown>;
type Restore = () => void;

const restores: Restore[] = [];
let scenarios = 0;

function check(value: unknown, message: string) {
  scenarios += 1;
  assert.ok(value, message);
}

function replace(target: object, method: string, value: unknown) {
  const mutable = target as Mutable;
  const previous = mutable[method];
  mutable[method] = value;
  restores.push(() => { mutable[method] = previous; });
}

function notification(overrides: Record<string, unknown> = {}) {
  return {
    id: "notification-1",
    userId: "user-1",
    createdById: "creator-1",
    type: NotificationType.SCHEDULE_PUBLISHED,
    title: "Voce foi escalado",
    message: "Voce foi escalado como Instrumento para 16/08.",
    entityType: "SCHEDULE",
    entityId: "schedule-1",
    actionUrl: null,
    scheduledFor: null,
    expiresAt: null,
    sentAt: new Date(),
    readAt: null,
    deduplicationKey: "schedule:published:v1:schedule-1:user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    hiddenAt: null,
    cancelledAt: null,
    deletedAt: null,
    ...overrides
  };
}

function device(id: string, userId = "user-1") {
  return {
    id,
    userId,
    endpoint: `https://push.example.test/${id}`,
    p256dh: "p256dh",
    auth: "auth",
    expirationTime: null,
    deviceName: id,
    userAgent: "Android Chrome",
    isActive: true,
    lastUsedAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    failureCount: 0,
    testSentAt: null,
    testConfirmedAt: null,
    testFailedAt: null,
    setupCompletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    revokedAt: null,
    user: { id: userId, memberId: "member-1", isActive: true }
  };
}

async function testClientContracts() {
  const source = readFileSync("src/components/portal/PushNotificationManager.tsx", "utf8");
  const logoutSource = readFileSync("src/lib/push-subscription-client.ts", "utf8");
  const reconcilerSource = readFileSync("src/components/pwa/PushSubscriptionReconciler.tsx", "utf8");
  const appShellSource = readFileSync("src/components/AppShell.tsx", "utf8");
  const portalShellSource = readFileSync("src/components/portal/PortalShell.tsx", "utf8");
  const requiredPasswordSource = readFileSync("src/app/trocar-senha/page.tsx", "utf8");
  const subscribeRoute = readFileSync("src/app/api/push/subscribe/route.ts", "utf8");
  const unsubscribeRoute = readFileSync("src/app/api/push/unsubscribe/route.ts", "utf8");
  const statusRoute = readFileSync("src/app/api/push/status/route.ts", "utf8");
  const preferencesRoute = readFileSync("src/app/api/push/preferences/route.ts", "utf8");

  check(source.includes('"serviceWorker" in navigator'), "detecta Service Worker");
  check(source.includes('"PushManager" in window'), "detecta PushManager");
  check(source.includes('"Notification" in window'), "detecta Notification API");
  check(source.includes("Notification.requestPermission()"), "solicita permissao somente no fluxo explicito");
  check(source.includes('permission === "default"'), "trata permissao default");
  check(source.includes('permission === "denied"'), "trata permissao denied");
  check(source.includes('nextPermission !== "granted"'), "trata recusa do usuario");
  check(!source.match(/useEffect[\s\S]{0,1000}requestPermission/), "nao solicita permissao automaticamente");
  check(source.includes("pushManager.getSubscription()"), "reutiliza subscription existente");
  check(source.includes("pushManager.subscribe({ userVisibleOnly: true"), "cria subscription visivel quando necessario");
  check(source.includes("syncSubscription(subscription).then(loadStatus)"), "reconcilia uma vez ao abrir");
  check(source.includes("PUSH_ENDPOINT_OWNED"), "remove subscription fisica vinculada a outra conta");
  check(logoutSource.includes('/api/push/unsubscribe'), "logout revoga ownership no backend");
  check(logoutSource.includes("subscription.unsubscribe()"), "logout remove subscription fisica");
  check(requiredPasswordSource.includes("revokeCurrentPushSubscription"), "troca obrigatoria limpa subscription antes de encerrar a sessao");
  check(reconcilerSource.includes('Notification.permission === "granted"'), "reconciliacao nao solicita permissao implicitamente");
  check(reconcilerSource.includes("pushManager.getSubscription()"), "reconciliacao usa somente subscription existente");
  check(reconcilerSource.includes("PUSH_ENDPOINT_OWNED") && reconcilerSource.includes("subscription.unsubscribe()"), "troca de conta remove ownership fisico conflitante");
  check(appShellSource.includes("<PushSubscriptionReconciler"), "shell administrativo reconcilia dispositivo autenticado");
  check(portalShellSource.includes("<PushSubscriptionReconciler"), "shell do portal reconcilia dispositivo autenticado");
  check(subscribeRoute.includes("requireCurrentUser"), "registro exige sessao");
  check(unsubscribeRoute.includes("requireCurrentUser"), "remocao exige sessao");
  check(statusRoute.includes("requireCurrentUser") && statusRoute.includes("getStatus(user.id)"), "status consulta somente o usuario da sessao");
  check(preferencesRoute.includes("requireCurrentUser") && preferencesRoute.includes("setPreferences(user.id"), "preferencias alteram somente o usuario da sessao");
  check(!subscribeRoute.includes("userId"), "registro nao aceita userId do cliente");
  check(!source.includes("setAppBadge") && !source.includes("clearAppBadge"), "nao implementa badge numerico");
  await revokeCurrentPushSubscription();
  check(true, "logout sem suporte de navegador conclui sem erro");
}

async function testSubscriptionBackend() {
  let preferenceEnabled = false;
  let upsertCalls = 0;
  replace(pushSubscriptionRepository, "upsert", (() => {
    upsertCalls += 1;
    return Promise.resolve({ id: "device-1" });
  }) as never);
  replace(pushSubscriptionRepository, "setPreference", ((_userId: string, enabled: boolean) => {
    preferenceEnabled = enabled;
    return Promise.resolve({ pushEnabled: enabled });
  }) as never);

  const payload = pushSubscribeSchema.parse({
    endpoint: "https://push.example.test/device-1",
    keys: { p256dh: "a".repeat(32), auth: "b".repeat(16) },
    expirationTime: null,
    deviceName: "Android - Chrome"
  });
  const first = await pushNotificationService.subscribe("user-1", payload, "Android Chrome");
  const second = await pushNotificationService.subscribe("user-1", payload, "Android Chrome");
  check(first.id === second.id && upsertCalls === 2, "reinscricao e idempotente");
  check(preferenceEnabled, "registro habilita preferencia Web Push existente");

  replace(pushSubscriptionRepository, "upsert", (() => Promise.resolve(null)) as never);
  await assert.rejects(
    () => pushNotificationService.subscribe("user-2", payload),
    (error: unknown) => error instanceof AppError && error.code === "PUSH_ENDPOINT_OWNED"
  );
  check(true, "endpoint nao pode pertencer a outro usuario");

  let revokedUser: string | null = null;
  replace(pushSubscriptionRepository, "findByIdForUser", ((_id: string, userId: string) =>
    Promise.resolve(userId === "user-1" ? { id: "device-1" } : null)) as never);
  replace(pushSubscriptionRepository, "revokeForUser", ((_id: string, userId: string) => {
    revokedUser = userId;
    return Promise.resolve({ count: 1 });
  }) as never);
  await pushNotificationService.unsubscribe("user-1", { id: "device-1" });
  check(revokedUser === "user-1", "remocao fica isolada ao usuario autenticado");
  await assert.rejects(
    () => pushNotificationService.unsubscribe("user-2", { id: "device-1" }),
    (error: unknown) => error instanceof AppError && error.code === "PUSH_DEVICE_NOT_FOUND"
  );
  check(revokedUser === "user-1", "usuario B nao revoga dispositivo do usuario A por IDOR");

  assert.throws(
    () => pushSubscribeSchema.parse({ endpoint: "javascript:alert(1)", keys: { p256dh: "x", auth: "y" } })
  );
  check(true, "payload invalido e rejeitado");
}

async function testAutomaticDelivery() {
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = ["test", "public", "key"].join("-");
  process.env.VAPID_PRIVATE_KEY = ["test", "private", "key"].join("-");
  process.env.VAPID_SUBJECT = "mailto:administracao@example.test";

  const deliveryDevices = [device("android"), device("notebook")];
  let enabledUsers = [{ userId: "user-1" }];
  let activeDevices = deliveryDevices;
  let sendBehavior: (endpoint: string) => Promise<void> = () => Promise.resolve();
  const permanentFailures: boolean[] = [];
  const auditDevices: Mutable[] = [];
  let successes = 0;
  let logSequence = 0;

  replace(webpush as unknown as object, "setVapidDetails", (() => undefined) as never);
  replace(webpush as unknown as object, "sendNotification", ((subscription: { endpoint: string }) => sendBehavior(subscription.endpoint)) as never);
  replace(pushSubscriptionRepository, "listEnabledUserIds", (() => Promise.resolve(enabledUsers)) as never);
  replace(pushSubscriptionRepository, "findActiveForUsers", (() => Promise.resolve(activeDevices)) as never);
  replace(pushSubscriptionRepository, "markSuccess", (() => { successes += 1; return Promise.resolve({}); }) as never);
  replace(pushSubscriptionRepository, "markFailure", ((_id: string, permanent: boolean) => { permanentFailures.push(permanent); return Promise.resolve({}); }) as never);
  replace(pushNotificationLogRepository, "createPending", (() => Promise.resolve({ id: `log-${++logSequence}` })) as never);
  replace(pushNotificationLogRepository, "updateFound", (() => Promise.resolve({})) as never);
  replace(pushNotificationLogRepository, "markStarted", (() => Promise.resolve({})) as never);
  replace(pushNotificationLogRepository, "createDevice", ((input: Mutable) => { auditDevices.push(input); return Promise.resolve({}); }) as never);
  replace(pushNotificationLogRepository, "markFinished", (() => Promise.resolve({})) as never);

  let result = await pushNotificationService.sendNotifications([notification()] as never);
  check(result.attempted === 2 && result.sent === 2, "envia para multiplos dispositivos");
  check(successes === 2, "sucesso de cada dispositivo e registrado");

  for (const count of [1, 2, 5]) {
    activeDevices = Array.from({ length: count }, (_, index) => device(`device-${count}-${index}`));
    sendBehavior = () => Promise.resolve();
    result = await pushNotificationService.sendNotifications([notification({ id: `notification-devices-${count}` })] as never);
    check(result.attempted === count && result.sent === count, `${count} dispositivo(s) ativo(s) recebem o Push`);
  }

  activeDevices = [device("duplicate-a"), { ...device("duplicate-b"), endpoint: device("duplicate-a").endpoint }];
  result = await pushNotificationService.sendNotifications([notification({ id: "notification-duplicate-endpoint" })] as never);
  check(result.attempted === 1, "endpoint duplicado e enviado uma unica vez");

  activeDevices = [device("owned"), device("other-user", "user-2")];
  result = await pushNotificationService.sendNotifications([notification({ id: "notification-owner-filter" })] as never);
  check(result.attempted === 1, "entrega automatica nao cruza subscriptions entre usuarios");

  activeDevices = [];
  result = await pushNotificationService.sendNotifications([notification()] as never);
  check(result.attempted === 0, "usuario sem subscription e ignorado com seguranca");

  activeDevices = deliveryDevices;
  enabledUsers = [];
  result = await pushNotificationService.sendNotifications([notification()] as never);
  check(result.attempted === 0, "preferencia Push desabilitada impede envio");

  enabledUsers = [{ userId: "user-1" }];
  activeDevices = [];
  result = await pushNotificationService.sendNotifications([notification()] as never);
  check(result.attempted === 0, "usuario inativo nao possui dispositivo elegivel");

  for (const statusCode of [404, 410, 429, 500, 502, 503]) {
    activeDevices = [device(`status-${statusCode}`)];
    sendBehavior = () => Promise.reject(Object.assign(new Error("provider failure"), { statusCode }));
    const before = permanentFailures.length;
    await pushNotificationService.sendNotifications([notification({ id: `notification-${statusCode}` })] as never);
    check(
      permanentFailures[before] === (statusCode === 404 || statusCode === 410),
      `${statusCode} recebe classificacao correta`
    );
  }

  activeDevices = [device("timeout")];
  sendBehavior = () => Promise.reject(Object.assign(new Error("request timed out"), { code: "ETIMEDOUT" }));
  const beforeTimeout = permanentFailures.length;
  await pushNotificationService.sendNotifications([notification({ id: "notification-timeout" })] as never);
  check(permanentFailures[beforeTimeout] === false, "timeout nao remove subscription");

  activeDevices = [device("dns")];
  sendBehavior = () => Promise.reject(Object.assign(new Error("getaddrinfo ENOTFOUND push.example.test"), { code: "ENOTFOUND" }));
  const beforeDns = permanentFailures.length;
  await pushNotificationService.sendNotifications([notification({ id: "notification-dns" })] as never);
  check(permanentFailures[beforeDns] === false, "falha de DNS nao remove subscription");

  activeDevices = [device("a-ok"), device("b-expired"), device("c-timeout"), device("d-ok")];
  sendBehavior = (endpoint) => {
    if (endpoint.endsWith("b-expired")) return Promise.reject(Object.assign(new Error("expired secret-auth-value"), { statusCode: 410 }));
    if (endpoint.endsWith("c-timeout")) return Promise.reject(Object.assign(new Error("request timed out secret-auth-value"), { code: "ETIMEDOUT" }));
    return Promise.resolve();
  };
  result = await pushNotificationService.sendNotifications([notification({ id: "notification-partial" })] as never);
  check(result.sent === 2 && result.failed === 2, "falhas parciais nao impedem os demais dispositivos");
  check(
    auditDevices.every((entry) => !JSON.stringify(entry).includes("secret-auth-value")),
    "auditoria nao persiste mensagem bruta, endpoint secreto ou chaves do provedor"
  );

  const configuredPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  activeDevices = [device("no-vapid")];
  sendBehavior = () => Promise.resolve();
  result = await pushNotificationService.sendNotifications([notification({ id: "notification-no-vapid" })] as never);
  check(result.attempted === 0, "VAPID ausente nao tenta envio nem interrompe a notificacao in-app");
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = configuredPublicKey;
}

async function testPersistenceAndPostCommit() {
  replace(notificationRepository, "findActiveUsersByIds", (() => Promise.resolve([{ id: "cuser001" }])) as never);
  replace(notificationRepository, "listPreferences", (() => Promise.resolve([])) as never);
  let persistedDeduplicationKey: string | null = null;
  replace(notificationRepository, "createManyAndReturn", ((inputs: Array<Record<string, unknown>>) => {
    const fresh = inputs.filter((input) => input.deduplicationKey !== persistedDeduplicationKey);
    if (fresh[0]?.deduplicationKey) persistedDeduplicationKey = String(fresh[0].deduplicationKey);
    return Promise.resolve(fresh.map((input, index) => notification({ ...input, id: `created-${index}` })));
  }) as never);

  const batch = await notificationService.createBatch([{
    userId: "cuser001",
    type: NotificationType.SCHEDULE_PUBLISHED,
    title: "Nova escala",
    message: "Voce foi escalado.",
    entityType: "SCHEDULE",
    entityId: "schedule-1",
    deduplicationKey: "schedule:published:v1:schedule-1:user-1"
  }]);
  check(batch.created === 1 && batch.notificationIds.length === 1, "persistencia retorna apenas notificacao criada e imediata");
  const duplicateBatch = await notificationService.createBatch([{
    userId: "cuser001",
    type: NotificationType.SCHEDULE_PUBLISHED,
    title: "Nova escala",
    message: "Voce foi escalado.",
    entityType: "SCHEDULE",
    entityId: "schedule-1",
    deduplicationKey: "schedule:published:v1:schedule-1:user-1"
  }]);
  check(duplicateBatch.created === 0 && duplicateBatch.notificationIds.length === 0, "deduplicacao nao produz segundo Push logico");

  replace(notificationRepository, "listPreferences", (() => Promise.resolve([{
    userId: "cuser001",
    type: NotificationType.SCHEDULE_PUBLISHED,
    inAppEnabled: false,
    reminderHoursBefore: null
  }])) as never);
  const disabledInApp = await notificationService.createBatch([{
    userId: "cuser001",
    type: NotificationType.SCHEDULE_PUBLISHED,
    title: "Nova escala",
    message: "Voce foi escalado.",
    entityType: "SCHEDULE",
    entityId: "schedule-2",
    deduplicationKey: "schedule:published:v1:schedule-2:user-1"
  }]);
  check(disabledInApp.eligible === 0 && disabledInApp.notificationIds.length === 0, "preferencia in-app desabilitada impede persistencia e Push derivado");

  let pushAttempted = false;
  replace(notificationRepository, "findDeliverableByIds", (() => Promise.resolve([notification()])) as never);
  replace(pushNotificationService, "sendNotifications", (() => { pushAttempted = true; return Promise.reject(new Error("push unavailable")); }) as never);
  const originalConsoleError = console.error;
  console.error = () => undefined;
  const postCommit = await notificationPublisher.deliverPush(batch.notificationIds);
  console.error = originalConsoleError;
  check(pushAttempted && postCommit.attempted === 0, "falha externa e isolada depois da persistencia in-app");
}

async function testServiceWorker() {
  const source = readFileSync("public/sw.js", "utf8");
  const listeners = new Map<string, (event: Mutable) => void>();
  const shown: Array<{ title: string; options: Mutable }> = [];
  let focused = 0;
  let navigatedTo: string | null = null;
  let openedTo: string | null = null;
  const context = {
    URL,
    Request,
    Response,
    fetch: async () => new Response("ok"),
    caches: { open: async () => ({ addAll: async () => undefined, put: async () => undefined }), keys: async () => [], delete: async () => true, match: async () => undefined },
    self: {
      location: { origin: "https://ibe.example.test" },
      addEventListener: (name: string, listener: (event: Mutable) => void) => listeners.set(name, listener),
      skipWaiting: async () => undefined,
      registration: {
        showNotification: async (title: string, options: Mutable) => { shown.push({ title, options }); },
        pushManager: { subscribe: async () => { throw new Error("not used"); } }
      },
      clients: {
        claim: async () => undefined,
        matchAll: async () => [{ focus: async () => { focused += 1; }, navigate: async (url: string) => { navigatedTo = url; } }],
        openWindow: async (url: string) => { openedTo = url; }
      }
    }
  };
  vm.runInNewContext(source, context);
  check(["install", "activate", "message", "fetch", "push", "notificationclick", "pushsubscriptionchange"].every((name) => listeners.has(name)), "Service Worker preserva lifecycle, cache e eventos de Push");

  let apiIntercepted = false;
  listeners.get("fetch")?.({
    request: new Request("https://ibe.example.test/api/notifications", { method: "GET" }),
    respondWith: () => { apiIntercepted = true; }
  });
  check(!apiIntercepted, "Service Worker nao intercepta nem cacheia APIs autenticadas");

  let pending: Promise<unknown> = Promise.resolve();
  listeners.get("push")?.({
    data: { json: () => ({ title: "Nova escala", body: "Confira sua escala.", data: { url: "/portal/minhas-escalas" }, icon: "https://evil.test/icon.png" }) },
    waitUntil: (value: Promise<unknown>) => { pending = value; }
  });
  await pending;
  check(shown[0]?.title === "Nova escala", "push valido exibe title");
  check(shown[0]?.options.body === "Confira sua escala.", "push valido exibe body");
  check(shown[0]?.options.icon === "/icons/icon-192x192.png", "icone externo e rejeitado");

  listeners.get("push")?.({ data: null, waitUntil: (value: Promise<unknown>) => { pending = value; } });
  await pending;
  check(shown[1]?.title === "Igreja Batista Esperanca", "push sem payload usa fallback");

  listeners.get("push")?.({ data: { json: () => { throw new Error("bad json"); } }, waitUntil: (value: Promise<unknown>) => { pending = value; } });
  await pending;
  check(shown[2]?.options.data && (shown[2].options.data as Mutable).url === "/portal", "payload malformado usa destino seguro");

  listeners.get("push")?.({ data: { json: () => ({ body: "Somente corpo", data: {} }) }, waitUntil: (value: Promise<unknown>) => { pending = value; } });
  await pending;
  check(shown[3]?.title === "Igreja Batista Esperanca" && shown[3]?.options.body === "Somente corpo", "payload sem title usa fallback sem perder body valido");

  listeners.get("push")?.({ data: { json: () => ({ title: "Somente titulo", data: { url: "/portal" } }) }, waitUntil: (value: Promise<unknown>) => { pending = value; } });
  await pending;
  check(shown[4]?.title === "Somente titulo" && shown[4]?.options.body === "Voce tem uma nova atualizacao no IBE.", "payload sem body usa fallback seguro");

  let closed = 0;
  listeners.get("notificationclick")?.({
    notification: { data: { url: "https://evil.test/phishing" }, close: () => { closed += 1; } },
    waitUntil: (value: Promise<unknown>) => { pending = value; }
  });
  await pending;
  check(closed === 1, "clique fecha notificacao");
  check(focused === 1 && navigatedTo === "/portal", "cliente existente recebe foco e URL maliciosa e rejeitada");

  for (const unsafeUrl of ["//evil.test/path", "javascript:alert(1)", "data:text/html,evil", "https://other.example.test/path", "http://["] ) {
    navigatedTo = null;
    listeners.get("notificationclick")?.({
      notification: { data: { url: unsafeUrl }, close: () => { closed += 1; } },
      waitUntil: (value: Promise<unknown>) => { pending = value; }
    });
    await pending;
    check(navigatedTo === "/portal", `destino inseguro ${unsafeUrl.split(":")[0]} usa fallback interno`);
  }

  (context.self.clients as Mutable).matchAll = async () => [];
  listeners.get("notificationclick")?.({
    notification: { data: { url: "/portal/eventos" }, close: () => { closed += 1; } },
    waitUntil: (value: Promise<unknown>) => { pending = value; }
  });
  await pending;
  check(openedTo === "/portal/eventos", "ausencia de cliente abre janela na rota interna");
  check(listeners.has("pushsubscriptionchange"), "Service Worker tenta renovar subscription quando suportado");
  listeners.get("pushsubscriptionchange")?.({
    oldSubscription: null,
    waitUntil: (value: Promise<unknown>) => { pending = value; }
  });
  await pending;
  check(true, "renovacao sem chave anterior encerra com seguranca");
  check(!source.includes("setAppBadge") && !source.includes("clearAppBadge"), "Service Worker nao implementa badge numerico");
}

async function main() {
  try {
    await testClientContracts();
    await testSubscriptionBackend();
    await testAutomaticDelivery();
    await testPersistenceAndPostCommit();
    await testServiceWorker();
    console.log(`Web Push notifications: ${scenarios} scenarios passed.`);
  } finally {
    while (restores.length) restores.pop()?.();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
