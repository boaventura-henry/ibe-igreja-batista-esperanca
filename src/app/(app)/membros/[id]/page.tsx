import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { AppError } from "@/lib/errors";
import { memberService } from "@/services";
import { formatCep, formatCpf, formatPhone } from "@/utils";

export const dynamic = "force-dynamic";

type MemberProfilePageProps = {
  params: Promise<{ id: string }>;
};

const statusLabels: Record<string, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  VISITOR: "Visitante",
  TRANSFERRED: "Transferido",
  DECEASED: "Falecido"
};

const sexLabels: Record<string, string> = {
  FEMALE: "Feminino",
  MALE: "Masculino",
  OTHER: "Outro",
  NOT_INFORMED: "Nao informado"
};

const memberMinistryRoleLabels: Record<string, string> = {
  LEADER: "Lider",
  VICE_LEADER: "Vice-lider",
  SECRETARY: "Secretario",
  TREASURER: "Tesoureiro",
  VOLUNTEER: "Voluntario",
  MEMBER: "Membro"
};

const memberMinistryStatusLabels: Record<string, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  TRANSFERRED: "Transferido",
  REMOVED: "Removido",
  LEFT: "Saiu"
};

const scheduleRoleLabels: Record<string, string> = {
  LEADER: "Lider",
  VOCAL: "Vocal",
  INSTRUMENT: "Instrumento",
  MEDIA: "Midia",
  RECEPTION: "Recepcao",
  CHILDREN: "Infantil",
  SUPPORT: "Apoio",
  OTHER: "Outro"
};

const scheduleMemberStatusLabels: Record<string, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  DECLINED: "Recusou",
  REPLACED: "Substituido",
  ABSENT: "Ausente"
};

function display(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value : "-";
}

function displayDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value));
}

export default async function MemberProfilePage({ params }: MemberProfilePageProps) {
  const { id } = await params;

  try {
    const member = await memberService.getById(id);
    const address = [
      member.street,
      member.number,
      member.complement,
      member.district,
      member.city,
      member.state
    ]
      .filter(Boolean)
      .join(", ");

    return (
      <>
        <PageHeader
          eyebrow="Perfil do membro"
          title={member.name}
          description="Dados pessoais, ministerios, contribuicoes e historico do cadastro."
          action={
            <Link
              href="/membros"
              className="rounded-md border border-hope-100 px-4 py-2 text-sm font-bold text-ink-700 hover:bg-hope-50"
            >
              Voltar
            </Link>
          }
        />

        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-4">
            <div className="rounded-md border border-hope-100 bg-white p-4 shadow-sm">
              {member.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={member.photoUrl} alt="" className="aspect-square w-full rounded-md object-cover" />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center rounded-md bg-hope-100 text-5xl font-bold text-hope-700">
                  {member.name
                    .split(" ")
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")
                    .toUpperCase()}
                </div>
              )}
              <div className="mt-4">
                <p className="text-lg font-bold text-ink-900">{member.name}</p>
                <p className="text-sm text-ink-500">{statusLabels[member.status]}</p>
              </div>
            </div>

            <InfoSection
              title="Ministerios"
              action={
                <Link
                  href={`/membros-ministerios?memberId=${member.id}`}
                  className="rounded-md border border-hope-100 px-3 py-2 text-xs font-bold text-ink-700 hover:bg-hope-50"
                >
                  Gerenciar
                </Link>
              }
            >
              {member.ministries.length > 0 ? (
                <div className="space-y-3">
                  {member.ministries.map((ministry) => (
                    <div key={`${ministry.id}-${ministry.entryDate}`} className="rounded-md border border-hope-100 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-ink-900">{ministry.name}</p>
                          <p className="text-xs font-semibold text-ink-500">
                            {memberMinistryRoleLabels[ministry.role]} - {memberMinistryStatusLabels[ministry.status]}
                          </p>
                        </div>
                        <span className="rounded-md bg-hope-50 px-2 py-1 text-xs font-bold text-hope-700">
                          {memberMinistryStatusLabels[ministry.status]}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-ink-600">
                        Entrada: {displayDate(ministry.entryDate)}
                        {ministry.exitDate ? ` | Saida: ${displayDate(ministry.exitDate)}` : " | Em andamento"}
                      </p>
                      {ministry.observations ? (
                        <p className="mt-2 text-xs text-ink-500">{ministry.observations}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-ink-500">Nenhum ministerio vinculado.</p>
              )}
            </InfoSection>

            <InfoSection title="Acesso ao sistema">
              {member.user ? (
                <InfoGrid
                  items={[
                    ["Usuario", member.user.email],
                    ["Perfil", member.user.accessRole?.name],
                    [
                      "Status",
                      member.user.lockedUntil && new Date(member.user.lockedUntil) > new Date()
                        ? "Bloqueado"
                        : member.user.isActive
                          ? "Ativo"
                          : "Inativo"
                    ]
                  ]}
                />
              ) : (
                <p className="text-sm text-ink-500">Este membro nao possui usuario de acesso.</p>
              )}
            </InfoSection>
          </aside>

          <div className="space-y-5">
            <InfoSection title="Dados pessoais">
              <InfoGrid
                items={[
                  ["CPF", formatCpf(member.cpf)],
                  ["RG", member.rg],
                  ["Nascimento", displayDate(member.birthDate)],
                  ["Sexo", sexLabels[member.sex]],
                  ["Estado civil", member.maritalStatus],
                  ["Situacao", statusLabels[member.status]]
                ]}
              />
            </InfoSection>

            <InfoSection title="Contato e endereco">
              <InfoGrid
                items={[
                  ["Telefone", formatPhone(member.phone)],
                  ["Celular", formatPhone(member.mobilePhone)],
                  ["WhatsApp", formatPhone(member.whatsapp)],
                  ["E-mail", member.email],
                  ["CEP", formatCep(member.zipCode)],
                  ["Endereco", address]
                ]}
              />
            </InfoSection>

            <InfoSection title="Vida na igreja">
              <InfoGrid
                items={[
                  ["Batismo", displayDate(member.baptismDate)],
                  ["Ingresso", displayDate(member.joinedAt)],
                  ["Observacoes", member.notes]
                ]}
              />
            </InfoSection>

            <InfoSection title="Contribuicoes">
              {member.donations.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-hope-100 text-sm">
                    <thead className="text-left text-xs font-bold uppercase tracking-wide text-ink-500">
                      <tr>
                        <th className="py-2 pr-4">Data</th>
                        <th className="py-2 pr-4">Tipo</th>
                        <th className="py-2 pr-4">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hope-100">
                      {member.donations.map((donation) => (
                        <tr key={donation.id}>
                          <td className="py-3 pr-4 text-ink-700">{displayDate(donation.donatedAt)}</td>
                          <td className="py-3 pr-4 text-ink-700">{donation.type}</td>
                          <td className="py-3 pr-4 font-semibold text-ink-900">
                            {Number(donation.amount).toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL"
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-ink-500">Nenhuma contribuicao registrada.</p>
              )}
            </InfoSection>

            <InfoSection title="Escalas">
              {member.schedules.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-hope-100 text-sm">
                    <thead className="text-left text-xs font-bold uppercase tracking-wide text-ink-500">
                      <tr>
                        <th className="py-2 pr-4">Data</th>
                        <th className="py-2 pr-4">Escala</th>
                        <th className="py-2 pr-4">Ministerio</th>
                        <th className="py-2 pr-4">Funcao</th>
                        <th className="py-2 pr-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hope-100">
                      {member.schedules.map((item) => (
                        <tr key={item.id}>
                          <td className="py-3 pr-4 text-ink-700">{displayDate(item.schedule.date)}</td>
                          <td className="py-3 pr-4">
                            <Link href={`/escalas/${item.schedule.id}`} className="font-semibold text-hope-700 hover:text-hope-900">
                              {item.schedule.title}
                            </Link>
                          </td>
                          <td className="py-3 pr-4 text-ink-700">{item.schedule.ministry.name}</td>
                          <td className="py-3 pr-4 text-ink-700">{scheduleRoleLabels[item.role]}</td>
                          <td className="py-3 pr-4 text-ink-700">{scheduleMemberStatusLabels[item.status]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-ink-500">Nenhuma escala encontrada para este membro.</p>
              )}
            </InfoSection>

            <InfoSection title="Historico">
              <InfoGrid
                items={[
                  ["Criado em", displayDate(member.createdAt)],
                  ["Criado por", member.createdBy?.name],
                  ["Alterado em", displayDate(member.updatedAt)],
                  ["Alterado por", member.updatedBy?.name]
                ]}
              />
            </InfoSection>

            <InfoSection title="Eventos">
              <p className="text-sm text-ink-500">Vinculo de membros com eventos sera preparado em uma fase futura.</p>
            </InfoSection>
          </div>
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 404) {
      notFound();
    }

    throw error;
  }
}

function InfoSection({
  title,
  children,
  action
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-hope-100 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-500">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function InfoGrid({ items }: { items: Array<[string, string | null | undefined]> }) {
  return (
    <dl className="grid gap-4 md:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs font-bold uppercase tracking-wide text-ink-500">{label}</dt>
          <dd className="mt-1 text-sm font-semibold text-ink-900">{display(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
