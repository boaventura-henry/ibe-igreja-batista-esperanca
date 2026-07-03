import { FinancialEntryManager } from "@/components/financial/FinancialEntryManager";
import { PageHeader } from "@/components/PageHeader";
import { requirePermission } from "@/lib/session";

export default async function FinancialEntriesPage() {
  await requirePermission("financialEntry.view");

  return (
    <>
      <PageHeader
        eyebrow="Financeiro"
        title="Lancamentos"
        description="Registre entradas, saidas, cancelamentos e vinculos financeiros."
      />
      <FinancialEntryManager />
    </>
  );
}
