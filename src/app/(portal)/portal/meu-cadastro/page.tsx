import { PageHeader } from "@/components/PageHeader";
import { MemberLinkRequired } from "@/components/portal/MemberLinkRequired";
import { MemberProfileForm } from "@/components/portal/MemberProfileForm";
import { requirePermission } from "@/lib/session";
import { memberPortalService } from "@/services";

export const dynamic = "force-dynamic";

export default async function PortalProfilePage() {
  const user = await requirePermission("memberPortal.view");

  return (
    <>
      <PageHeader
        eyebrow="Portal do Membro"
        title="Meu Cadastro"
        description="Atualize seus dados de contato e endereco. Dados administrativos permanecem protegidos."
      />

      {!user.memberId ? <MemberLinkRequired /> : <MemberProfileForm profile={await memberPortalService.getProfile(user)} />}
    </>
  );
}
