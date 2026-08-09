export type PushSubscriptionSyncError = Error & { status?: number; code?: string };

export async function syncPushSubscription(
  subscription: PushSubscription,
  deviceName?: string | null
) {
  const json = subscription.toJSON();
  if (!subscription.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    throw new Error("O navegador nao forneceu uma inscricao valida.");
  }

  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      keys: json.keys,
      expirationTime: subscription.expirationTime,
      deviceName: deviceName ?? undefined
    })
  });
  const payload = await response.json().catch(() => null) as {
    success?: boolean;
    data?: { id?: string };
    error?: { message?: string; code?: string };
  } | null;

  if (!response.ok || !payload?.success || !payload.data?.id) {
    const error = new Error(
      payload?.error?.message?.slice(0, 180) || "Falha ao registrar o dispositivo na API."
    ) as PushSubscriptionSyncError;
    error.status = response.status;
    error.code = payload?.error?.code;
    throw error;
  }

  return { id: payload.data.id };
}

export async function revokeCurrentPushSubscription() {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    try {
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
        keepalive: true
      });
    } finally {
      await subscription.unsubscribe();
    }
  } catch {
    // Logout must continue even when the browser cannot clean up Push state.
  }
}
