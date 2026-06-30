import { PageHeader } from "@/components/PageHeader";
import { MemberMinistryManager } from "@/components/member-ministries/MemberMinistryManager";

export default function MemberMinistriesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Vinculos"
        title="Membros x Ministerios"
        description="Gerencie participacoes, funcoes, status e historico dos membros nos ministerios."
      />

      <MemberMinistryManager />
    </>
  );
}
