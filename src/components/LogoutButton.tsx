"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";
import { revokeCurrentPushSubscription } from "@/lib/push-subscription-client";

export function LogoutButton({ className = "" }: { className?: string }) {
  const [busy, setBusy] = useState(false);

  async function logout() {
    if (busy) return;
    setBusy(true);
    await revokeCurrentPushSubscription();
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <button type="button" onClick={logout} disabled={busy} className={className}>
      {busy ? "Saindo..." : "Sair"}
    </button>
  );
}
