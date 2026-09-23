import { FinancialEntryManager } from "@/components/financial/FinancialEntryManager";
import { PageHeader } from "@/components/PageHeader";
import { requireAnyPermission } from "@/lib/session";

export default async function FinancialEntriesPage() {
  await requireAnyPermission(["financialEntry.view", "ministryFinance.view"]);

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
