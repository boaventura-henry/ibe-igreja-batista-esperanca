import { PageHeader } from "@/components/PageHeader";
import { PasswordResetRequestManager } from "@/components/password-reset-requests/PasswordResetRequestManager";
import { hasPermission } from "@/lib/permissions";
import { requirePermission } from "@/lib/session";

export default async function PasswordResetRequestsPage() {
  const user = await requirePermission("passwordResetRequest.view");

  return (
    <>
      <PageHeader
        eyebrow="Seguranca"
        title="Recuperacao de Senha"
        description="Avalie solicitacoes publicas de recuperacao e gere senhas temporarias de uso unico."
      />

      <PasswordResetRequestManager
        canApprove={hasPermission(user, "passwordResetRequest.approve")}
        canReject={hasPermission(user, "passwordResetRequest.reject")}
      />
    </>
  );
}
