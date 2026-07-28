import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { PageHeader } from "@/components/PageHeader";
import { requireCurrentUser } from "@/lib/session";

export default async function PortalNotificationsPage() {
  await requireCurrentUser();

  return (
    <>
      <PageHeader
        eyebrow="Portal do Membro"
        title="Notificacoes"
        description="Acompanhe suas atualizacoes e preferencias."
      />
      <NotificationCenter />
    </>
  );
}
