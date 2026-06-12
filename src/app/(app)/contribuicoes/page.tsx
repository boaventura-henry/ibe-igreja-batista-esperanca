import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";

const donations = [
  { member: "Ana Martins", type: "Dizimo", amount: "R$ 450,00", date: "05/06/2026" },
  { member: "Carlos Souza", type: "Oferta", amount: "R$ 120,00", date: "06/06/2026" },
  { member: "Comunidade", type: "Campanha", amount: "R$ 2.800,00", date: "08/06/2026" }
];

export default function DonationsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Financeiro"
        title="Contribuicoes e dizimos"
        description="Base inicial para registro financeiro com Prisma Decimal e variaveis de ambiente para PostgreSQL."
        action={<button className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white">Novo registro</button>}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total do mes" value="R$ 24,8k" detail="Lancamentos demonstrativos" />
        <StatCard label="Dizimos" value="R$ 18,4k" detail="74% do total" />
        <StatCard label="Ofertas" value="R$ 6,4k" detail="Inclui campanhas" />
      </section>

      <div className="mt-6 overflow-hidden rounded-md border border-hope-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-hope-100 text-sm">
            <thead className="bg-hope-50 text-left text-xs font-bold uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3">Contribuinte</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hope-100">
              {donations.map((donation) => (
                <tr key={`${donation.member}-${donation.date}`}>
                  <td className="px-4 py-4 font-semibold text-ink-900">{donation.member}</td>
                  <td className="px-4 py-4 text-ink-700">{donation.type}</td>
                  <td className="px-4 py-4 text-ink-700">{donation.amount}</td>
                  <td className="px-4 py-4 text-ink-700">{donation.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
