"use client";

import { useSyncExternalStore } from "react";
import { NOTIFICATIONS_CHANGED_EVENT } from "@/lib/notification-events";
import { updateAppBadge } from "@/lib/app-badge";
import {
  createNotificationUnreadCountController,
  type NotificationUnreadCountSnapshot,
  type NotificationUnreadRefreshReason
} from "@/lib/notification-unread-count";
import type { ApiResponseBody, NotificationUnreadCountResult } from "@/types";
import { useEffect } from "react";

const SERVER_SNAPSHOT: NotificationUnreadCountSnapshot = {
  count: 0,
  initialized: false
};

let controller: ReturnType<typeof createNotificationUnreadCountController> | null = null;

function getController() {
  if (typeof window === "undefined") return null;
  if (controller) return controller;

  controller = createNotificationUnreadCountController({
    async fetchCount(signal) {
      const response = await fetch("/api/notifications/unread-count", {
        cache: "no-store",
        signal
      });
      if (response.status === 401 || response.status === 403) {
        return { authenticated: false };
      }
      const body = (await response.json()) as ApiResponseBody<NotificationUnreadCountResult>;
      if (!response.ok || !body.success) throw new Error("Unread count request failed.");
      return { authenticated: true, count: body.data.count };
    },
    getVisibilityState: () => document.visibilityState,
    now: () => Date.now(),
    setInterval: (callback, intervalMs) => window.setInterval(callback, intervalMs),
    clearInterval: (timer) => window.clearInterval(timer as number),
    addFocusListener(listener) {
      window.addEventListener("focus", listener);
      return () => window.removeEventListener("focus", listener);
    },
    addVisibilityListener(listener) {
      document.addEventListener("visibilitychange", listener);
      return () => document.removeEventListener("visibilitychange", listener);
    },
    addNotificationChangeListener(listener) {
      window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, listener);
      return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, listener);
    }
  });

  return controller;
}

function subscribe(listener: () => void) {
  return getController()?.subscribe(listener) ?? (() => undefined);
}

function getSnapshot() {
  return getController()?.getSnapshot() ?? SERVER_SNAPSHOT;
}

export function refreshUnreadNotificationCount(
  reason: NotificationUnreadRefreshReason = "interaction"
) {
  return getController()?.refresh(reason) ?? Promise.resolve();
}

export function resetUnreadNotificationCount() {
  getController()?.reset();
}

export function useUnreadNotificationCount() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);

  useEffect(() => {
    if (snapshot.initialized) void updateAppBadge(snapshot.count);
  }, [snapshot.count, snapshot.initialized]);

  return snapshot;
}
