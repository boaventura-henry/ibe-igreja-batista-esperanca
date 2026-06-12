import { PageHeader } from "@/components/PageHeader";

const members = [
  { name: "Ana Martins", status: "Ativo", phone: "(11) 90000-1001", ministry: "Louvor" },
  { name: "Carlos Souza", status: "Ativo", phone: "(11) 90000-1002", ministry: "Diaconia" },
  { name: "Marina Alves", status: "Visitante", phone: "(11) 90000-1003", ministry: "Integracao" }
];

export default function MembersPage() {
  return (
    <>
      <PageHeader
        eyebrow="Cadastro"
        title="Membros"
        description="Organize dados pastorais e contatos da membresia sem armazenar informacoes no navegador."
        action={<button className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white">Novo membro</button>}
      />

      <div className="overflow-hidden rounded-md border border-hope-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-hope-100 text-sm">
            <thead className="bg-hope-50 text-left text-xs font-bold uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="px-4 py-3">Ministerio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hope-100">
              {members.map((member) => (
                <tr key={member.name}>
                  <td className="px-4 py-4 font-semibold text-ink-900">{member.name}</td>
                  <td className="px-4 py-4 text-ink-700">{member.status}</td>
                  <td className="px-4 py-4 text-ink-700">{member.phone}</td>
                  <td className="px-4 py-4 text-ink-700">{member.ministry}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
