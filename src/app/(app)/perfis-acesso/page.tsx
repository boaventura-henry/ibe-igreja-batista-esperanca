import { AccessRoleManager } from "@/components/access-roles/AccessRoleManager";
import { PageHeader } from "@/components/PageHeader";

export default function AccessRolesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Administracao"
        title="Perfis de Acesso"
        description="Configure funcoes e permissoes usadas no controle de acesso do sistema."
      />

      <AccessRoleManager />
    </>
  );
}
