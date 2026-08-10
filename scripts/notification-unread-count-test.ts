import { readFileSync } from "node:fs";
import {
  createNotificationUnreadCountController,
  NOTIFICATION_UNREAD_POLL_INTERVAL_MS,
  type NotificationUnreadCountFetchResult
} from "../src/lib/notification-unread-count";
import {
  buildNotificationUnreadWhere,
  notificationRepository
} from "../src/repositories/notification.repository";
import { prisma } from "../src/prisma/client";
import { notificationService } from "../src/services/notification.service";

let scenarios = 0;

function check(condition: unknown, message: string) {
  if (!condition) throw new Error(`FAILED: ${message}`);
  scenarios += 1;
}

function flush() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

type FetchStep =
  | NotificationUnreadCountFetchResult
  | Error
  | {
      aborted?: boolean;
      deferred: true;
      reject?: (error: Error) => void;
      resolve?: (result: NotificationUnreadCountFetchResult) => void;
    };

function createHarness() {
  let visibility: DocumentVisibilityState = "visible";
  let now = 1_000;
  let fetchCalls = 0;
  let timerSequence = 0;
  let abortedRequests = 0;
  const fetchSteps: FetchStep[] = [];
  const timers = new Map<number, () => void>();
  const focusListeners = new Set<() => void>();
  const visibilityListeners = new Set<() => void>();
  const notificationListeners = new Set<() => void>();

  const controller = createNotificationUnreadCountController({
    async fetchCount(signal) {
      fetchCalls += 1;
      const step = fetchSteps.shift() ?? { authenticated: true as const, count: 0 };
      if (step instanceof Error) throw step;
      if ("deferred" in step) {
        return new Promise<NotificationUnreadCountFetchResult>((resolve, reject) => {
          step.resolve = resolve;
          step.reject = reject;
          signal.addEventListener(
            "abort",
            () => {
              step.aborted = true;
              abortedRequests += 1;
              reject(new DOMException("Aborted", "AbortError"));
            },
            { once: true }
          );
        });
      }
      return step;
    },
    getVisibilityState: () => visibility,
    now: () => now,
    setInterval(callback, intervalMs) {
      check(intervalMs === 30_000, "polling usa o intervalo centralizado de 30 segundos");
      timerSequence += 1;
      timers.set(timerSequence, callback);
      return timerSequence;
    },
    clearInterval(timer) {
      timers.delete(timer as number);
    },
    addFocusListener(listener) {
      focusListeners.add(listener);
      return () => focusListeners.delete(listener);
    },
    addVisibilityListener(listener) {
      visibilityListeners.add(listener);
      return () => visibilityListeners.delete(listener);
    },
    addNotificationChangeListener(listener) {
      notificationListeners.add(listener);
      return () => notificationListeners.delete(listener);
    }
  });

  return {
    controller,
    fetchSteps,
    timers,
    focusListeners,
    visibilityListeners,
    notificationListeners,
    get fetchCalls() {
      return fetchCalls;
    },
    get abortedRequests() {
      return abortedRequests;
    },
    advance(milliseconds: number) {
      now += milliseconds;
    },
    setVisibility(next: DocumentVisibilityState) {
      visibility = next;
    }
  };
}

async function main() {
  check(
    NOTIFICATION_UNREAD_POLL_INTERVAL_MS === 30_000,
    "intervalo publico permanece em 30 segundos"
  );

  const where = JSON.stringify(buildNotificationUnreadWhere("user-a"));
  check(
    where.includes('"userId":"user-a"') &&
      where.includes('"readAt":null') &&
      where.includes('"hiddenAt":null') &&
      where.includes('"deletedAt":null') &&
      where.includes('"cancelledAt":null') &&
      where.includes('"sentAt":{"not":null}'),
    "COUNT considera somente notificacoes entregues, visiveis e nao lidas do usuario"
  );

  const mutableRepository = notificationRepository as unknown as Record<
    string,
    (...args: never[]) => unknown
  >;
  const originalCount = mutableRepository.countUnreadForUser;
  let receivedUserId = "";
  mutableRepository.countUnreadForUser = ((userId: string) => {
    receivedUserId = userId;
    return Promise.resolve(4);
  }) as (...args: never[]) => unknown;
  try {
    const result = await notificationService.getUnreadCount("session-user");
    check(
      result.count === 4 && receivedUserId === "session-user",
      "service calcula o contador exclusivamente para o userId da sessao"
    );
  } finally {
    mutableRepository.countUnreadForUser = originalCount;
  }

  const records = [
    { userId: "user-a", readAt: null, hiddenAt: null, deletedAt: null, cancelledAt: null, sentAt: new Date() },
    { userId: "user-a", readAt: new Date(), hiddenAt: null, deletedAt: null, cancelledAt: null, sentAt: new Date() },
    { userId: "user-a", readAt: null, hiddenAt: new Date(), deletedAt: null, cancelledAt: null, sentAt: new Date() },
    { userId: "user-a", readAt: null, hiddenAt: null, deletedAt: new Date(), cancelledAt: null, sentAt: new Date() },
    { userId: "user-a", readAt: null, hiddenAt: null, deletedAt: null, cancelledAt: new Date(), sentAt: new Date() },
    { userId: "user-a", readAt: null, hiddenAt: null, deletedAt: null, cancelledAt: null, sentAt: null },
    { userId: "user-b", readAt: null, hiddenAt: null, deletedAt: null, cancelledAt: null, sentAt: new Date() },
    { userId: "user-b", readAt: null, hiddenAt: null, deletedAt: null, cancelledAt: null, sentAt: new Date() }
  ];
  const mutableNotificationDelegate = prisma.notification as unknown as {
    count: (input: { where: Record<string, unknown> }) => Promise<number>;
  };
  const originalPrismaCount = mutableNotificationDelegate.count;
  let countCalls = 0;
  mutableNotificationDelegate.count = async ({ where: inputWhere }) => {
    countCalls += 1;
    return records.filter(
      (record) =>
        record.userId === inputWhere.userId &&
        record.readAt === null &&
        record.hiddenAt === null &&
        record.deletedAt === null &&
        record.cancelledAt === null &&
        record.sentAt !== null
    ).length;
  };
  try {
    check(
      (await notificationRepository.countUnreadForUser("user-a")) === 1,
      "usuario A conta apenas seu registro valido"
    );
    check(
      (await notificationRepository.countUnreadForUser("user-b")) === 2,
      "usuario B nao recebe registros do usuario A"
    );
    check(countCalls === 2, "repository executa exatamente um COUNT por usuario");
  } finally {
    mutableNotificationDelegate.count = originalPrismaCount;
  }

  const routeSource = readFileSync(
    "src/app/api/notifications/unread-count/route.ts",
    "utf8"
  );
  check(
    routeSource.includes("requireCurrentUser()") &&
      routeSource.includes("notificationService.getUnreadCount(user.id)") &&
      !routeSource.includes("request.json") &&
      routeSource.includes('Cache-Control", "no-store"'),
    "endpoint exige autenticacao, usa a sessao e desabilita cache"
  );

  const harness = createHarness();
  harness.fetchSteps.push({ authenticated: true, count: 2 });
  let notifications = 0;
  const unsubscribeA = harness.controller.subscribe(() => {
    notifications += 1;
  });
  await flush();
  check(
    harness.controller.getSnapshot().count === 2 && notifications === 1,
    "contador e carregado inicialmente"
  );
  check(harness.timers.size === 1, "uma inscricao cria apenas um timer");

  const unsubscribeB = harness.controller.subscribe(() => undefined);
  check(harness.timers.size === 1, "segunda instancia do sino reutiliza o mesmo timer");

  harness.fetchSteps.push({ authenticated: true, count: 3 });
  [...harness.timers.values()][0]?.();
  await flush();
  check(harness.controller.getSnapshot().count === 3, "polling atualiza uma nova notificacao");

  const callsBeforeHidden = harness.fetchCalls;
  harness.setVisibility("hidden");
  harness.visibilityListeners.forEach((listener) => listener());
  check(harness.timers.size === 0, "aba oculta suspende o polling");
  await harness.controller.refresh("poll");
  check(harness.fetchCalls === callsBeforeHidden, "aba oculta nao consulta o contador");

  harness.advance(1_000);
  harness.fetchSteps.push({ authenticated: true, count: 4 });
  harness.setVisibility("visible");
  harness.visibilityListeners.forEach((listener) => listener());
  await flush();
  check(
    harness.controller.getSnapshot().count === 4 && harness.timers.size === 1,
    "visibility visible atualiza imediatamente e retoma o polling"
  );

  harness.advance(1_000);
  const concurrentStep: FetchStep = { deferred: true };
  harness.fetchSteps.push(concurrentStep);
  const callsBeforeCoalescing = harness.fetchCalls;
  harness.focusListeners.forEach((listener) => listener());
  harness.visibilityListeners.forEach((listener) => listener());
  check(
    harness.fetchCalls === callsBeforeCoalescing + 1,
    "focus e visibility proximos compartilham uma unica request"
  );
  if ("deferred" in concurrentStep) {
    concurrentStep.resolve?.({ authenticated: true, count: 5 });
  }
  await flush();
  check(harness.controller.getSnapshot().count === 5, "focus atualiza o contador imediatamente");

  harness.advance(1_000);
  const inverseOrderStep: FetchStep = { deferred: true };
  harness.fetchSteps.push(inverseOrderStep);
  const callsBeforeInverseOrder = harness.fetchCalls;
  harness.visibilityListeners.forEach((listener) => listener());
  harness.focusListeners.forEach((listener) => listener());
  check(
    harness.fetchCalls === callsBeforeInverseOrder + 1,
    "visibility seguido de focus tambem executa somente uma request"
  );
  if ("deferred" in inverseOrderStep) {
    inverseOrderStep.resolve?.({ authenticated: true, count: 5 });
  }
  await flush();

  harness.advance(1_000);
  const mutationStep: FetchStep = { deferred: true };
  harness.fetchSteps.push(mutationStep, { authenticated: true, count: 7 });
  const interactionRequest = harness.controller.refresh("interaction");
  harness.notificationListeners.forEach((listener) => listener());
  if ("deferred" in mutationStep) {
    mutationStep.resolve?.({ authenticated: true, count: 6 });
  }
  await interactionRequest;
  await flush();
  check(
    harness.controller.getSnapshot().count === 7,
    "mutacao durante request agenda uma unica sincronizacao posterior"
  );

  const triggerHarness = createHarness();
  const triggerStep: FetchStep = { deferred: true };
  triggerHarness.fetchSteps.push(triggerStep, { authenticated: true, count: 10 });
  const closeTriggerHarness = triggerHarness.controller.subscribe(() => undefined);
  triggerHarness.focusListeners.forEach((listener) => listener());
  triggerHarness.visibilityListeners.forEach((listener) => listener());
  void triggerHarness.controller.refresh("poll");
  void triggerHarness.controller.refresh("interaction");
  triggerHarness.notificationListeners.forEach((listener) => listener());
  triggerHarness.notificationListeners.forEach((listener) => listener());
  check(
    triggerHarness.fetchCalls === 1,
    "polling, focus, visibility, Central e mutacoes compartilham a request ativa"
  );
  if ("deferred" in triggerStep) {
    triggerStep.resolve?.({ authenticated: true, count: 9 });
  }
  await flush();
  check(
    triggerHarness.fetchCalls === 2 && triggerHarness.controller.getSnapshot().count === 10,
    "multiplos triggers geram no maximo uma atualizacao posterior"
  );
  await flush();
  check(triggerHarness.fetchCalls === 2, "single-flight nao cria uma terceira request residual");
  closeTriggerHarness();

  harness.fetchSteps.push(new Error("temporary network error"));
  [...harness.timers.values()][0]?.();
  await flush();
  check(harness.controller.getSnapshot().count === 7, "falha preserva o ultimo contador valido");

  harness.fetchSteps.push({ authenticated: true, count: 8 });
  [...harness.timers.values()][0]?.();
  await flush();
  check(harness.controller.getSnapshot().count === 8, "polling seguinte recupera apos falha");

  harness.fetchSteps.push(new Error("focus recovery error"));
  harness.advance(1_000);
  harness.focusListeners.forEach((listener) => listener());
  await flush();
  harness.fetchSteps.push({ authenticated: true, count: 9 });
  harness.advance(1_000);
  harness.visibilityListeners.forEach((listener) => listener());
  await flush();
  check(
    harness.controller.getSnapshot().count === 9,
    "visibility recupera o contador depois de falha acionada por focus"
  );

  unsubscribeA();
  check(harness.timers.size === 1, "timer permanece enquanto existe outro sino inscrito");
  unsubscribeB();
  check(
    harness.timers.size === 0 &&
      harness.focusListeners.size === 0 &&
      harness.visibilityListeners.size === 0 &&
      harness.notificationListeners.size === 0,
    "cleanup final remove timer e todos os listeners"
  );

  const unauthenticatedHarness = createHarness();
  unauthenticatedHarness.fetchSteps.push({ authenticated: false });
  const unsubscribeUnauthenticated = unauthenticatedHarness.controller.subscribe(() => undefined);
  await flush();
  check(
    unauthenticatedHarness.timers.size === 0,
    "sessao ausente interrompe o polling da montagem atual"
  );
  unauthenticatedHarness.fetchSteps.push({ authenticated: true, count: 6 });
  unauthenticatedHarness.advance(1_000);
  unauthenticatedHarness.focusListeners.forEach((listener) => listener());
  await flush();
  check(
    unauthenticatedHarness.controller.getSnapshot().count === 6 &&
      unauthenticatedHarness.timers.size === 1,
    "focus retoma o polling quando a sessao volta sem reload"
  );
  unsubscribeUnauthenticated();

  const unmountHarness = createHarness();
  const unmountStep: FetchStep = { deferred: true };
  unmountHarness.fetchSteps.push(unmountStep);
  const unsubscribeUnmount = unmountHarness.controller.subscribe(() => undefined);
  unsubscribeUnmount();
  await flush();
  check(
    unmountStep.aborted === true &&
      unmountHarness.abortedRequests === 1 &&
      unmountHarness.timers.size === 0 &&
      unmountHarness.focusListeners.size === 0,
    "ultimo unmount aborta request e remove recursos globais"
  );
  check(
    !unmountHarness.controller.getSnapshot().initialized,
    "request abortada nao publica estado depois do unmount"
  );

  const sharedUnmountHarness = createHarness();
  const sharedUnmountStep: FetchStep = { deferred: true };
  sharedUnmountHarness.fetchSteps.push(sharedUnmountStep);
  const closeSharedFirst = sharedUnmountHarness.controller.subscribe(() => undefined);
  const closeSharedSecond = sharedUnmountHarness.controller.subscribe(() => undefined);
  closeSharedFirst();
  check(
    sharedUnmountHarness.abortedRequests === 0 && sharedUnmountHarness.timers.size === 1,
    "unmount de um sino nao interrompe request ou timer usados pelo segundo"
  );
  if ("deferred" in sharedUnmountStep) {
    sharedUnmountStep.resolve?.({ authenticated: true, count: 10 });
  }
  await flush();
  check(
    sharedUnmountHarness.controller.getSnapshot().count === 10,
    "consumidor remanescente recebe o resultado da request compartilhada"
  );
  closeSharedSecond();

  const remountHarness = createHarness();
  remountHarness.fetchSteps.push({ authenticated: true, count: 11 });
  const firstMount = remountHarness.controller.subscribe(() => undefined);
  await flush();
  firstMount();
  remountHarness.fetchSteps.push({ authenticated: true, count: 12 });
  const secondMount = remountHarness.controller.subscribe(() => undefined);
  check(
    remountHarness.controller.getSnapshot().count === 11,
    "remount recebe imediatamente o ultimo contador conhecido"
  );
  await flush();
  check(
    remountHarness.controller.getSnapshot().count === 12 && remountHarness.timers.size === 1,
    "remount cria somente um novo timer e sincroniza o estado"
  );
  secondMount();

  const tabOne = createHarness();
  const tabTwo = createHarness();
  tabOne.fetchSteps.push({ authenticated: true, count: 1 });
  tabTwo.fetchSteps.push({ authenticated: true, count: 2 });
  const closeTabOne = tabOne.controller.subscribe(() => undefined);
  const closeTabTwo = tabTwo.controller.subscribe(() => undefined);
  await flush();
  check(
    tabOne.timers.size === 1 && tabTwo.timers.size === 1,
    "cada aba visivel possui conscientemente um polling independente"
  );
  tabTwo.setVisibility("hidden");
  tabTwo.visibilityListeners.forEach((listener) => listener());
  check(
    tabOne.timers.size === 1 && tabTwo.timers.size === 0,
    "ocultar uma aba suspende somente o polling daquela aba"
  );
  closeTabOne();
  closeTabTwo();

  const resetHarness = createHarness();
  resetHarness.fetchSteps.push({ authenticated: true, count: 5 });
  const closeResetHarness = resetHarness.controller.subscribe(() => undefined);
  await flush();
  check(resetHarness.controller.getSnapshot().count === 5, "reset harness recebe o contador da conta atual");
  resetHarness.controller.reset();
  check(
    resetHarness.controller.getSnapshot().initialized === false &&
      resetHarness.controller.getSnapshot().count === 0,
    "logout reseta o snapshot para impedir heranca entre usuarios"
  );
  closeResetHarness();

  const bellSource = readFileSync(
    "src/components/notifications/NotificationBell.tsx",
    "utf8"
  );
  const centerSource = readFileSync(
    "src/components/notifications/NotificationCenter.tsx",
    "utf8"
  );
  const hookSource = readFileSync("src/hooks/useUnreadNotificationCount.ts", "utf8");
  check(
    bellSource.includes("useUnreadNotificationCount") &&
      bellSource.includes("refreshUnreadNotificationCount") &&
      centerSource.includes('refreshUnreadNotificationCount("interaction")'),
    "sino e Central compartilham a mesma fonte de sincronizacao"
  );
  check(
    (bellSource.match(/refreshUnreadNotificationCount\("interaction"\)/g)?.length ?? 0) >= 3,
    "abrir, fechar e navegar pelo sino sincronizam o contador"
  );
  check(
    centerSource.includes("setData(body.data);") &&
      centerSource.includes('refreshUnreadNotificationCount("interaction")'),
    "abertura e carregamento da Central sincronizam o contador"
  );
  check(
    (bellSource.match(/notifyNotificationStateChanged\(\)/g)?.length ?? 0) >= 2,
    "leitura individual e leitura em lote pelo sino disparam sincronizacao imediata"
  );
  check(
    (centerSource.match(/notifyNotificationStateChanged\(\)/g)?.length ?? 0) >= 3,
    "leitura individual, leitura em lote e exclusao pela Central sincronizam o contador"
  );
  check(
    hookSource.includes("/api/notifications/unread-count") &&
      !hookSource.includes("serviceWorker") &&
      !hookSource.includes("PushManager") &&
      hookSource.includes("updateAppBadge"),
    "polling trafega apenas o contador e sincroniza o badge pela fonte central"
  );

  console.log(`Notification unread count: ${scenarios} scenarios passed.`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Unread count tests failed.");
  process.exitCode = 1;
});
