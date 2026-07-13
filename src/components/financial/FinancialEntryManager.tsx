"use client";

import { FinancialEntryOrigin, FinancialEntryStatus, FinancialEntryType, FinancialPaymentMethod } from "@prisma/client";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { FormMessage } from "@/components/ui/FormMessage";
import type { FinancialEntryFormValues, FinancialEntryListResult, FinancialEntrySummary } from "@/types";

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
  const [viewing, setViewing] = useState<FinancialEntrySummary | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [filters, setFilters] = useState({ search: "", type: "", status: "", page: "1" });
  const permissions = session?.user.permissionCodes ?? [];

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
    setForm(emptyForm);
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
    setFormMessage("");
    const response = await fetch(editingId ? `/api/financial/entries/${editingId}` : "/api/financial/entries", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalize(form))
    });
    const payload = (await response.json()) as ApiResponse<FinancialEntrySummary>;
    if (!payload.success) return setMessage(payload.error.message);
    setMessage(editingId ? "Lancamento atualizado." : "Lancamento criado.");
    setIsFormOpen(false);
    await load();
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
        {permissions.includes("financialEntry.create") ? <button onClick={openCreate} className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white">Novo lancamento</button> : null}
      </div>
      <div className="overflow-x-auto rounded-md border border-hope-100 bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-hope-50 text-xs uppercase text-ink-500"><tr><th className="px-4 py-3">Numero</th><th>Tipo</th><th>Categoria</th><th>Membro</th><th>Valor</th><th>Status</th><th>Data</th><th className="px-4 text-right">Acoes</th></tr></thead>
          <tbody>{data?.entries.map((entry) => (
            <tr key={entry.id} className="border-t border-hope-100">
              <td className="px-4 py-3 font-bold">#{entry.entryNumber}</td><td>{typeLabels[entry.type]}</td><td>{entry.category.name}</td><td>{entry.anonymous ? "Anonimo" : entry.member?.name ?? "-"}</td><td>{currency(entry.amount)}</td><td>{statusLabels[entry.status]}</td><td>{dateForInput(entry.launchDate)}</td>
              <td className="px-4 text-right"><button onClick={() => setViewing(entry)} className="mr-2 font-bold text-hope-700">Ver</button>{permissions.includes("financialEntry.update") ? <button onClick={() => openEdit(entry.id)} className="mr-2 font-bold text-hope-700">Editar</button> : null}{permissions.includes("financialEntry.cancel") ? <button onClick={() => action(entry.id, "/cancel")} className="mr-2 font-bold text-gold-700">Cancelar</button> : null}{permissions.includes("financialEntry.delete") ? <button onClick={() => action(entry.id, "", "DELETE")} className="font-bold text-red-700">Remover</button> : null}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {data?.pagination ? <Pager page={data.pagination.page} totalPages={data.pagination.totalPages} onPage={(page) => updateFilter("page", String(page))} /> : null}
      {isFormOpen ? (
        <Modal title={editingId ? "Editar lancamento" : "Novo lancamento"} onClose={() => setIsFormOpen(false)}>
          <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <FormMessage id="financial-entry-form-message">{formMessage}</FormMessage>
            </div>
            <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as FinancialEntryType })} className="rounded-md border-hope-100">{Object.values(FinancialEntryType).map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select>
            <select required value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} className="rounded-md border-hope-100"><option value="">Categoria</option>{data?.filters.categories.filter((category) => category.type === form.type).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
            <input required type="number" min={0.01} step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value ? Number(event.target.value) : "" })} placeholder="Valor" className="rounded-md border-hope-100" />
            <select value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value as FinancialPaymentMethod })} className="rounded-md border-hope-100">{Object.values(FinancialPaymentMethod).map((method) => <option key={method} value={method}>{method}</option>)}</select>
            <input required type="date" value={form.launchDate} onChange={(event) => setForm({ ...form, launchDate: event.target.value })} className="rounded-md border-hope-100" />
            <input required type="date" value={form.referenceDate} onChange={(event) => setForm({ ...form, referenceDate: event.target.value })} className="rounded-md border-hope-100" />
            <select value={form.memberId} disabled={form.anonymous} onChange={(event) => setForm({ ...form, memberId: event.target.value })} className="rounded-md border-hope-100"><option value="">Sem membro</option>{data?.filters.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select>
            <select value={form.ministryId} onChange={(event) => setForm({ ...form, ministryId: event.target.value })} className="rounded-md border-hope-100"><option value="">Sem ministerio</option>{data?.filters.ministries.map((ministry) => <option key={ministry.id} value={ministry.id}>{ministry.name}</option>)}</select>
            <select value={form.eventId} onChange={(event) => setForm({ ...form, eventId: event.target.value })} className="rounded-md border-hope-100"><option value="">Sem evento</option>{data?.filters.events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select>
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as FinancialEntryStatus })} className="rounded-md border-hope-100">{Object.values(FinancialEntryStatus).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select>
            <label className="text-sm font-bold"><input type="checkbox" checked={form.anonymous} onChange={(event) => setForm({ ...form, anonymous: event.target.checked, memberId: event.target.checked ? "" : form.memberId })} /> Anonimo</label>
            <textarea value={form.observation} onChange={(event) => setForm({ ...form, observation: event.target.value })} placeholder="Observacao" className="rounded-md border-hope-100 md:col-span-2" />
            <button className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white md:col-span-2">Salvar</button>
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

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/30 p-4"><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-md bg-white p-5 shadow-xl"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">{title}</h2><button onClick={onClose} className="font-bold text-ink-600">Fechar</button></div>{children}</div></div>;
}
