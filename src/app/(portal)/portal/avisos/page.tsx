import { PageHeader } from "@/components/PageHeader";
import { PortalAnnouncementList } from "@/components/portal/PortalAnnouncementList";
import { requirePermission } from "@/lib/session";

export default async function PortalNoticesPage() {
  await requirePermission("portalAnnouncement.view");

  return (
    <>
      <PageHeader
        eyebrow="Portal do Membro"
        title="Avisos"
        description="Comunicados e avisos publicados pela igreja."
      />

      <PortalAnnouncementList />
    </>
  );
}
