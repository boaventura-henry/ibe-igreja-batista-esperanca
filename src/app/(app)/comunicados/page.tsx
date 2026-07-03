import { AnnouncementManager } from "@/components/announcements/AnnouncementManager";
import { PageHeader } from "@/components/PageHeader";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  await requirePermission("announcement.view");

  return (
    <>
      <PageHeader
        eyebrow="Comunicacao"
        title="Comunicados"
        description="Publique avisos e comunicados para o Portal do Membro."
      />

      <AnnouncementManager />
    </>
  );
}
