import { PageHeader } from "@/components/PageHeader";
import { MinistryManager } from "@/components/ministries/MinistryManager";

export default function MinistriesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Servir"
        title="Ministerios"
        description="Acompanhe equipes, liderancas e frentes de servico da igreja."
      />

      <MinistryManager />
    </>
  );
}
