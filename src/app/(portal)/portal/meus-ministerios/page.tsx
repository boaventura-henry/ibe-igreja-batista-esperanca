import { PageHeader } from "@/components/PageHeader";
import { MemberLinkRequired } from "@/components/portal/MemberLinkRequired";
import { requirePermission } from "@/lib/session";
import { memberPortalService } from "@/services";

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value));
}

export default async function PortalMinistriesPage() {
  const user = await requirePermission("memberPortal.view");
  const ministries = user.memberId ? await memberPortalService.listMinistries(user) : [];

  return (
    <>
      <PageHeader
        eyebrow="Portal do Membro"
        title="Meus Ministerios"
        description="Veja seus vinculos ministeriais, funcoes e liderancas."
      />

      {!user.memberId ? (
        <MemberLinkRequired />
      ) : (
        <section className="overflow-hidden rounded-md border border-hope-100 bg-white shadow-sm">
          <div className="border-b border-hope-100 px-4 py-3">
            <p className="text-sm font-bold text-ink-900">{ministries.length} ministerio(s)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-hope-100 text-sm">
              <thead className="bg-hope-50 text-left text-xs font-bold uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-3">Ministerio</th>
                  <th className="px-4 py-3">Funcao</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Entrada</th>
                  <th className="px-4 py-3">Saida</th>
                  <th className="px-4 py-3">Lider</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hope-100">
                {ministries.length === 0 ? (
                  <tr><td className="px-4 py-8 text-center font-semibold text-ink-500" colSpan={6}>Nenhum ministerio vinculado.</td></tr>
                ) : null}
                {ministries.map((link) => (
                  <tr key={link.id}>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded" style={{ backgroundColor: link.ministry.color }} />
                        <span className="font-semibold text-ink-900">{link.ministry.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-ink-700">{link.role}</td>
                    <td className="px-4 py-4 text-ink-700">{link.status}</td>
                    <td className="px-4 py-4 text-ink-700">{formatDate(link.entryDate)}</td>
                    <td className="px-4 py-4 text-ink-700">{formatDate(link.exitDate)}</td>
                    <td className="px-4 py-4 text-ink-700">{link.ministry.leader?.name ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
