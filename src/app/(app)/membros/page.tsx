import { PageHeader } from "@/components/PageHeader";
import { MemberManager } from "@/components/members/MemberManager";

export default function MembersPage() {
  return (
    <>
      <PageHeader
        eyebrow="Cadastro"
        title="Membros"
        description="Organize dados pastorais e contatos da membresia sem armazenar informacoes no navegador."
      />

      <MemberManager />
    </>
  );
}
