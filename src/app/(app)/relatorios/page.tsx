import { PageHeader } from "@/components/PageHeader";
import { ReportCatalog } from "@/components/reports/ReportCatalog";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  await requirePermission("report.view");

  return (
    <>
      <PageHeader
        eyebrow="Relatorios"
        title="Relatorios"
        description="Visualize, imprima e exporte relatorios operacionais do sistema."
      />

      <ReportCatalog />
    </>
  );
}
