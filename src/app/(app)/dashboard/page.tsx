import { PageHeader } from "@/components/PageHeader";
import { AdminDashboard } from "@/components/dashboard/AdminDashboard";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requirePermission("dashboard.admin.view");

  return (
    <>
      <PageHeader
        eyebrow="Visao geral"
        title="Dashboard"
        description="Acompanhe os principais indicadores administrativos da igreja."
      />

      <AdminDashboard />
    </>
  );
}
