"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { FormMessage } from "@/components/ui/FormMessage";
import type { FinancialClosingFormValues, FinancialClosingListResult, FinancialClosingSummary } from "@/types";

type ApiResponse<T> = ({ success: true; data: T } & T) | { success: false; error: { code: string; message: string } };

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm: FinancialClosingFormValues = { date: today(), openingBalance: 0, closingBalance: 0, observation: "" };

function currency(value: string | number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

function dateForInput(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

export function FinancialClosingManager() {
  const { data: session } = useSession();
  const [data, setData] = useState<FinancialClosingListResult | null>(null);
  const [message, setMessage] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [form, setForm] = useState<FinancialClosingFormValues>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<FinancialClosingSummary | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [filters, setFilters] = useState({ search: "", page: "1" });
  const permissions = session?.user.permissionCodes ?? [];

  const query = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
    params.set("pageSize", "10");
    return params.toString();
  }, [filters]);

  const load = useCallback(async () => {
    const response = await fetch(`/api/financial/closings?${query}`, { cache: "no-store" });
    const payload = (await response.json()) as ApiResponse<FinancialClosingListResult>;
    if (payload.success) setData(payload.data);
    else setMessage(payload.error.message);
  }, [query]);

  useEffect(() => {
    const timeout = window.setTimeout(load, 250);
    return () => window.clearTimeout(timeout);
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormMessage("");
    setIsFormOpen(true);
  }

  async function openEdit(id: string) {
    const response = await fetch(`/api/financial/closings/${id}`);
    const payload = (await response.json()) as ApiResponse<FinancialClosingSummary>;
    if (!payload.success) return setFormMessage(payload.error.message);
    setFormMessage("");
    setEditingId(id);
    setForm({
      date: dateForInput(payload.data.date),
      openingBalance: Number(payload.data.openingBalance),
      closingBalance: Number(payload.data.closingBalance),
      observation: payload.data.observation ?? ""
    });
    setIsFormOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormMessage("");
    const response = await fetch(editingId ? `/api/financial/closings/${editingId}` : "/api/financial/closings", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        openingBalance: Number(form.openingBalance),
        closingBalance: Number(form.closingBalance),
        observation: form.observation || null
      })
    });
    const payload = (await response.json()) as ApiResponse<FinancialClosingSummary>;
    if (!payload.success) return setMessage(payload.error.message);
    setMessage(editingId ? "Fechamento atualizado." : "Fechamento criado.");
    setIsFormOpen(false);
    await load();
  }

  async function remove(id: string) {
    const response = await fetch(`/api/financial/closings/${id}`, { method: "DELETE" });
    const payload = (await response.json()) as ApiResponse<{ id: string }>;
    setMessage(payload.success ? "Fechamento removido." : payload.error.message);
    await load();
  }

  return (
    <div className="grid gap-4">
      {message ? <p className="rounded-md border border-hope-100 bg-white px-4 py-3 text-sm font-semibold text-ink-700">{message}</p> : null}
      <div className="grid gap-3 rounded-md border border-hope-100 bg-white p-4 shadow-sm md:grid-cols-[1fr_auto]">
        <input value={filters.search} onChange={(event) => setFilters({ search: event.target.value, page: "1" })} placeholder="Pesquisar observacao" className="rounded-md border-hope-100" />
        {permissions.includes("financialClosing.create") ? <button onClick={openCreate} className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white">Novo fechamento</button> : null}
      </div>
      <div className="overflow-x-auto rounded-md border border-hope-100 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-hope-50 text-xs uppercase text-ink-500"><tr><th className="px-4 py-3">Data</th><th>Abertura</th><th>Fechamento</th><th>Observacao</th><th className="px-4 text-right">Acoes</th></tr></thead>
          <tbody>{data?.closings.map((closing) => <tr key={closing.id} className="border-t border-hope-100"><td className="px-4 py-3 font-bold">{dateForInput(closing.date)}</td><td>{currency(closing.openingBalance)}</td><td>{currency(closing.closingBalance)}</td><td>{closing.observation ?? "-"}</td><td className="px-4 text-right"><button onClick={() => setViewing(closing)} className="mr-2 font-bold text-hope-700">Ver</button>{permissions.includes("financialClosing.update") ? <button onClick={() => openEdit(closing.id)} className="mr-2 font-bold text-hope-700">Editar</button> : null}{permissions.includes("financialClosing.delete") ? <button onClick={() => remove(closing.id)} className="font-bold text-red-700">Remover</button> : null}</td></tr>)}</tbody>
        </table>
      </div>
      {data?.pagination ? <div className="flex flex-wrap justify-end gap-2 text-sm font-bold"><button disabled={data.pagination.page <= 1} onClick={() => setFilters({ ...filters, page: String(data.pagination.page - 1) })} className="rounded-md border px-3 py-2 disabled:opacity-40">Anterior</button><span>{data.pagination.page} / {data.pagination.totalPages}</span><button disabled={data.pagination.page >= data.pagination.totalPages} onClick={() => setFilters({ ...filters, page: String(data.pagination.page + 1) })} className="rounded-md border px-3 py-2 disabled:opacity-40">Proxima</button></div> : null}
      {isFormOpen ? <Modal title={editingId ? "Editar fechamento" : "Novo fechamento"} onClose={() => setIsFormOpen(false)}><form onSubmit={submit} className="grid gap-3"><FormMessage id="financial-closing-form-message">{formMessage}</FormMessage><input type="date" required value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} className="rounded-md border-hope-100" /><input type="number" step="0.01" value={form.openingBalance} onChange={(event) => setForm({ ...form, openingBalance: Number(event.target.value) })} className="rounded-md border-hope-100" /><input type="number" step="0.01" value={form.closingBalance} onChange={(event) => setForm({ ...form, closingBalance: Number(event.target.value) })} className="rounded-md border-hope-100" /><textarea value={form.observation} onChange={(event) => setForm({ ...form, observation: event.target.value })} className="rounded-md border-hope-100" /><button className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white">Salvar</button></form></Modal> : null}
      {viewing ? <Modal title={`Fechamento ${dateForInput(viewing.date)}`} onClose={() => setViewing(null)}><p>{currency(viewing.openingBalance)} para {currency(viewing.closingBalance)}</p></Modal> : null}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/30 p-4"><div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-md bg-white p-5 shadow-xl"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">{title}</h2><button onClick={onClose} className="font-bold text-ink-600">Fechar</button></div>{children}</div></div>;
}
