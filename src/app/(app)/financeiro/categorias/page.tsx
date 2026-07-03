import { FinancialCategoryManager } from "@/components/financial/FinancialCategoryManager";
import { PageHeader } from "@/components/PageHeader";
import { requirePermission } from "@/lib/session";

export default async function FinancialCategoriesPage() {
  await requirePermission("financialCategory.view");

  return (
    <>
      <PageHeader
        eyebrow="Financeiro"
        title="Categorias"
        description="Organize categorias de entradas e saidas financeiras."
      />
      <FinancialCategoryManager />
    </>
  );
}
