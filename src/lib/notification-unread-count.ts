export const NOTIFICATION_UNREAD_POLL_INTERVAL_MS = 30_000;
export const NOTIFICATION_UNREAD_IMMEDIATE_COALESCE_MS = 750;

export type NotificationUnreadCountSnapshot = {
  count: number;
  initialized: boolean;
};

export type NotificationUnreadRefreshReason =
  | "initial"
  | "poll"
  | "focus"
  | "visibility"
  | "interaction"
  | "mutation"
  | "queued";

export type NotificationUnreadCountFetchResult =
  | { count: number; authenticated: true }
  | { authenticated: false };

type Listener = () => void;
type RemoveListener = () => void;

export type NotificationUnreadCountEnvironment = {
  fetchCount: (signal: AbortSignal) => Promise<NotificationUnreadCountFetchResult>;
  getVisibilityState: () => DocumentVisibilityState;
  now: () => number;
  setInterval: (callback: () => void, intervalMs: number) => unknown;
  clearInterval: (timer: unknown) => void;
  addFocusListener: (listener: () => void) => RemoveListener;
  addVisibilityListener: (listener: () => void) => RemoveListener;
  addNotificationChangeListener: (listener: () => void) => RemoveListener;
};

const INITIAL_SNAPSHOT: NotificationUnreadCountSnapshot = {
  count: 0,
  initialized: false
};

export function createNotificationUnreadCountController(
  environment: NotificationUnreadCountEnvironment
) {
  let snapshot = INITIAL_SNAPSHOT;
  let timer: unknown = null;
  let inFlight: Promise<void> | null = null;
  let requestController: AbortController | null = null;
  let trailingRefresh = false;
  let active = false;
  let authenticationAvailable = true;
  let lastImmediateRefreshAt = Number.NEGATIVE_INFINITY;
  const listeners = new Set<Listener>();
  const removeRuntimeListeners: RemoveListener[] = [];

  function emit(nextCount: number) {
    if (snapshot.initialized && snapshot.count === nextCount) return;
    snapshot = { count: nextCount, initialized: true };
    listeners.forEach((listener) => listener());
  }

  function clearPolling() {
    if (timer !== null) {
      environment.clearInterval(timer);
      timer = null;
    }
  }

  function schedulePolling() {
    if (
      !active ||
      !authenticationAvailable ||
      timer !== null ||
      environment.getVisibilityState() !== "visible"
    ) {
      return;
    }

    timer = environment.setInterval(() => {
      void refresh("poll");
    }, NOTIFICATION_UNREAD_POLL_INTERVAL_MS);
  }

  async function refresh(reason: NotificationUnreadRefreshReason = "interaction") {
    const canProbeAuthentication =
      reason === "focus" ||
      reason === "visibility" ||
      reason === "interaction" ||
      reason === "initial";
    if (!active || environment.getVisibilityState() !== "visible") {
      return;
    }
    if (!authenticationAvailable && !canProbeAuthentication) {
      return;
    }

    const immediate = reason === "focus" || reason === "visibility";
    const now = environment.now();
    if (
      immediate &&
      now - lastImmediateRefreshAt < NOTIFICATION_UNREAD_IMMEDIATE_COALESCE_MS
    ) {
      return inFlight ?? Promise.resolve();
    }
    if (immediate) lastImmediateRefreshAt = now;

    if (inFlight) {
      if (
        reason === "mutation" ||
        reason === "interaction" ||
        reason === "initial"
      ) {
        trailingRefresh = true;
      }
      return inFlight;
    }

    requestController = new AbortController();
    const currentRequestController = requestController;
    inFlight = environment
      .fetchCount(currentRequestController.signal)
      .then((result) => {
        if (currentRequestController.signal.aborted) return;
        if (!result.authenticated) {
          authenticationAvailable = false;
          clearPolling();
          return;
        }
        authenticationAvailable = true;
        if (Number.isSafeInteger(result.count) && result.count >= 0) emit(result.count);
        schedulePolling();
      })
      .catch(() => {
        // Preserve the latest valid value and retry only on the next normal trigger.
      })
      .finally(() => {
        if (requestController === currentRequestController) requestController = null;
        inFlight = null;
        if (trailingRefresh) {
          trailingRefresh = false;
          void refresh("queued");
        }
      });

    return inFlight;
  }

  function handleVisibilityChange() {
    if (environment.getVisibilityState() !== "visible") {
      clearPolling();
      return;
    }
    void refresh("visibility");
    schedulePolling();
  }

  function start() {
    if (active) return;
    active = true;
    authenticationAvailable = true;
    removeRuntimeListeners.push(
      environment.addFocusListener(() => void refresh("focus")),
      environment.addVisibilityListener(handleVisibilityChange),
      environment.addNotificationChangeListener(() => void refresh("mutation"))
    );
    void refresh("initial");
    schedulePolling();
  }

  function stop() {
    if (!active) return;
    active = false;
    clearPolling();
    requestController?.abort();
    removeRuntimeListeners.splice(0).forEach((removeListener) => removeListener());
  }

  return {
    getSnapshot: () => snapshot,
    refresh,
    subscribe(listener: Listener) {
      listeners.add(listener);
      if (listeners.size === 1) start();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) stop();
      };
    }
  };
}
