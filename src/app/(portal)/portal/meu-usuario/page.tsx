import { PageHeader } from "@/components/PageHeader";
import { MemberAccountManager } from "@/components/portal/MemberAccountManager";
import { requirePermission } from "@/lib/session";
import { memberAccountService } from "@/services";

export const dynamic = "force-dynamic";

export default async function PortalAccountPage() {
  const user = await requirePermission("memberAccount.view");
  const account = await memberAccountService.getAccount(user);

  return (
    <>
      <PageHeader
        eyebrow="Portal do Membro"
        title="Meu Usuario"
        description="Consulte seus dados de acesso e altere telefone, e-mail ou senha com seguranca."
      />
      <MemberAccountManager account={account} />
    </>
  );
}
