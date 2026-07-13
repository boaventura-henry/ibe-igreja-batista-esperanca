"use client";

import { PasswordResetRequestStatus } from "@prisma/client";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { FormMessage } from "@/components/ui/FormMessage";
import type {
  PasswordResetApprovalResult,
  PasswordResetRequestListResult,
  PasswordResetRequestSummary
} from "@/types";

type ApiResponse<T> =
  | ({ success: true; data: T } & T)
  | { success: false; error: { code: string; message: string } };

const statusOptions = [
  { value: "", label: "Todas" },
  { value: PasswordResetRequestStatus.PENDING, label: "Pendente" },
  { value: PasswordResetRequestStatus.COMPLETED, label: "Concluida" },
  { value: PasswordResetRequestStatus.REJECTED, label: "Rejeitada" },
  { value: PasswordResetRequestStatus.CANCELED, label: "Cancelada" }
];

const sortOptions = [
  { value: "createdAt", label: "Criacao" },
  { value: "updatedAt", label: "Atualizacao" },
  { value: "identifier", label: "Identificador" },
  { value: "status", label: "Status" }
];

const statusLabels: Record<PasswordResetRequestStatus, string> = {
  PENDING: "Pendente",
  COMPLETED: "Concluida",
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

function maskEmail(value: string | null) {
  if (!value) return "-";
  const [name, domain] = value.split("@");

  if (!domain) return "***";

  return `${name.slice(0, 2)}***@${domain}`;
}

export function PasswordResetRequestManager({
  canApprove,
  canReject
}: {
  canApprove: boolean;
  canReject: boolean;
}) {
  const [data, setData] = useState<PasswordResetRequestListResult | null>(null);
  const [message, setMessage] = useState("");
  const [rejectMessage, setRejectMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [temporaryPasswordUser, setTemporaryPasswordUser] = useState("");
  const [temporaryPasswordMessage, setTemporaryPasswordMessage] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<PasswordResetRequestSummary | null>(null);
  const [rejectRequest, setRejectRequest] = useState<PasswordResetRequestSummary | null>(null);
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
      const response = await fetch(`/api/password-reset-requests?${queryString}`, { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse<PasswordResetRequestListResult>;

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

  async function approve(request: PasswordResetRequestSummary) {
    setMessage("");

    try {
      const response = await fetch(`/api/password-reset-requests/${request.id}/approve`, { method: "POST" });
      const payload = (await response.json()) as ApiResponse<PasswordResetApprovalResult>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setTemporaryPassword(payload.data.temporaryPassword);
      setTemporaryPasswordUser(payload.data.request.user?.name ?? request.identifier);
      setTemporaryPasswordMessage("");
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

    setRejectMessage("");

    try {
      const response = await fetch(`/api/password-reset-requests/${rejectRequest.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason })
      });
      const payload = (await response.json()) as ApiResponse<PasswordResetRequestSummary>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setRejectRequest(null);
      setRejectReason("");
      setMessage("Solicitacao rejeitada.");
      await loadRequests();
    } catch (error) {
      setRejectMessage(error instanceof Error ? error.message : "Nao foi possivel rejeitar a solicitacao.");
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
        <div className="border-b border-hope-100 px-4 py-3">
          <p className="text-sm font-bold text-ink-900">Solicitacoes de recuperacao</p>
          <p className="text-xs text-ink-500">{pagination ? `${pagination.total} registro(s)` : "Carregando"}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-hope-100 text-sm">
            <thead className="bg-hope-50 text-left text-xs font-bold uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3">Solicitante</th>
                <th className="px-4 py-3">Usuario vinculado</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Tratada em</th>
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
                    <p className="font-semibold text-ink-900">{request.name ?? "Nao informado"}</p>
                    <p className="text-xs font-semibold text-hope-700">{request.identifier}</p>
                    {request.email ? <p className="text-xs text-ink-500">{maskEmail(request.email)}</p> : null}
                    {request.phone ? <p className="text-xs text-ink-500">Contato {request.phone}</p> : null}
                  </td>
                  <td className="px-4 py-4 text-ink-700">
                    {request.user ? (
                      <>
                        <p className="font-semibold">{request.user.name}</p>
                        <p className="text-xs text-ink-500">{request.user.username}</p>
                      </>
                    ) : (
                      <span className="text-xs font-semibold text-red-600">Sem usuario localizado</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className="rounded-md bg-hope-50 px-2 py-1 text-xs font-bold text-hope-700">
                      {statusLabels[request.status]}
                    </span>
                    {request.rejectionReason ? (
                      <p className="mt-2 max-w-xs text-xs text-ink-500">{request.rejectionReason}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-4 text-ink-700">{formatDate(request.processedAt)}</td>
                  <td className="px-4 py-4 text-ink-700">{formatDate(request.requestedAt)}</td>
                  <td className="px-4 py-4 text-right">
                    {request.status === "PENDING" ? (
                      <div className="flex flex-wrap justify-end gap-2">
                        <ActionButton onClick={() => setSelectedRequest(request)}>Detalhes</ActionButton>
                        {canApprove ? <ActionButton onClick={() => approve(request)}>Resetar senha</ActionButton> : null}
                        {canReject ? <ActionButton onClick={() => { setRejectMessage(""); setRejectRequest(request); }}>Rejeitar</ActionButton> : null}
                      </div>
                    ) : (
                      <ActionButton onClick={() => setSelectedRequest(request)}>Detalhes</ActionButton>
                    )}
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

      {temporaryPassword ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/45 px-4">
          <div className="w-full max-w-md rounded-md bg-white shadow-soft">
            <div className="border-b border-hope-100 px-5 py-4">
              <h2 className="text-lg font-bold text-ink-900">Senha temporaria gerada</h2>
              <p className="text-sm text-ink-500">{temporaryPasswordUser}</p>
            </div>
            <div className="grid gap-3 p-5">
              <p className="text-sm font-semibold text-ink-700">
                Copie e entregue esta senha ao usuario agora. Ela nao sera exibida novamente.
              </p>
              <code className="break-all rounded-md bg-hope-50 px-4 py-3 text-center text-lg font-bold text-hope-800">
                {temporaryPassword}
              </code>
              {temporaryPasswordMessage ? (
                <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                  {temporaryPasswordMessage}
                </p>
              ) : null}
            </div>
            <div className="flex justify-end gap-3 border-t border-hope-100 px-5 py-4">
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(temporaryPassword);
                  setTemporaryPasswordMessage("Senha copiada.");
                }}
                className="rounded-md border border-hope-100 px-4 py-2 text-sm font-bold text-ink-700"
              >
                Copiar senha
              </button>
              <button
                type="button"
                onClick={() => {
                  setTemporaryPassword("");
                  setTemporaryPasswordUser("");
                  setTemporaryPasswordMessage("");
                }}
                className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedRequest ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/45 px-4">
          <div className="w-full max-w-lg rounded-md bg-white shadow-soft">
            <div className="flex items-start justify-between border-b border-hope-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-ink-900">Detalhes da solicitacao</h2>
                <p className="text-sm text-ink-500">{selectedRequest.identifier}</p>
              </div>
              <button type="button" onClick={() => setSelectedRequest(null)} className="rounded-md border border-hope-100 px-3 py-2 text-sm font-bold text-ink-700">
                Fechar
              </button>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Info label="Nome informado" value={selectedRequest.name ?? "-"} />
              <Info label="E-mail" value={maskEmail(selectedRequest.email)} />
              <Info label="Telefone/CPF" value={selectedRequest.identifier} />
              <Info label="Status" value={statusLabels[selectedRequest.status]} />
              <Info label="Usuario vinculado" value={selectedRequest.user?.name ?? "Nao localizado"} className="sm:col-span-2" />
              <Info label="Solicitada em" value={formatDate(selectedRequest.requestedAt)} />
              <Info label="Processada em" value={formatDate(selectedRequest.processedAt)} />
              {selectedRequest.rejectionReason ? (
                <Info label="Motivo da rejeicao" value={selectedRequest.rejectionReason} className="sm:col-span-2" />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {rejectRequest ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/45 px-4">
          <div className="w-full max-w-md rounded-md bg-white shadow-soft">
            <form onSubmit={reject}>
              <div className="border-b border-hope-100 px-5 py-4">
                <h2 className="text-lg font-bold text-ink-900">Rejeitar recuperacao</h2>
                <p className="text-sm text-ink-500">{rejectRequest.identifier}</p>
              </div>
              <div className="grid gap-4 p-5">
                <FormMessage id="password-reset-reject-message">{rejectMessage}</FormMessage>
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
