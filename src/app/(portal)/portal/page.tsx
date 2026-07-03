import { PageHeader } from "@/components/PageHeader";
import { PortalDashboard } from "@/components/portal/PortalDashboard";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PortalHomePage() {
  await requirePermission("dashboard.portal.view");

  return (
    <>
      <PageHeader
        eyebrow="Portal do Membro"
        title="Portal do Membro"
        description="Acompanhe sua proxima escala, o proximo evento publico e os avisos da igreja."
      />

      <PortalDashboard />
    </>
  );
}
