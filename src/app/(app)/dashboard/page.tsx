import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";

const nextEvents = [
  { title: "Culto de Celebracao", date: "Domingo, 19h", ministry: "Louvor" },
  { title: "Estudo Biblico", date: "Quarta, 20h", ministry: "Ensino" },
  { title: "Acao Social", date: "Sabado, 9h", ministry: "Missao" }
];

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        eyebrow="Visao geral"
        title="Dashboard"
        description="Acompanhe os principais indicadores da igreja em uma area administrativa responsiva."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Membros ativos" value="128" detail="+8 novos neste trimestre" />
        <StatCard label="Ministerios" value="12" detail="9 com lideranca definida" />
        <StatCard label="Eventos do mes" value="18" detail="3 eventos esta semana" />
        <StatCard label="Contribuicoes" value="R$ 24,8k" detail="Resumo mensal previsto" />
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-md border border-hope-100 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-ink-900">Proximos eventos</h2>
          <div className="mt-4 divide-y divide-hope-100">
            {nextEvents.map((event) => (
              <div key={event.title} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-ink-900">{event.title}</p>
                  <p className="text-sm text-ink-500">{event.ministry}</p>
                </div>
                <span className="text-sm font-semibold text-hope-700">{event.date}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-hope-100 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-ink-900">Status da implantacao</h2>
          <ul className="mt-4 grid gap-3 text-sm text-ink-700">
            <li className="rounded-md bg-hope-50 px-3 py-2">Prisma configurado para PostgreSQL Neon</li>
            <li className="rounded-md bg-hope-50 px-3 py-2">Variaveis sensiveis fora do codigo</li>
            <li className="rounded-md bg-hope-50 px-3 py-2">Layout pronto para desktop e mobile</li>
          </ul>
        </div>
      </section>
    </>
  );
}
