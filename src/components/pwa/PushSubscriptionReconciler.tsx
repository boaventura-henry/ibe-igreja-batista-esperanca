"use client";

import { useEffect } from "react";
import { syncPushSubscription, type PushSubscriptionSyncError } from "@/lib/push-subscription-client";

function canReconcilePushSubscription() {
  return typeof window !== "undefined" &&
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    Notification.permission === "granted";
}

export function PushSubscriptionReconciler() {
  useEffect(() => {
    if (!canReconcilePushSubscription()) return;
    let active = true;

    void navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then(async (subscription) => {
        if (!active || !subscription) return;
        try {
          await syncPushSubscription(subscription);
        } catch (error) {
          if ((error as PushSubscriptionSyncError).code === "PUSH_ENDPOINT_OWNED") {
            await subscription.unsubscribe();
          }
        }
      })
      .catch(() => undefined);

    return () => { active = false; };
  }, []);

  return null;
}
