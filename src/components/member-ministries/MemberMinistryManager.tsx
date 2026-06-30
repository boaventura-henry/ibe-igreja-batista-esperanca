"use client";

import { MemberMinistryRole, MemberMinistryStatus } from "@prisma/client";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import type {
  MemberMinistryFormValues,
  MemberMinistryListResult,
  MemberMinistrySummary
} from "@/types";
import { formatCpf, formatDateForInput } from "@/utils";

type ApiResponse<T> =
  | ({ success: true; data: T } & T)
  | { success: false; error: { code: string; message: string } };

const roleOptions = [
  { value: MemberMinistryRole.LEADER, label: "Lider" },
  { value: MemberMinistryRole.VICE_LEADER, label: "Vice-lider" },
  { value: MemberMinistryRole.SECRETARY, label: "Secretario" },
  { value: MemberMinistryRole.TREASURER, label: "Tesoureiro" },
  { value: MemberMinistryRole.VOLUNTEER, label: "Voluntario" },
  { value: MemberMinistryRole.MEMBER, label: "Membro" }
];

const statusOptions = [
  { value: MemberMinistryStatus.ACTIVE, label: "Ativo" },
  { value: MemberMinistryStatus.INACTIVE, label: "Inativo" },
  { value: MemberMinistryStatus.TRANSFERRED, label: "Transferido" },
  { value: MemberMinistryStatus.REMOVED, label: "Removido" },
  { value: MemberMinistryStatus.LEFT, label: "Saiu" }
];

const sortOptions = [
  { value: "entryDate", label: "Entrada" },
  { value: "memberName", label: "Membro" },
  { value: "ministryName", label: "Ministerio" },
  { value: "role", label: "Funcao" },
  { value: "status", label: "Status" },
  { value: "updatedAt", label: "Atualizacao" }
];

const emptyForm: MemberMinistryFormValues = {
  memberId: "",
  ministryId: "",
  role: MemberMinistryRole.MEMBER,
  status: MemberMinistryStatus.ACTIVE,
  entryDate: new Date().toISOString().slice(0, 10),
  exitDate: "",
  observations: ""
};

function roleLabel(role: MemberMinistryRole) {
  return roleOptions.find((option) => option.value === role)?.label ?? role;
}

function statusLabel(status: MemberMinistryStatus) {
  return statusOptions.find((option) => option.value === status)?.label ?? status;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value));
}

function normalizeForm(form: MemberMinistryFormValues) {
  return {
    memberId: form.memberId,
    ministryId: form.ministryId,
    role: form.role,
    status: form.status,
    entryDate: form.entryDate,
    exitDate: form.exitDate?.trim() || undefined,
    observations: form.observations?.trim() || undefined
  };
}

export function MemberMinistryManager() {
  const { data: session } = useSession();
  const [data, setData] = useState<MemberMinistryListResult | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MemberMinistryFormValues>(emptyForm);
  const [filters, setFilters] = useState({
    search: "",
    memberId: "",
    ministryId: "",
    status: "",
    role: "",
    activeOnly: "",
    sortBy: "entryDate",
    sortOrder: "desc",
    page: "1"
  });

  const permissionCodes = session?.user.permissionCodes ?? [];
  const canCreate = permissionCodes.includes("memberMinistry.create");
  const canUpdate = permissionCodes.includes("memberMinistry.update");
  const canDelete = permissionCodes.includes("memberMinistry.delete");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const memberId = params.get("memberId");
    const ministryId = params.get("ministryId");

    if (memberId || ministryId) {
      setFilters((current) => ({
        ...current,
        memberId: memberId ?? current.memberId,
        ministryId: ministryId ?? current.ministryId
      }));
    }
  }, []);

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

  const loadLinks = useCallback(async () => {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/member-ministries?${queryString}`, { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse<MemberMinistryListResult>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setData(payload.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel carregar os vinculos.");
    } finally {
      setIsLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    const timeout = window.setTimeout(loadLinks, 250);

    return () => window.clearTimeout(timeout);
  }, [loadLinks]);

  function updateFilter(name: keyof typeof filters, value: string) {
    setFilters((current) => ({
      ...current,
      [name]: value,
      page: name === "page" ? value : "1"
    }));
  }

  function updateForm<K extends keyof MemberMinistryFormValues>(name: K, value: MemberMinistryFormValues[K]) {
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === "status" && value === MemberMinistryStatus.ACTIVE ? { exitDate: "" } : {})
    }));
  }

  function openCreateForm() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage("");
    setIsFormOpen(true);
  }

  async function openEditForm(id: string, closing = false) {
    setMessage("");

    try {
      const response = await fetch(`/api/member-ministries/${id}`, { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse<MemberMinistrySummary>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      const link = payload.data;
      setEditingId(id);
      setForm({
        memberId: link.member.id,
        ministryId: link.ministry.id,
        role: link.role,
        status: closing ? MemberMinistryStatus.LEFT : link.status,
        entryDate: formatDateForInput(link.entryDate),
        exitDate: closing ? new Date().toISOString().slice(0, 10) : formatDateForInput(link.exitDate),
        observations: link.observations ?? ""
      });
      setIsFormOpen(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel abrir o vinculo.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    try {
      const response = await fetch(editingId ? `/api/member-ministries/${editingId}` : "/api/member-ministries", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalizeForm(form))
      });
      const payload = (await response.json()) as ApiResponse<MemberMinistrySummary>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setIsFormOpen(false);
      setMessage(editingId ? "Vinculo atualizado com sucesso." : "Vinculo criado com sucesso.");
      await loadLinks();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel salvar o vinculo.");
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm("Deseja remover este vinculo da listagem?");

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`/api/member-ministries/${id}`, { method: "DELETE" });
      const payload = (await response.json()) as ApiResponse<{ id: string }>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setMessage("Vinculo removido da listagem.");
      await loadLinks();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel remover o vinculo.");
    }
  }

  const pagination = data?.pagination;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-md border border-hope-100 bg-white p-4 shadow-sm lg:grid-cols-6">
        <FilterInput label="Pesquisa" value={filters.search} onChange={(value) => updateFilter("search", value)} className="lg:col-span-2" />
        <label className={filterLabelClass}>
          Membro
          <select value={filters.memberId} onChange={(event) => updateFilter("memberId", event.target.value)} className={filterInputClass}>
            <option value="">Todos</option>
            {data?.filters.members.map((member) => (
              <option key={member.id} value={member.id}>{member.name}</option>
            ))}
          </select>
        </label>
        <label className={filterLabelClass}>
          Ministerio
          <select value={filters.ministryId} onChange={(event) => updateFilter("ministryId", event.target.value)} className={filterInputClass}>
            <option value="">Todos</option>
            {data?.filters.ministries.map((ministry) => (
              <option key={ministry.id} value={ministry.id}>{ministry.name}</option>
            ))}
          </select>
        </label>
        <label className={filterLabelClass}>
          Status
          <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)} className={filterInputClass}>
            <option value="">Todos</option>
            {statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
          </select>
        </label>
        <label className={filterLabelClass}>
          Funcao
          <select value={filters.role} onChange={(event) => updateFilter("role", event.target.value)} className={filterInputClass}>
            <option value="">Todas</option>
            {roleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
          </select>
        </label>
        <label className={filterLabelClass}>
          Somente ativos
          <select value={filters.activeOnly} onChange={(event) => updateFilter("activeOnly", event.target.value)} className={filterInputClass}>
            <option value="">Nao</option>
            <option value="true">Sim</option>
          </select>
        </label>
        <label className={filterLabelClass}>
          Ordenar por
          <select value={filters.sortBy} onChange={(event) => updateFilter("sortBy", event.target.value)} className={filterInputClass}>
            {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className={filterLabelClass}>
          Direcao
          <select value={filters.sortOrder} onChange={(event) => updateFilter("sortOrder", event.target.value)} className={filterInputClass}>
            <option value="asc">Crescente</option>
            <option value="desc">Decrescente</option>
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
            <p className="text-sm font-bold text-ink-900">Vinculos cadastrados</p>
            <p className="text-xs text-ink-500">{pagination ? `${pagination.total} registro(s)` : "Carregando"}</p>
          </div>
          {canCreate ? (
            <button type="button" onClick={openCreateForm} className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white">
              Novo vinculo
            </button>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-hope-100 text-sm">
            <thead className="bg-hope-50 text-left text-xs font-bold uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3">Membro</th>
                <th className="px-4 py-3">Ministerio</th>
                <th className="px-4 py-3">Funcao</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Periodo</th>
                <th className="px-4 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hope-100">
              {isLoading ? (
                <tr>
                  <td className="px-4 py-8 text-center font-semibold text-ink-500" colSpan={6}>Carregando vinculos...</td>
                </tr>
              ) : null}

              {!isLoading && data?.memberMinistries.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center font-semibold text-ink-500" colSpan={6}>Nenhum vinculo encontrado.</td>
                </tr>
              ) : null}

              {data?.memberMinistries.map((link) => (
                <tr key={link.id} className="align-top">
                  <td className="px-4 py-4">
                    <p className="font-semibold text-ink-900">{link.member.name}</p>
                    <p className="text-xs text-ink-500">{formatCpf(link.member.cpf) || link.member.email || "-"}</p>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded" style={{ backgroundColor: link.ministry.color }} />
                      <span className="font-semibold text-ink-900">{link.ministry.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-ink-700">{roleLabel(link.role)}</td>
                  <td className="px-4 py-4">
                    <span className="rounded-md bg-hope-50 px-2 py-1 text-xs font-bold text-hope-700">
                      {statusLabel(link.status)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-ink-700">
                    <p>{formatDate(link.entryDate)}</p>
                    <p className="text-xs text-ink-500">{link.exitDate ? `Saida: ${formatDate(link.exitDate)}` : "Em andamento"}</p>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {canUpdate ? <ActionButton onClick={() => openEditForm(link.id)}>Editar</ActionButton> : null}
                      {canUpdate && link.status === MemberMinistryStatus.ACTIVE ? (
                        <ActionButton onClick={() => openEditForm(link.id, true)}>Encerrar</ActionButton>
                      ) : null}
                      {canDelete ? <ActionButton onClick={() => handleDelete(link.id)}>Remover</ActionButton> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pagination ? (
          <div className="flex flex-col gap-3 border-t border-hope-100 px-4 py-3 text-sm text-ink-600 sm:flex-row sm:items-center sm:justify-between">
            <span>Pagina {pagination.page} de {pagination.totalPages}</span>
            <div className="flex gap-2">
              <button type="button" disabled={pagination.page <= 1} onClick={() => updateFilter("page", String(pagination.page - 1))} className="rounded-md border border-hope-100 px-3 py-2 font-bold disabled:opacity-40">
                Anterior
              </button>
              <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => updateFilter("page", String(pagination.page + 1))} className="rounded-md border border-hope-100 px-3 py-2 font-bold disabled:opacity-40">
                Proxima
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {isFormOpen ? (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-ink-900/45 px-4 py-6">
          <div className="mx-auto max-w-3xl rounded-md bg-white shadow-soft">
            <form onSubmit={handleSubmit}>
              <div className="flex items-start justify-between border-b border-hope-100 px-5 py-4">
                <div>
                  <h2 className="text-lg font-bold text-ink-900">{editingId ? "Editar vinculo" : "Novo vinculo"}</h2>
                  <p className="text-sm text-ink-500">Membro, ministerio, funcao e periodo de participacao.</p>
                </div>
                <button type="button" onClick={() => setIsFormOpen(false)} className="rounded-md border border-hope-100 px-3 py-2 text-sm font-bold text-ink-700">
                  Fechar
                </button>
              </div>

              <div className="grid gap-4 p-5 md:grid-cols-2">
                <Field label="Membro">
                  <select required value={form.memberId} onChange={(event) => updateForm("memberId", event.target.value)} className={inputClass}>
                    <option value="">Selecione</option>
                    {data?.filters.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                  </select>
                </Field>
                <Field label="Ministerio">
                  <select required value={form.ministryId} onChange={(event) => updateForm("ministryId", event.target.value)} className={inputClass}>
                    <option value="">Selecione</option>
                    {data?.filters.ministries.map((ministry) => <option key={ministry.id} value={ministry.id}>{ministry.name}</option>)}
                  </select>
                </Field>
                <Field label="Funcao">
                  <select value={form.role} onChange={(event) => updateForm("role", event.target.value as MemberMinistryRole)} className={inputClass}>
                    {roleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                  </select>
                </Field>
                <Field label="Status">
                  <select value={form.status} onChange={(event) => updateForm("status", event.target.value as MemberMinistryStatus)} className={inputClass}>
                    {statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                  </select>
                </Field>
                <Field label="Data de entrada">
                  <input required type="date" value={form.entryDate} onChange={(event) => updateForm("entryDate", event.target.value)} className={inputClass} />
                </Field>
                <Field label="Data de saida">
                  <input
                    type="date"
                    value={form.exitDate ?? ""}
                    disabled={form.status === MemberMinistryStatus.ACTIVE}
                    onChange={(event) => updateForm("exitDate", event.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Observacoes" className="md:col-span-2">
                  <textarea value={form.observations ?? ""} onChange={(event) => updateForm("observations", event.target.value)} className={`${inputClass} min-h-24`} />
                </Field>
              </div>

              <div className="flex justify-end gap-3 border-t border-hope-100 px-5 py-4">
                <button type="button" onClick={() => setIsFormOpen(false)} className="rounded-md border border-hope-100 px-4 py-2 text-sm font-bold text-ink-700">
                  Cancelar
                </button>
                <button type="submit" className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white">
                  Salvar vinculo
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
  "rounded-md border border-hope-100 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-ink-800";
const inputClass =
  "w-full rounded-md border border-hope-100 px-3 py-2 text-sm font-semibold text-ink-800 outline-none transition focus:border-hope-500 focus:ring-2 focus:ring-hope-100 disabled:bg-ink-50 disabled:text-ink-400";

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

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`grid gap-1 text-xs font-bold uppercase tracking-wide text-ink-500 ${className}`}>
      {label}
      {children}
    </label>
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
