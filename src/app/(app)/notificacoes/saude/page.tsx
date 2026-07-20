import { PushNotificationHealthManager } from "@/components/push-notifications/PushNotificationHealthManager";
import { requirePermission } from "@/lib/session";

export default async function PushNotificationHealthPage() {
  await requirePermission("push.logs.view");
  return (
    <div className="grid gap-5">
      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-hope-700">Administracao</p>
        <h1 className="text-2xl font-bold text-ink-900">Saude das Notificacoes</h1>
        <p className="mt-1 text-sm text-ink-500">Monitoramento operacional de subscriptions, entregas, reenvios e historico de dispositivos.</p>
      </div>
      <PushNotificationHealthManager />
    </div>
  );
}
