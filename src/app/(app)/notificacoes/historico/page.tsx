import { PushNotificationLogManager } from "@/components/push-notifications/PushNotificationLogManager";
import { hasPermission } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";

export default async function PushNotificationLogsPage() {
  const user = await requirePermission("push.logs.view");
  return (
    <div className="grid gap-5">
      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-hope-700">Administracao</p>
        <h1 className="text-2xl font-bold text-ink-900">Historico de Notificacoes</h1>
        <p className="mt-1 text-sm text-ink-500">Auditoria dos envios de notificacoes push e status por dispositivo.</p>
      </div>
      <PushNotificationLogManager canRetry={hasPermission(user, "push.logs.retry")} />
    </div>
  );
}
