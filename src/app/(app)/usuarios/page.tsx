import { PageHeader } from "@/components/PageHeader";
import { UserManager } from "@/components/users/UserManager";
import { requireCurrentUser } from "@/lib/session";

export default async function UsersPage() {
  const user = await requireCurrentUser();
  return (
    <>
      <PageHeader
        eyebrow="Administracao"
        title="Usuarios"
        description="Gerencie acessos, perfis, vinculos com membros e seguranca de login."
      />

      <UserManager canManageMinistryFinance={user.permissionCodes.includes("ministryFinance.access.manage")} />
    </>
  );
}
