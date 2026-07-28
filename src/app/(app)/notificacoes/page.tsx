import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { PageHeader } from "@/components/PageHeader";
import { requireCurrentUser } from "@/lib/session";

export default async function NotificationsPage() {
  await requireCurrentUser();

  return (
    <>
      <PageHeader
        eyebrow="Conta"
        title="Notificacoes"
        description="Acompanhe suas atualizacoes e preferencias."
      />
      <NotificationCenter />
    </>
  );
}
