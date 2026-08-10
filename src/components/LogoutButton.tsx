"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";
import { revokeCurrentPushSubscription } from "@/lib/push-subscription-client";
import { clearAppBadge } from "@/lib/app-badge";
import { resetUnreadNotificationCount } from "@/hooks/useUnreadNotificationCount";

export function LogoutButton({ className = "" }: { className?: string }) {
  const [busy, setBusy] = useState(false);

  async function logout() {
    if (busy) return;
    setBusy(true);
    await clearAppBadge();
    resetUnreadNotificationCount();
    await revokeCurrentPushSubscription();
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <button type="button" onClick={logout} disabled={busy} className={className}>
      {busy ? "Saindo..." : "Sair"}
    </button>
  );
}
