import { MemberContributionManager } from "@/components/portal/MemberContributionManager";
import { PageHeader } from "@/components/PageHeader";
import { requirePermission } from "@/lib/session";

export default async function PortalContributionsPage() {
  await requirePermission("memberContribution.view");

  return (
    <>
      <PageHeader
        eyebrow="Portal do Membro"
        title="Minhas Contribuicoes"
        description="Acompanhe seus lancamentos confirmados exibidos pela igreja."
      />
      <MemberContributionManager />
    </>
  );
}
