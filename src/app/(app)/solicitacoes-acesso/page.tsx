import { AccessRequestManager } from "@/components/access-requests/AccessRequestManager";
import { PageHeader } from "@/components/PageHeader";
import { hasPermission } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";

export default async function AccessRequestsPage() {
  const user = await requirePermission("accessRequest.view");

  return (
    <>
      <PageHeader
        eyebrow="Administracao"
        title="Solicitacoes de Acesso"
        description="Avalie pedidos de acesso ao Portal do Membro e vincule manualmente cada usuario ao cadastro correto."
      />

      <AccessRequestManager
        canApprove={hasPermission(user, "accessRequest.approve")}
        canReject={hasPermission(user, "accessRequest.reject")}
      />
    </>
  );
}
