import { FinancialClosingManager } from "@/components/financial/FinancialClosingManager";
import { PageHeader } from "@/components/PageHeader";
import { requirePermission } from "@/lib/session";

export default async function FinancialClosingsPage() {
  await requirePermission("financialClosing.view");

  return (
    <>
      <PageHeader
        eyebrow="Financeiro"
        title="Fechamentos"
        description="Controle saldos de abertura e fechamento por data."
      />
      <FinancialClosingManager />
    </>
  );
}
