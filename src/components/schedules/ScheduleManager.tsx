"use client";

import Link from "next/link";
import { ScheduleStatus } from "@prisma/client";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { FormMessage } from "@/components/ui/FormMessage";
import type { ScheduleFormValues, ScheduleListResult, ScheduleSummary } from "@/types";
import { formatDateForInput } from "@/utils";

type ApiResponse<T> =
  | ({ success: true; data: T } & T)
  | { success: false; error: { code: string; message: string } };

const statusOptions = [
  { value: ScheduleStatus.DRAFT, label: "Rascunho" },
  { value: ScheduleStatus.PUBLISHED, label: "Publicada" },
  { value: ScheduleStatus.COMPLETED, label: "Concluida" },
  { value: ScheduleStatus.CANCELED, label: "Cancelada" }
];

const sortOptions = [
  { value: "date", label: "Data" },
  { value: "title", label: "Titulo" },
  { value: "status", label: "Status" },
  { value: "updatedAt", label: "Atualizacao" }
];

const emptyForm: ScheduleFormValues = {
  title: "",
  description: "",
  ministryId: "",
  date: new Date().toISOString().slice(0, 10),
  startTime: "",
  endTime: "",
  location: "",
  status: ScheduleStatus.DRAFT,
  observations: ""
};

function statusLabel(status: ScheduleStatus) {
  return statusOptions.find((option) => option.value === status)?.label ?? status;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(value));
}

function normalizeForm(form: ScheduleFormValues) {
  return {
    title: form.title,
    description: form.description?.trim() || undefined,
    ministryId: form.ministryId,
    date: form.date,
    startTime: form.startTime?.trim() || undefined,
    endTime: form.endTime?.trim() || undefined,
    location: form.location?.trim() || undefined,
    status: form.status,
    observations: form.observations?.trim() || undefined
  };
}

export function ScheduleManager() {
  const { data: session } = useSession();
  const [data, setData] = useState<ScheduleListResult | null>(null);
  const [message, setMessage] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ScheduleFormValues>(emptyForm);
  const [filters, setFilters] = useState({
    search: "",
    ministryId: "",
    status: "",
    dateFrom: "",
    dateTo: "",
    sortBy: "date",
    sortOrder: "asc",
    page: "1"
  });

  const permissionCodes = session?.user.permissionCodes ?? [];
  const canCreate = permissionCodes.includes("schedule.create");
  const canUpdate = permissionCodes.includes("schedule.update");
  const canDelete = permissionCodes.includes("schedule.delete");
  const canPublish = permissionCodes.includes("schedule.publish");
  const canCancel = permissionCodes.includes("schedule.cancel");
  const canComplete = permissionCodes.includes("schedule.complete");

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

  const loadSchedules = useCallback(async () => {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/schedules?${queryString}`, { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse<ScheduleListResult>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setData(payload.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel carregar as escalas.");
    } finally {
      setIsLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    const timeout = window.setTimeout(loadSchedules, 250);

    return () => window.clearTimeout(timeout);
  }, [loadSchedules]);

  function updateFilter(name: keyof typeof filters, value: string) {
    setFilters((current) => ({
      ...current,
      [name]: value,
      page: name === "page" ? value : "1"
    }));
  }

  function updateForm<K extends keyof ScheduleFormValues>(name: K, value: ScheduleFormValues[K]) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function openCreateForm() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage("");
    setFormMessage("");
    setIsFormOpen(true);
  }

  async function openEditForm(schedule: ScheduleSummary) {
    setEditingId(schedule.id);
    setForm({
      title: schedule.title,
      description: schedule.description ?? "",
      ministryId: schedule.ministry.id,
      date: formatDateForInput(schedule.date),
      startTime: schedule.startTime ?? "",
      endTime: schedule.endTime ?? "",
      location: schedule.location ?? "",
      status: schedule.status,
      observations: schedule.observations ?? ""
    });
    setMessage("");
    setFormMessage("");
    setIsFormOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormMessage("");

    try {
      const response = await fetch(editingId ? `/api/schedules/${editingId}` : "/api/schedules", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalizeForm(form))
      });
      const payload = (await response.json()) as ApiResponse<ScheduleSummary>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setIsFormOpen(false);
      setMessage(editingId ? "Escala atualizada com sucesso." : "Escala criada com sucesso.");
      await loadSchedules();
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Nao foi possivel salvar a escala.");
    }
  }

  async function postAction(id: string, action: "publish" | "cancel" | "complete", successMessage: string) {
    setMessage("");

    try {
      const response = await fetch(`/api/schedules/${id}/${action}`, { method: "POST" });
      const payload = (await response.json()) as ApiResponse<ScheduleSummary>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setMessage(successMessage);
      await loadSchedules();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel executar a acao.");
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Deseja remover esta escala da listagem?")) {
      return;
    }

    try {
      const response = await fetch(`/api/schedules/${id}`, { method: "DELETE" });
      const payload = (await response.json()) as ApiResponse<{ id: string }>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setMessage("Escala removida da listagem.");
      await loadSchedules();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel remover a escala.");
    }
  }

  const pagination = data?.pagination;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-md border border-hope-100 bg-white p-4 shadow-sm lg:grid-cols-6">
        <FilterInput label="Pesquisa" value={filters.search} onChange={(value) => updateFilter("search", value)} className="lg:col-span-2" />
        <label className={filterLabelClass}>
          Ministerio
          <select value={filters.ministryId} onChange={(event) => updateFilter("ministryId", event.target.value)} className={filterInputClass}>
            <option value="">Todos</option>
            {data?.filters.ministries.map((ministry) => <option key={ministry.id} value={ministry.id}>{ministry.name}</option>)}
          </select>
        </label>
        <label className={filterLabelClass}>
          Status
          <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)} className={filterInputClass}>
            <option value="">Todos</option>
            {statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
          </select>
        </label>
        <FilterInput label="De" type="date" value={filters.dateFrom} onChange={(value) => updateFilter("dateFrom", value)} />
        <FilterInput label="Ate" type="date" value={filters.dateTo} onChange={(value) => updateFilter("dateTo", value)} />
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

      {message ? <div className="rounded-md border border-hope-100 bg-hope-50 px-4 py-3 text-sm font-semibold text-ink-800">{message}</div> : null}

      <div className="overflow-hidden rounded-md border border-hope-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-hope-100 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-ink-900">Escalas cadastradas</p>
            <p className="text-xs text-ink-500">{pagination ? `${pagination.total} registro(s)` : "Carregando"}</p>
          </div>
          {canCreate ? (
            <button type="button" onClick={openCreateForm} className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white">
              Nova escala
            </button>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-hope-100 text-sm">
            <thead className="bg-hope-50 text-left text-xs font-bold uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3">Escala</th>
                <th className="px-4 py-3">Ministerio</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Membros</th>
                <th className="px-4 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hope-100">
              {isLoading ? (
                <tr><td className="px-4 py-8 text-center font-semibold text-ink-500" colSpan={6}>Carregando escalas...</td></tr>
              ) : null}
              {!isLoading && data?.schedules.length === 0 ? (
                <tr><td className="px-4 py-8 text-center font-semibold text-ink-500" colSpan={6}>Nenhuma escala encontrada.</td></tr>
              ) : null}
              {data?.schedules.map((schedule) => (
                <tr key={schedule.id} className="align-top">
                  <td className="px-4 py-4">
                    <Link href={`/escalas/${schedule.id}`} className="font-semibold text-hope-700 hover:text-hope-900">{schedule.title}</Link>
                    <p className="text-xs text-ink-500">{schedule.location || "-"}</p>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded" style={{ backgroundColor: schedule.ministry.color }} />
                      <span className="font-semibold text-ink-900">{schedule.ministry.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-ink-700">
                    <p>{formatDate(schedule.date)}</p>
                    <p className="text-xs text-ink-500">{[schedule.startTime, schedule.endTime].filter(Boolean).join(" - ") || "Horario nao informado"}</p>
                  </td>
                  <td className="px-4 py-4"><StatusBadge status={schedule.status} /></td>
                  <td className="px-4 py-4 text-ink-700">{schedule.members.length}</td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Link href={`/escalas/${schedule.id}`} className={actionClass}>Detalhes</Link>
                      {canUpdate ? <ActionButton onClick={() => openEditForm(schedule)}>Editar</ActionButton> : null}
                      {canPublish && schedule.status === ScheduleStatus.DRAFT ? <ActionButton onClick={() => postAction(schedule.id, "publish", "Escala publicada.")}>Publicar</ActionButton> : null}
                      {canComplete && schedule.status !== ScheduleStatus.COMPLETED ? <ActionButton onClick={() => postAction(schedule.id, "complete", "Escala concluida.")}>Concluir</ActionButton> : null}
                      {canCancel && schedule.status !== ScheduleStatus.CANCELED ? <ActionButton onClick={() => postAction(schedule.id, "cancel", "Escala cancelada.")}>Cancelar</ActionButton> : null}
                      {canDelete ? <ActionButton onClick={() => handleDelete(schedule.id)}>Remover</ActionButton> : null}
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
              <button type="button" disabled={pagination.page <= 1} onClick={() => updateFilter("page", String(pagination.page - 1))} className="rounded-md border border-hope-100 px-3 py-2 font-bold disabled:opacity-40">Anterior</button>
              <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => updateFilter("page", String(pagination.page + 1))} className="rounded-md border border-hope-100 px-3 py-2 font-bold disabled:opacity-40">Proxima</button>
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
                  <h2 className="text-lg font-bold text-ink-900">{editingId ? "Editar escala" : "Nova escala"}</h2>
                  <p className="text-sm text-ink-500">Ministerio, data, local e status da escala.</p>
                </div>
                <button type="button" onClick={() => setIsFormOpen(false)} className="rounded-md border border-hope-100 px-3 py-2 text-sm font-bold text-ink-700">Fechar</button>
              </div>
              <div className="grid gap-4 p-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <FormMessage id="schedule-form-message">{formMessage}</FormMessage>
                </div>
                <Field label="Titulo" className="md:col-span-2"><input required value={form.title} onChange={(event) => updateForm("title", event.target.value)} className={inputClass} /></Field>
                <Field label="Ministerio">
                  <select required value={form.ministryId} onChange={(event) => updateForm("ministryId", event.target.value)} className={inputClass}>
                    <option value="">Selecione</option>
                    {data?.filters.ministries.map((ministry) => <option key={ministry.id} value={ministry.id}>{ministry.name}</option>)}
                  </select>
                </Field>
                <Field label="Status">
                  <select value={form.status} onChange={(event) => updateForm("status", event.target.value as ScheduleStatus)} className={inputClass}>
                    {statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                  </select>
                </Field>
                <Field label="Data"><input required type="date" value={form.date} onChange={(event) => updateForm("date", event.target.value)} className={inputClass} /></Field>
                <Field label="Local"><input value={form.location ?? ""} onChange={(event) => updateForm("location", event.target.value)} className={inputClass} /></Field>
                <Field label="Inicio"><input type="time" value={form.startTime ?? ""} onChange={(event) => updateForm("startTime", event.target.value)} className={inputClass} /></Field>
                <Field label="Fim"><input type="time" value={form.endTime ?? ""} onChange={(event) => updateForm("endTime", event.target.value)} className={inputClass} /></Field>
                <Field label="Descricao" className="md:col-span-2"><textarea value={form.description ?? ""} onChange={(event) => updateForm("description", event.target.value)} className={`${inputClass} min-h-20`} /></Field>
                <Field label="Observacoes" className="md:col-span-2"><textarea value={form.observations ?? ""} onChange={(event) => updateForm("observations", event.target.value)} className={`${inputClass} min-h-20`} /></Field>
              </div>
              <div className="flex justify-end gap-3 border-t border-hope-100 px-5 py-4">
                <button type="button" onClick={() => setIsFormOpen(false)} className="rounded-md border border-hope-100 px-4 py-2 text-sm font-bold text-ink-700">Cancelar</button>
                <button type="submit" className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white">Salvar escala</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const filterLabelClass = "grid gap-1 text-xs font-bold uppercase tracking-wide text-ink-500";
const filterInputClass = "rounded-md border border-hope-100 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-ink-800";
const inputClass = "w-full rounded-md border border-hope-100 px-3 py-2 text-sm font-semibold text-ink-800 outline-none transition focus:border-hope-500 focus:ring-2 focus:ring-hope-100 disabled:bg-ink-50 disabled:text-ink-400";
const actionClass = "rounded-md border border-hope-100 px-3 py-2 text-xs font-bold text-ink-700 hover:bg-hope-50";

function StatusBadge({ status }: { status: ScheduleStatus }) {
  return <span className="rounded-md bg-hope-50 px-2 py-1 text-xs font-bold text-hope-700">{statusLabel(status)}</span>;
}

function FilterInput({ label, type = "text", value, onChange, className = "" }: { label: string; type?: string; value: string; onChange: (value: string) => void; className?: string }) {
  return (
    <label className={`${filterLabelClass} ${className}`}>
      {label}
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className={filterInputClass} />
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
  return <button type="button" onClick={onClick} className={actionClass}>{children}</button>;
}
