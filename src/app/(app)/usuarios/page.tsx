import { PageHeader } from "@/components/PageHeader";
import { UserManager } from "@/components/users/UserManager";

export default function UsersPage() {
  return (
    <>
      <PageHeader
        eyebrow="Administracao"
        title="Usuarios"
        description="Gerencie acessos, perfis, vinculos com membros e seguranca de login."
      />

      <UserManager />
    </>
  );
}
