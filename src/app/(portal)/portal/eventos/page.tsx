import { PageHeader } from "@/components/PageHeader";
import { requirePermission } from "@/lib/session";

export default async function PortalEventsPage() {
  await requirePermission("memberPortal.view");

  return (
    <>
      <PageHeader
        eyebrow="Portal do Membro"
        title="Eventos"
        description="Acompanhe os eventos da igreja quando esta area estiver ativa."
      />

      <div className="rounded-md border border-hope-100 bg-white p-6 text-sm font-semibold text-ink-700 shadow-sm">
        Eventos estarao disponiveis em breve.
      </div>
    </>
  );
}
