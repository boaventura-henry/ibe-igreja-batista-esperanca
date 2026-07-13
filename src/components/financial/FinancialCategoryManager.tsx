"use client";

import { FinancialEntryType } from "@prisma/client";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { FormMessage } from "@/components/ui/FormMessage";
import type { FinancialCategoryFormValues, FinancialCategoryListResult, FinancialCategorySummary } from "@/types";

type ApiResponse<T> =
  | ({ success: true; data: T } & T)
  | { success: false; error: { code: string; message: string } };

const emptyForm: FinancialCategoryFormValues = {
  name: "",
  description: "",
  type: FinancialEntryType.INCOME,
  displayOrder: 0,
  showInMemberPortal: false,
  isActive: true
};

const typeLabels = {
  INCOME: "Entrada",
  EXPENSE: "Saida"
} as const;

export function FinancialCategoryManager() {
  const { data: session } = useSession();
  const [data, setData] = useState<FinancialCategoryListResult | null>(null);
  const [message, setMessage] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [form, setForm] = useState<FinancialCategoryFormValues>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<FinancialCategorySummary | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [filters, setFilters] = useState({ search: "", type: "", page: "1" });
  const permissions = session?.user.permissionCodes ?? [];

  const query = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
    params.set("pageSize", "10");
    return params.toString();
  }, [filters]);

  const load = useCallback(async () => {
    const response = await fetch(`/api/financial/categories?${query}`, { cache: "no-store" });
    const payload = (await response.json()) as ApiResponse<FinancialCategoryListResult>;
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
    const response = await fetch(`/api/financial/categories/${id}`);
    const payload = (await response.json()) as ApiResponse<FinancialCategorySummary>;
    if (!payload.success) return setFormMessage(payload.error.message);
    setFormMessage("");
    const category = payload.data;
    setEditingId(id);
    setForm({
      name: category.name,
      description: category.description ?? "",
      type: category.type,
      displayOrder: category.displayOrder,
      showInMemberPortal: category.showInMemberPortal,
      isActive: category.isActive
    });
    setIsFormOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormMessage("");
    const response = await fetch(editingId ? `/api/financial/categories/${editingId}` : "/api/financial/categories", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, description: form.description || null, displayOrder: Number(form.displayOrder || 0) })
    });
    const payload = (await response.json()) as ApiResponse<FinancialCategorySummary>;
    if (!payload.success) return setMessage(payload.error.message);
    setMessage(editingId ? "Categoria atualizada." : "Categoria criada.");
    setIsFormOpen(false);
    await load();
  }

  async function remove(category: FinancialCategorySummary) {
    if (!window.confirm(`Remover ${category.name}?`)) return;
    const response = await fetch(`/api/financial/categories/${category.id}`, { method: "DELETE" });
    const payload = (await response.json()) as ApiResponse<{ id: string }>;
    setMessage(payload.success ? "Categoria removida." : payload.error.message);
    await load();
  }

  return (
    <div className="grid gap-4">
      {message ? <p className="rounded-md border border-hope-100 bg-white px-4 py-3 text-sm font-semibold text-ink-700">{message}</p> : null}
      <div className="grid gap-3 rounded-md border border-hope-100 bg-white p-4 shadow-sm md:grid-cols-[1fr_180px_auto]">
        <input value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Pesquisar" className="rounded-md border-hope-100" />
        <select value={filters.type} onChange={(event) => updateFilter("type", event.target.value)} className="rounded-md border-hope-100">
          <option value="">Todos</option>
          {Object.values(FinancialEntryType).map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}
        </select>
        {permissions.includes("financialCategory.create") ? <button onClick={openCreate} className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white">Nova categoria</button> : null}
      </div>
      <div className="overflow-x-auto rounded-md border border-hope-100 bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-hope-50 text-xs uppercase text-ink-500">
            <tr><th className="px-4 py-3">Nome</th><th>Tipo</th><th>Portal</th><th>Ordem</th><th>Status</th><th className="px-4 text-right">Acoes</th></tr>
          </thead>
          <tbody>
            {data?.categories.map((category) => (
              <tr key={category.id} className="border-t border-hope-100">
                <td className="px-4 py-3 font-semibold">{category.name}</td>
                <td>{typeLabels[category.type]}</td>
                <td>{category.showInMemberPortal ? "Sim" : "Nao"}</td>
                <td>{category.displayOrder}</td>
                <td>{category.isActive ? "Ativa" : "Inativa"}</td>
                <td className="px-4 text-right">
                  <button onClick={() => setViewing(category)} className="mr-2 font-bold text-hope-700">Ver</button>
                  {permissions.includes("financialCategory.update") ? <button onClick={() => openEdit(category.id)} className="mr-2 font-bold text-hope-700">Editar</button> : null}
                  {permissions.includes("financialCategory.delete") ? <button onClick={() => remove(category)} className="font-bold text-red-700">Remover</button> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data?.pagination ? <Pager page={data.pagination.page} totalPages={data.pagination.totalPages} onPage={(page) => updateFilter("page", String(page))} /> : null}
      {isFormOpen ? (
        <Modal title={editingId ? "Editar categoria" : "Nova categoria"} onClose={() => setIsFormOpen(false)}>
          <form onSubmit={submit} className="grid gap-3">
            <FormMessage id="financial-category-form-message">{formMessage}</FormMessage>
            <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nome" className="rounded-md border-hope-100" />
            <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Descricao" className="rounded-md border-hope-100" />
            <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as FinancialEntryType })} className="rounded-md border-hope-100">
              {Object.values(FinancialEntryType).map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}
            </select>
            <input type="number" min={0} value={form.displayOrder} onChange={(event) => setForm({ ...form, displayOrder: Number(event.target.value) })} className="rounded-md border-hope-100" />
            <label className="text-sm font-bold"><input type="checkbox" checked={form.showInMemberPortal} onChange={(event) => setForm({ ...form, showInMemberPortal: event.target.checked })} /> Mostrar no portal</label>
            <label className="text-sm font-bold"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Ativa</label>
            <button className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white">Salvar</button>
          </form>
        </Modal>
      ) : null}
      {viewing ? <Modal title={viewing.name} onClose={() => setViewing(null)}><p className="text-sm text-ink-600">{viewing.description ?? "Sem descricao."}</p></Modal> : null}
    </div>
  );
}

function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  return <div className="flex flex-wrap items-center justify-end gap-2 text-sm font-bold"><button disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-md border px-3 py-2 disabled:opacity-40">Anterior</button><span>{page} / {totalPages}</span><button disabled={page >= totalPages} onClick={() => onPage(page + 1)} className="rounded-md border px-3 py-2 disabled:opacity-40">Proxima</button></div>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/30 p-4"><div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-md bg-white p-5 shadow-xl"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">{title}</h2><button onClick={onClose} className="font-bold text-ink-600">Fechar</button></div>{children}</div></div>;
}
