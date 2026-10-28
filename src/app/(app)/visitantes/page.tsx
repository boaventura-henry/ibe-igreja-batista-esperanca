import { PageHeader } from "@/components/PageHeader";
import { VisitorManager } from "@/components/visitors/VisitorManager";
import { requirePermission } from "@/lib/session";

export default async function VisitorsPage() {
  await requirePermission("visitor.view");
  return (
    <>
      <PageHeader eyebrow="Cadastro" title="Visitantes" description="Consulte visitantes, visitas registradas e evidências de privacidade." />
      <VisitorManager />
    </>
  );
}
