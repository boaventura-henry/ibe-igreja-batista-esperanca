"use client";

import { UserAccessRequestStatus } from "@prisma/client";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { AccessRequestDetailResult, AccessRequestListResult, AccessRequestSummary } from "@/types";

type ApiResponse<T> =
  | ({ success: true; data: T } & T)
  | { success: false; error: { code: string; message: string } };

const statusOptions = [
  { value: "", label: "Todas" },
  { value: UserAccessRequestStatus.PENDING, label: "Pendente" },
  { value: UserAccessRequestStatus.APPROVED, label: "Aprovada" },
  { value: UserAccessRequestStatus.REJECTED, label: "Rejeitada" },
  { value: UserAccessRequestStatus.CANCELED, label: "Cancelada" }
];

const sortOptions = [
  { value: "createdAt", label: "Criacao" },
  { value: "updatedAt", label: "Atualizacao" },
  { value: "name", label: "Nome" },
  { value: "username", label: "Login" },
  { value: "email", label: "E-mail" },
  { value: "status", label: "Status" }
];

const statusLabels: Record<UserAccessRequestStatus, string> = {
  PENDING: "Pendente",
  APPROVED: "Aprovada",
  REJECTED: "Rejeitada",
  CANCELED: "Cancelada"
};

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export function AccessRequestManager({ canApprove, canReject }: { canApprove: boolean; canReject: boolean }) {
  const [data, setData] = useState<AccessRequestListResult | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<AccessRequestDetailResult | null>(null);
  const [approveMemberId, setApproveMemberId] = useState("");
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [rejectRequest, setRejectRequest] = useState<AccessRequestSummary | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    sortBy: "createdAt",
    sortOrder: "desc",
    page: "1"
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });
    params.set("pageSize", "10");

    return params.toString();
  }, [filters]);

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/access-requests?${queryString}`, { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse<AccessRequestListResult>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setData(payload.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel carregar solicitacoes.");
    } finally {
      setIsLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    const timeout = window.setTimeout(loadRequests, 250);

    return () => window.clearTimeout(timeout);
  }, [loadRequests]);

  function updateFilter(name: keyof typeof filters, value: string) {
    setFilters((current) => ({
      ...current,
      [name]: value,
      page: name === "page" ? value : "1"
    }));
  }

  async function openDetails(id: string) {
    setMessage("");

    try {
      const response = await fetch(`/api/access-requests/${id}`, { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse<AccessRequestDetailResult>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setSelected(payload.data);
      setApproveMemberId(payload.data.request.possibleMember?.id ?? "");
      setMustChangePassword(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel abrir a solicitacao.");
    }
  }

  async function approve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selected) {
      return;
    }

    setMessage("");

    try {
      const response = await fetch(`/api/access-requests/${selected.request.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: approveMemberId, mustChangePassword })
      });
      const payload = (await response.json()) as ApiResponse<AccessRequestSummary>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setSelected(null);
      setMessage("Solicitacao aprovada e usuario criado.");
      await loadRequests();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel aprovar a solicitacao.");
    }
  }

  async function reject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!rejectRequest) {
      return;
    }

    setMessage("");

    try {
      const response = await fetch(`/api/access-requests/${rejectRequest.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason })
      });
      const payload = (await response.json()) as ApiResponse<AccessRequestSummary>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setRejectRequest(null);
      setRejectReason("");
      setMessage("Solicitacao rejeitada.");
      await loadRequests();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel rejeitar a solicitacao.");
    }
  }

  const pagination = data?.pagination;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-md border border-hope-100 bg-white p-4 shadow-sm lg:grid-cols-5">
        <FilterInput
          label="Pesquisa"
          value={filters.search}
          onChange={(value) => updateFilter("search", value)}
          className="lg:col-span-2"
        />
        <label className={filterLabelClass}>
          Status
          <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)} className={filterInputClass}>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className={filterLabelClass}>
          Ordenar por
          <select value={filters.sortBy} onChange={(event) => updateFilter("sortBy", event.target.value)} className={filterInputClass}>
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className={filterLabelClass}>
          Direcao
          <select value={filters.sortOrder} onChange={(event) => updateFilter("sortOrder", event.target.value)} className={filterInputClass}>
            <option value="desc">Decrescente</option>
            <option value="asc">Crescente</option>
          </select>
        </label>
      </div>

      {message ? (
        <div className="rounded-md border border-hope-100 bg-hope-50 px-4 py-3 text-sm font-semibold text-ink-800">
          {message}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-md border border-hope-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-hope-100 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-ink-900">Solicitacoes recebidas</p>
            <p className="text-xs text-ink-500">{pagination ? `${pagination.total} registro(s)` : "Carregando"}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-hope-100 text-sm">
            <thead className="bg-hope-50 text-left text-xs font-bold uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3">Solicitante</th>
                <th className="px-4 py-3">Contato</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Possivel membro</th>
                <th className="px-4 py-3">Criada em</th>
                <th className="px-4 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hope-100">
              {isLoading ? (
                <tr>
                  <td className="px-4 py-8 text-center font-semibold text-ink-500" colSpan={6}>
                    Carregando solicitacoes...
                  </td>
                </tr>
              ) : null}

              {!isLoading && data?.requests.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center font-semibold text-ink-500" colSpan={6}>
                    Nenhuma solicitacao encontrada.
                  </td>
                </tr>
              ) : null}

              {data?.requests.map((request) => (
                <tr key={request.id} className="align-top">
                  <td className="px-4 py-4">
                    <p className="font-semibold text-ink-900">{request.name}</p>
                    <p className="text-xs font-semibold text-hope-700">{request.username}</p>
                    {request.cpf ? <p className="text-xs text-ink-500">CPF {request.cpf}</p> : null}
                    {request.rg ? <p className="text-xs text-ink-500">RG {request.rg}</p> : null}
                  </td>
                  <td className="px-4 py-4 text-ink-700">
                    <p>{request.email}</p>
                    <p className="text-xs text-ink-500">{request.phone ?? "-"}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className="rounded-md bg-hope-50 px-2 py-1 text-xs font-bold text-hope-700">
                      {statusLabels[request.status]}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-ink-700">{request.possibleMember?.name ?? "-"}</td>
                  <td className="px-4 py-4 text-ink-700">{formatDate(request.createdAt)}</td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <ActionButton onClick={() => openDetails(request.id)}>Detalhes</ActionButton>
                      {canApprove && request.status === "PENDING" ? (
                        <ActionButton onClick={() => openDetails(request.id)}>Aprovar</ActionButton>
                      ) : null}
                      {canReject && request.status === "PENDING" ? (
                        <ActionButton onClick={() => setRejectRequest(request)}>Rejeitar</ActionButton>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pagination ? (
          <div className="flex flex-col gap-3 border-t border-hope-100 px-4 py-3 text-sm text-ink-600 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Pagina {pagination.page} de {pagination.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => updateFilter("page", String(pagination.page - 1))}
                className="rounded-md border border-hope-100 px-3 py-2 font-bold disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => updateFilter("page", String(pagination.page + 1))}
                className="rounded-md border border-hope-100 px-3 py-2 font-bold disabled:opacity-40"
              >
                Proxima
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-ink-900/45 px-4 py-6">
          <div className="mx-auto max-w-3xl rounded-md bg-white shadow-soft">
            <div className="flex items-start justify-between border-b border-hope-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-ink-900">Solicitacao de acesso</h2>
                <p className="text-sm text-ink-500">{selected.request.username}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-md border border-hope-100 px-3 py-2 text-sm font-bold text-ink-700">
                Fechar
              </button>
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-2">
              <Info label="Nome" value={selected.request.name} />
              <Info label="E-mail" value={selected.request.email ?? "-"} />
              <Info label="Telefone" value={selected.request.phone ?? "-"} />
              <Info label="CPF" value={selected.request.cpf ?? "-"} />
              <Info label="RG" value={selected.request.rg ?? "-"} />
              <Info label="Nascimento" value={selected.request.birthDate ? formatDate(selected.request.birthDate) : "-"} />
              <Info label="Status" value={statusLabels[selected.request.status]} />
              <Info label="Possivel membro" value={selected.request.possibleMember?.name ?? "-"} className="md:col-span-2" />
            </div>

            <div className="border-t border-hope-100 p-5">
              <h3 className="text-sm font-bold text-ink-900">Possiveis correspondencias</h3>
              <div className="mt-3 grid gap-3">
                {selected.matches.length === 0 ? (
                  <p className="rounded-md bg-hope-50 px-3 py-2 text-sm font-semibold text-ink-600">
                    Nenhuma correspondencia encontrada.
                  </p>
                ) : null}
                {selected.matches.map((match) => (
                  <div key={match.member.id} className="rounded-md border border-hope-100 p-3 text-sm">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-bold text-ink-900">{match.member.name}</p>
                      <span className="rounded-md bg-hope-50 px-2 py-1 text-xs font-bold text-hope-700">
                        {match.score}% - {match.confidence}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-semibold text-ink-500">
                      {match.criteria.length > 0 ? match.criteria.join(", ") : "Sem criterios fortes."}
                    </p>
                    <p className="mt-1 text-xs text-ink-500">{match.recommendation}</p>
                  </div>
                ))}
              </div>
            </div>

            {canApprove && selected.request.status === "PENDING" ? (
              <form onSubmit={approve} className="border-t border-hope-100 p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Membro aprovado">
                    <select required value={approveMemberId} onChange={(event) => setApproveMemberId(event.target.value)} className={filterInputClass}>
                      <option value="">Selecione</option>
                      {selected.members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name} {member.email ? `- ${member.email}` : ""}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <label className="flex items-center gap-2 text-sm font-bold text-ink-700">
                    <input type="checkbox" checked={mustChangePassword} onChange={(event) => setMustChangePassword(event.target.checked)} />
                    Exigir troca de senha no primeiro acesso
                  </label>
                </div>
                <div className="mt-4 flex justify-end">
                  <button type="submit" className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white">
                    Aprovar e criar usuario
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}

      {rejectRequest ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/45 px-4">
          <div className="w-full max-w-md rounded-md bg-white shadow-soft">
            <form onSubmit={reject}>
              <div className="border-b border-hope-100 px-5 py-4">
                <h2 className="text-lg font-bold text-ink-900">Rejeitar solicitacao</h2>
                <p className="text-sm text-ink-500">{rejectRequest.username}</p>
              </div>
              <div className="p-5">
                <Field label="Motivo">
                  <textarea
                    required
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                    className={`${filterInputClass} min-h-28`}
                  />
                </Field>
              </div>
              <div className="flex justify-end gap-3 border-t border-hope-100 px-5 py-4">
                <button type="button" onClick={() => setRejectRequest(null)} className="rounded-md border border-hope-100 px-4 py-2 text-sm font-bold text-ink-700">
                  Cancelar
                </button>
                <button type="submit" className="rounded-md bg-red-600 px-4 py-2 text-sm font-bold text-white">
                  Rejeitar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const filterLabelClass = "grid gap-1 text-xs font-bold uppercase tracking-wide text-ink-500";
const filterInputClass =
  "w-full rounded-md border border-hope-100 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-ink-800 outline-none transition focus:border-hope-500 focus:ring-2 focus:ring-hope-100";

function FilterInput({
  label,
  value,
  onChange,
  className = ""
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={`${filterLabelClass} ${className}`}>
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} className={filterInputClass} />
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className={filterLabelClass}>
      {label}
      {children}
    </label>
  );
}

function Info({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs font-bold uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink-800">{value}</p>
    </div>
  );
}

function ActionButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-hope-100 px-3 py-2 text-xs font-bold text-ink-700 hover:bg-hope-50"
    >
      {children}
    </button>
  );
}
