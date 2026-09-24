"use client";

import { FinancialEntryOrigin, FinancialEntryStatus, FinancialEntryType, FinancialPaymentMethod } from "@prisma/client";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { FormMessage } from "@/components/ui/FormMessage";
import { Modal } from "@/components/ui/Modal";
import type { FinancialEntryFormValues, FinancialEntryListResult, FinancialEntrySummary } from "@/types";
import { getMemberOptionLabel } from "@/utils";

type ApiResponse<T> = ({ success: true; data: T } & T) | { success: false; error: { code: string; message: string } };

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm: FinancialEntryFormValues = {
  type: FinancialEntryType.INCOME,
  memberId: "",
  categoryId: "",
  eventId: "",
  ministryId: "",
  amount: "",
  paymentMethod: FinancialPaymentMethod.PIX,
  status: FinancialEntryStatus.CONFIRMED,
  origin: FinancialEntryOrigin.MANUAL,
  anonymous: false,
  launchDate: today(),
  referenceDate: today(),
  observation: ""
};

const typeLabels = { INCOME: "Entrada", EXPENSE: "Saida" } as const;
const statusLabels = { PENDING: "Pendente", CONFIRMED: "Confirmado", CANCELED: "Cancelado", REFUNDED: "Reembolsado" } as const;

function currency(value: string | number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

function dateForInput(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function normalize(form: FinancialEntryFormValues) {
  return {
    ...form,
    memberId: form.anonymous ? null : form.memberId || null,
    categoryId: form.categoryId,
    eventId: form.eventId || null,
    ministryId: form.ministryId || null,
    amount: Number(form.amount),
    observation: form.observation || null
  };
}

export function FinancialEntryManager() {
  const { data: session } = useSession();
  const [data, setData] = useState<FinancialEntryListResult | null>(null);
  const [message, setMessage] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [form, setForm] = useState<FinancialEntryFormValues>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingMinistry, setEditingMinistry] = useState<{ id: string; name: string } | null>(null);
  const [viewing, setViewing] = useState<FinancialEntrySummary | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [filters, setFilters] = useState({ search: "", type: "", status: "", page: "1" });
  const permissions = session?.user.permissionCodes ?? [];
  const canCreate = permissions.includes("financialEntry.create") || permissions.includes("ministryFinance.create");
  const canUpdate = permissions.includes("financialEntry.update") || permissions.includes("ministryFinance.update");
  const canCancel = permissions.includes("financialEntry.cancel") || permissions.includes("ministryFinance.cancel");
  const canDelete = permissions.includes("financialEntry.delete") || permissions.includes("ministryFinance.delete");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
    params.set("pageSize", "10");
    return params.toString();
  }, [filters]);

  const load = useCallback(async () => {
    const response = await fetch(`/api/financial/entries?${query}`, { cache: "no-store" });
    const payload = (await response.json()) as ApiResponse<FinancialEntryListResult>;
    if (payload.success) setData(payload.data);
    else setMessage(payload.error.message);
  }, [query]);

  useEffect(() => {
    const timeout = window.setTimeout(load, 250);
    return () => window.clearTimeout(timeout);
  }, [load]);

  function updateFilter(name: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [name]: value, page: name === "page" ? value : "1" }));
  }

  function openCreate() {
    setEditingId(null);
    setEditingMinistry(null);
    setForm({ ...emptyForm, ministryId: data?.scope.allMinistries ? "" : data?.filters.ministries[0]?.id ?? "" });
    setFormMessage("");
    setIsFormOpen(true);
  }

  async function openEdit(id: string) {
    const response = await fetch(`/api/financial/entries/${id}`);
    const payload = (await response.json()) as ApiResponse<FinancialEntrySummary>;
    if (!payload.success) return setFormMessage(payload.error.message);
    setFormMessage("");
    const entry = payload.data;
    setEditingId(id);
    setEditingMinistry(entry.ministry);
    setForm({
      type: entry.type,
      memberId: entry.member?.id ?? "",
      categoryId: entry.category.id,
      eventId: entry.event?.id ?? "",
      ministryId: entry.ministry?.id ?? "",
      amount: Number(entry.amount),
      paymentMethod: entry.paymentMethod,
      status: entry.status,
      origin: entry.origin,
      anonymous: entry.anonymous,
      launchDate: dateForInput(entry.launchDate),
      referenceDate: dateForInput(entry.referenceDate),
      observation: entry.observation ?? ""
    });
    setIsFormOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setFormMessage("");
    try {
      const response = await fetch(editingId ? `/api/financial/entries/${editingId}` : "/api/financial/entries", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalize(form))
      });
      const payload = (await response.json()) as ApiResponse<FinancialEntrySummary>;
      if (!payload.success) return setFormMessage(payload.error.message);
      setMessage(editingId ? "Lancamento atualizado." : "Lancamento criado.");
      setIsFormOpen(false);
      await load();
    } catch {
      setFormMessage("Nao foi possivel salvar o lancamento. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  }

  async function action(id: string, path = "", method = "POST") {
    const response = await fetch(`/api/financial/entries/${id}${path}`, { method });
    const payload = (await response.json()) as ApiResponse<FinancialEntrySummary | { id: string }>;
    setMessage(payload.success ? "Acao concluida." : payload.error.message);
    await load();
  }

  return (
    <div className="grid gap-4">
      {message ? <p className="rounded-md border border-hope-100 bg-white px-4 py-3 text-sm font-semibold text-ink-700">{message}</p> : null}
      <div className="grid gap-3 rounded-md border border-hope-100 bg-white p-4 shadow-sm md:grid-cols-[1fr_150px_150px_auto]">
        <input value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Pesquisar" className="rounded-md border-hope-100" />
        <select value={filters.type} onChange={(event) => updateFilter("type", event.target.value)} className="rounded-md border-hope-100"><option value="">Tipo</option>{Object.values(FinancialEntryType).map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select>
        <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)} className="rounded-md border-hope-100"><option value="">Status</option>{Object.values(FinancialEntryStatus).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select>
        {canCreate ? <button onClick={openCreate} className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white">Novo lancamento</button> : null}
      </div>
      <div className="overflow-x-auto rounded-md border border-hope-100 bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-hope-50 text-xs uppercase text-ink-500"><tr><th className="px-4 py-3">Numero</th><th>Tipo</th><th>Categoria</th><th>Membro</th><th>Valor</th><th>Status</th><th>Data</th><th className="px-4 text-right">Acoes</th></tr></thead>
          <tbody>{data?.entries.map((entry) => (
            <tr key={entry.id} className="border-t border-hope-100">
              <td className="px-4 py-3 font-bold">#{entry.entryNumber}</td><td>{typeLabels[entry.type]}</td><td>{entry.category.name}</td><td>{entry.anonymous ? "Anonimo" : entry.member?.name ?? "-"}</td><td>{currency(entry.amount)}</td><td>{statusLabels[entry.status]}</td><td>{dateForInput(entry.launchDate)}</td>
              <td className="px-4 text-right"><button onClick={() => setViewing(entry)} className="mr-2 font-bold text-hope-700">Ver</button>{canUpdate ? <button onClick={() => openEdit(entry.id)} className="mr-2 font-bold text-hope-700">Editar</button> : null}{canCancel ? <button onClick={() => action(entry.id, "/cancel")} className="mr-2 font-bold text-gold-700">Cancelar</button> : null}{canDelete ? <button onClick={() => action(entry.id, "", "DELETE")} className="font-bold text-red-700">Remover</button> : null}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {data?.pagination ? <Pager page={data.pagination.page} totalPages={data.pagination.totalPages} onPage={(page) => updateFilter("page", String(page))} /> : null}
      {isFormOpen ? (
        <Modal title={editingId ? "Editar lancamento" : "Novo lancamento"} onClose={() => setIsFormOpen(false)} size="lg">
          <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <FormMessage id="financial-entry-form-message">{formMessage}</FormMessage>
            </div>
            <label htmlFor="financial-entry-type" className="grid min-w-0 gap-1 text-sm font-bold">Tipo<select id="financial-entry-type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as FinancialEntryType })} className="w-full min-w-0 rounded-md border-hope-100">{Object.values(FinancialEntryType).map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select></label>
            <label htmlFor="financial-entry-category" className="grid min-w-0 gap-1 text-sm font-bold">Categoria<select id="financial-entry-category" required value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} className="w-full min-w-0 rounded-md border-hope-100"><option value="">Selecione a categoria</option>{data?.filters.categories.filter((category) => category.type === form.type).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label htmlFor="financial-entry-amount" className="grid min-w-0 gap-1 text-sm font-bold">Valor<input id="financial-entry-amount" required type="number" min={0.01} step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value ? Number(event.target.value) : "" })} className="w-full min-w-0 rounded-md border-hope-100" /></label>
            <label htmlFor="financial-entry-payment-method" className="grid min-w-0 gap-1 text-sm font-bold">Forma de pagamento<select id="financial-entry-payment-method" value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value as FinancialPaymentMethod })} className="w-full min-w-0 rounded-md border-hope-100">{Object.values(FinancialPaymentMethod).map((method) => <option key={method} value={method}>{method}</option>)}</select></label>
            <label htmlFor="financial-entry-launch-date" className="grid min-w-0 gap-1 text-sm font-bold">Data do lançamento<input id="financial-entry-launch-date" required type="date" value={form.launchDate} onChange={(event) => setForm({ ...form, launchDate: event.target.value })} className="w-full min-w-0 rounded-md border-hope-100" /></label>
            <label htmlFor="financial-entry-reference-date" className="grid min-w-0 gap-1 text-sm font-bold">Data de referência<input id="financial-entry-reference-date" required type="date" value={form.referenceDate} onChange={(event) => setForm({ ...form, referenceDate: event.target.value })} className="w-full min-w-0 rounded-md border-hope-100" /></label>
            <label htmlFor="financial-entry-member" className="grid min-w-0 gap-1 text-sm font-bold">Membro<select id="financial-entry-member" value={form.memberId} disabled={form.anonymous} onChange={(event) => setForm({ ...form, memberId: event.target.value })} className="w-full min-w-0 rounded-md border-hope-100"><option value="">Sem membro</option>{data?.filters.members.map((member) => <option key={member.id} value={member.id}>{getMemberOptionLabel(member)}</option>)}</select></label>
            <label htmlFor="financial-entry-ministry" className="grid min-w-0 gap-1 text-sm font-bold">Ministerio<select id="financial-entry-ministry" required={!data?.scope.allMinistries} value={form.ministryId} onChange={(event) => setForm({ ...form, ministryId: event.target.value })} className="w-full min-w-0 rounded-md border-hope-100">{data?.scope.allMinistries ? <option value="">Geral da igreja</option> : <option value="">Selecione o ministerio</option>}{editingMinistry && !data?.filters.ministries.some((ministry) => ministry.id === editingMinistry.id) ? <option value={editingMinistry.id}>{editingMinistry.name} (inativo)</option> : null}{data?.filters.ministries.map((ministry) => <option key={ministry.id} value={ministry.id}>{ministry.name}</option>)}</select></label>
            <label htmlFor="financial-entry-event" className="grid min-w-0 gap-1 text-sm font-bold">Evento<select id="financial-entry-event" value={form.eventId} onChange={(event) => setForm({ ...form, eventId: event.target.value })} className="w-full min-w-0 rounded-md border-hope-100"><option value="">Sem evento</option>{data?.filters.events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select></label>
            <label htmlFor="financial-entry-status" className="grid min-w-0 gap-1 text-sm font-bold">Status<select id="financial-entry-status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as FinancialEntryStatus })} className="w-full min-w-0 rounded-md border-hope-100">{Object.values(FinancialEntryStatus).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
            <label htmlFor="financial-entry-anonymous" className="flex items-center gap-2 text-sm font-bold"><input id="financial-entry-anonymous" type="checkbox" checked={form.anonymous} onChange={(event) => setForm({ ...form, anonymous: event.target.checked, memberId: event.target.checked ? "" : form.memberId })} /> Anonimo</label>
            <label htmlFor="financial-entry-observation" className="grid min-w-0 gap-1 text-sm font-bold md:col-span-2">Observacao<textarea id="financial-entry-observation" value={form.observation} onChange={(event) => setForm({ ...form, observation: event.target.value })} className="min-h-24 w-full min-w-0 rounded-md border-hope-100" /></label>
            <button disabled={isSaving} className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 md:col-span-2">{isSaving ? "Salvando..." : "Salvar"}</button>
          </form>
        </Modal>
      ) : null}
      {viewing ? <Modal title={`Lancamento #${viewing.entryNumber}`} onClose={() => setViewing(null)}><p>{viewing.category.name} - {currency(viewing.amount)}</p><p className="text-sm text-ink-500">{viewing.observation ?? "Sem observacao."}</p></Modal> : null}
    </div>
  );
}

function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  return <div className="flex items-center justify-end gap-2 text-sm font-bold"><button disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-md border px-3 py-2 disabled:opacity-40">Anterior</button><span>{page} / {totalPages}</span><button disabled={page >= totalPages} onClick={() => onPage(page + 1)} className="rounded-md border px-3 py-2 disabled:opacity-40">Proxima</button></div>;
}
