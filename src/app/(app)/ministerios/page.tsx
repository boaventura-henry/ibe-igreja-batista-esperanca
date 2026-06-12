import { PageHeader } from "@/components/PageHeader";

const ministries = [
  { name: "Louvor", leader: "Pr. Rafael", members: 18 },
  { name: "Ensino", leader: "Daniela Rocha", members: 11 },
  { name: "Acao Social", leader: "Beatriz Lima", members: 24 }
];

export default function MinistriesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Servir"
        title="Ministerios"
        description="Acompanhe equipes, liderancas e frentes de servico da igreja."
        action={<button className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white">Novo ministerio</button>}
      />

      <section className="grid gap-4 md:grid-cols-3">
        {ministries.map((ministry) => (
          <article key={ministry.name} className="rounded-md border border-hope-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-hope-700">Ministerio</p>
            <h2 className="mt-2 text-xl font-bold text-ink-900">{ministry.name}</h2>
            <p className="mt-3 text-sm text-ink-500">Lider: {ministry.leader}</p>
            <p className="mt-1 text-sm text-ink-500">{ministry.members} membros vinculados</p>
          </article>
        ))}
      </section>
    </>
  );
}
