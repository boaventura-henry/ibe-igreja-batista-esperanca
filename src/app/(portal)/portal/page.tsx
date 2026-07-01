import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { MemberLinkRequired } from "@/components/portal/MemberLinkRequired";
import { requirePermission } from "@/lib/session";
import { memberPortalService } from "@/services";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value));
}

export default async function PortalHomePage() {
  const user = await requirePermission("memberPortal.view");
  const dashboard = await memberPortalService.getDashboard(user);

  return (
    <>
      <PageHeader
        eyebrow="Portal do Membro"
        title={dashboard.member ? `Ola, ${dashboard.member.name}` : "Portal do Membro"}
        description="Acompanhe suas escalas, seus ministerios e mantenha seus dados de contato atualizados."
      />

      {!dashboard.member ? (
        <MemberLinkRequired />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <section className="rounded-md border border-hope-100 bg-white p-4 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between gap-3 border-b border-hope-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-ink-900">Proximas escalas</h2>
                <p className="text-xs text-ink-500">{dashboard.nextSchedules.length} compromisso(s)</p>
              </div>
              <Link href="/portal/minhas-escalas" className="rounded-md border border-hope-100 px-3 py-2 text-xs font-bold text-ink-700">Ver todas</Link>
            </div>
            <div className="mt-3 grid gap-3">
              {dashboard.nextSchedules.length === 0 ? <p className="text-sm font-semibold text-ink-500">Nenhuma escala futura encontrada.</p> : null}
              {dashboard.nextSchedules.map((schedule) => (
                <div key={schedule.id} className="rounded-md border border-hope-100 p-3">
                  <p className="text-sm font-bold text-ink-900">{schedule.title}</p>
                  <p className="text-xs text-ink-500">{formatDate(schedule.date)} - {[schedule.startTime, schedule.endTime].filter(Boolean).join(" - ") || "Horario nao informado"}</p>
                  <p className="mt-1 text-xs font-semibold text-hope-700">{schedule.ministry.name}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-md border border-hope-100 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-ink-900">Atalhos</h2>
            <div className="mt-3 grid gap-2">
              <Link href="/portal/minhas-escalas" className="rounded-md border border-hope-100 px-3 py-3 text-sm font-bold text-ink-700">Minhas Escalas</Link>
              <Link href="/portal/meu-cadastro" className="rounded-md border border-hope-100 px-3 py-3 text-sm font-bold text-ink-700">Meu Cadastro</Link>
              <Link href="/portal/meus-ministerios" className="rounded-md border border-hope-100 px-3 py-3 text-sm font-bold text-ink-700">Meus Ministerios</Link>
            </div>
          </section>

          <section className="rounded-md border border-hope-100 bg-white p-4 shadow-sm lg:col-span-3">
            <div className="flex items-center justify-between gap-3 border-b border-hope-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-ink-900">Ministerios</h2>
                <p className="text-xs text-ink-500">{dashboard.ministries.length} vinculo(s)</p>
              </div>
              <Link href="/portal/meus-ministerios" className="rounded-md border border-hope-100 px-3 py-2 text-xs font-bold text-ink-700">Ver detalhes</Link>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {dashboard.ministries.length === 0 ? <p className="text-sm font-semibold text-ink-500">Nenhum ministerio vinculado.</p> : null}
              {dashboard.ministries.slice(0, 4).map((link) => (
                <div key={link.id} className="flex items-center gap-3 rounded-md border border-hope-100 p-3">
                  <span className="h-3 w-3 rounded" style={{ backgroundColor: link.ministry.color }} />
                  <div>
                    <p className="text-sm font-bold text-ink-900">{link.ministry.name}</p>
                    <p className="text-xs text-ink-500">{link.role} - {link.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
