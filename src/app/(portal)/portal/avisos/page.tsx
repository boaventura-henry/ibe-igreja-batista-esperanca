import { PageHeader } from "@/components/PageHeader";
import { requirePermission } from "@/lib/session";

export default async function PortalNoticesPage() {
  await requirePermission("memberPortal.view");

  return (
    <>
      <PageHeader
        eyebrow="Portal do Membro"
        title="Avisos"
        description="Comunicados e avisos internos ficarao concentrados aqui."
      />

      <div className="rounded-md border border-hope-100 bg-white p-6 text-sm font-semibold text-ink-700 shadow-sm">
        Avisos estarao disponiveis em breve.
      </div>
    </>
  );
}
