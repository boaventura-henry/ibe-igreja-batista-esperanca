"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";

type Option = { id: string; name: string; isActive?: boolean };
type ApiResponse<T> = { success: boolean; data?: T; error?: { message?: string } };
type InstrumentInitial = {
  id: string;
  name: string;
  categoryId: string;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  assetNumber?: string | null;
  acquisitionDate?: string | null;
  acquisitionValue?: string | null;
  ministryId?: string | null;
  status: "ACTIVE" | "MAINTENANCE" | "INACTIVE";
  notes?: string | null;
};
type InstrumentFormState = Omit<InstrumentInitial, "id">;
type HistoryInitial = {
  id: string;
  type: "MAINTENANCE" | "REPLACEMENT" | "OTHER";
  occurredAt: string;
  description: string;
  cost?: string | null;
  serviceProvider?: string | null;
  notes?: string | null;
  relatedInstrumentId?: string | null;
};
type HistoryFormState = Omit<HistoryInitial, "id">;

const input = "w-full rounded-md border border-hope-100 px-3 py-2 text-sm";
const dateInput = (value?: string | null) => value?.slice(0, 10) ?? "";
const toAmount = (value: string) => value === "" ? undefined : Number(value.replace(",", "."));

export function InstrumentForm({ initial, onClose, onSaved }: { initial?: InstrumentInitial; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<InstrumentFormState>({ name: "", categoryId: "", brand: "", model: "", serialNumber: "", assetNumber: "", acquisitionDate: "", acquisitionValue: "", ministryId: "", status: "ACTIVE", notes: "", ...initial });
  const [categories, setCategories] = useState<Option[]>([]);
  const [ministries, setMinistries] = useState<Option[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void Promise.all([fetch("/api/instrument-categories?pageSize=100"), fetch("/api/ministries?pageSize=100&status=ACTIVE")]).then(async ([categoryResponse, ministryResponse]) => {
      const categoriesPayload = await categoryResponse.json() as ApiResponse<{ categories: Option[] }>;
      const ministriesPayload = await ministryResponse.json() as ApiResponse<{ ministries: Option[] }>;
      if (categoriesPayload.success) setCategories(categoriesPayload.data?.categories ?? []);
      if (ministriesPayload.success) setMinistries(ministriesPayload.data?.ministries ?? []);
    });
  }, []);

  const update = <K extends keyof InstrumentFormState>(key: K, value: InstrumentFormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError("");
    const payload = { ...form, acquisitionValue: toAmount(form.acquisitionValue ?? ""), acquisitionDate: form.acquisitionDate || undefined, ministryId: form.ministryId || undefined };
    const response = await fetch(initial ? `/api/instruments/${initial.id}` : "/api/instruments", { method: initial ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json() as ApiResponse<unknown>;
    setSaving(false);
    if (!result.success) { setError(result.error?.message ?? "Nao foi possivel salvar o instrumento."); return; }
    onSaved(); onClose();
  }

  return <div role="dialog" aria-modal="true" aria-label={initial ? "Editar instrumento" : "Novo instrumento"} className="fixed inset-0 z-50 overflow-y-auto bg-ink-900/45 p-4"><form onSubmit={save} className="mx-auto my-6 max-w-2xl rounded-md bg-white shadow-soft"><header className="flex justify-between border-b p-4"><h2 className="font-bold">{initial ? "Editar instrumento" : "Novo instrumento"}</h2><button type="button" aria-label="Fechar" onClick={onClose}>Fechar</button></header><div className="grid gap-3 p-4 md:grid-cols-2">{error && <p role="alert" className="md:col-span-2 rounded bg-red-50 p-2 text-sm">{error}</p>}<Field label="Nome *"><input autoFocus required className={input} value={form.name} onChange={(event) => update("name", event.target.value)} /></Field><Field label="Categoria *"><select required className={input} value={form.categoryId} onChange={(event) => update("categoryId", event.target.value)}><option value="">Selecione</option>{categories.filter((category) => category.isActive || category.id === form.categoryId).map((category) => <option key={category.id} value={category.id}>{category.name}{category.isActive === false ? " (inativa)" : ""}</option>)}</select></Field><Field label="Marca"><input className={input} value={form.brand ?? ""} onChange={(event) => update("brand", event.target.value)} /></Field><Field label="Modelo"><input className={input} value={form.model ?? ""} onChange={(event) => update("model", event.target.value)} /></Field><Field label="Numero de serie"><input className={input} value={form.serialNumber ?? ""} onChange={(event) => update("serialNumber", event.target.value)} /></Field><Field label="Patrimonio"><input className={input} value={form.assetNumber ?? ""} onChange={(event) => update("assetNumber", event.target.value)} /></Field><Field label="Data de aquisicao"><input type="date" className={input} value={dateInput(form.acquisitionDate)} onChange={(event) => update("acquisitionDate", event.target.value)} /></Field><Field label="Valor de aquisicao (R$)"><input inputMode="decimal" className={input} value={form.acquisitionValue ?? ""} onChange={(event) => update("acquisitionValue", event.target.value)} /></Field><Field label="Ministerio"><select className={input} value={form.ministryId ?? ""} onChange={(event) => update("ministryId", event.target.value)}><option value="">Sem Ministerio</option>{ministries.filter((ministry) => ministry.isActive !== false || ministry.id === form.ministryId).map((ministry) => <option key={ministry.id} value={ministry.id}>{ministry.name}</option>)}</select></Field><Field label="Situacao"><select className={input} value={form.status} onChange={(event) => update("status", event.target.value as InstrumentFormState["status"])}><option value="ACTIVE">Ativo</option><option value="MAINTENANCE">Em manutencao</option><option value="INACTIVE">Inativo</option></select></Field><Field label="Observacoes" className="md:col-span-2"><textarea className={input} value={form.notes ?? ""} onChange={(event) => update("notes", event.target.value)} /></Field></div><footer className="flex justify-end gap-2 border-t p-4"><button type="button" onClick={onClose}>Cancelar</button><button disabled={saving} className="rounded bg-hope-600 px-4 py-2 text-white">{saving ? "Salvando..." : "Salvar"}</button></footer></form></div>;
}

export function HistoryForm({ instrumentId, type, onClose, onSaved, initial, historyId }: { instrumentId: string; type?: HistoryInitial["type"]; onClose: () => void; onSaved: () => void; initial?: HistoryInitial; historyId?: string }) {
  const [form, setForm] = useState<HistoryFormState>({ type: type ?? initial?.type ?? "MAINTENANCE", occurredAt: dateInput(initial?.occurredAt || new Date().toISOString()), description: initial?.description ?? "", cost: initial?.cost ?? "", serviceProvider: initial?.serviceProvider ?? "", notes: initial?.notes ?? "", relatedInstrumentId: initial?.relatedInstrumentId ?? "" });
  const [options, setOptions] = useState<Option[]>([]); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  useEffect(() => { void fetch("/api/instruments?pageSize=100").then((response) => response.json()).then((result: ApiResponse<{ instruments: Option[] }>) => { if (result.success) setOptions((result.data?.instruments ?? []).filter((instrument) => instrument.id !== instrumentId)); }); }, [instrumentId]);
  const update = <K extends keyof HistoryFormState>(key: K, value: HistoryFormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  function changeType(value: HistoryInitial["type"]) { setForm((current) => ({ ...current, type: value, relatedInstrumentId: value === "REPLACEMENT" ? current.relatedInstrumentId : "" })); }
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (saving) return; setSaving(true); setError(""); const payload = { ...form, cost: toAmount(form.cost ?? ""), relatedInstrumentId: form.type === "REPLACEMENT" ? form.relatedInstrumentId : undefined }; const response = await fetch(historyId ? `/api/instruments/${instrumentId}/history/${historyId}` : `/api/instruments/${instrumentId}/history`, { method: historyId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const result = await response.json() as ApiResponse<unknown>; setSaving(false); if (!result.success) { setError(result.error?.message ?? "Nao foi possivel salvar o historico."); return; } onSaved(); onClose(); }
  return <div role="dialog" aria-modal="true" aria-label={historyId ? "Editar historico" : "Registrar historico"} className="fixed inset-0 z-50 overflow-y-auto bg-ink-900/45 p-4"><form onSubmit={save} className="mx-auto my-8 max-w-lg rounded-md bg-white p-5"><h2 className="font-bold">{historyId ? "Editar historico" : "Registrar historico"}</h2>{error && <p role="alert" className="mt-2 bg-red-50 p-2 text-sm">{error}</p>}<div className="mt-4 grid gap-3"><Field label="Tipo"><select className={input} value={form.type} onChange={(event) => changeType(event.target.value as HistoryInitial["type"])}><option value="MAINTENANCE">Manutencao</option><option value="REPLACEMENT">Substituicao</option><option value="OTHER">Outro</option></select></Field><Field label="Data *"><input required type="date" className={input} value={form.occurredAt} onChange={(event) => update("occurredAt", event.target.value)} /></Field>{form.type === "REPLACEMENT" && <Field label="Instrumento substituto *"><select required className={input} value={form.relatedInstrumentId ?? ""} onChange={(event) => update("relatedInstrumentId", event.target.value)}><option value="">Selecione</option>{options.map((option) => <option value={option.id} key={option.id}>{option.name}</option>)}</select></Field>}<Field label="Descricao *"><textarea required className={input} value={form.description} onChange={(event) => update("description", event.target.value)} /></Field><Field label="Custo (R$)"><input inputMode="decimal" className={input} value={form.cost ?? ""} onChange={(event) => update("cost", event.target.value)} /></Field><Field label="Prestador/Fornecedor"><input className={input} value={form.serviceProvider ?? ""} onChange={(event) => update("serviceProvider", event.target.value)} /></Field><Field label="Observacoes"><textarea className={input} value={form.notes ?? ""} onChange={(event) => update("notes", event.target.value)} /></Field></div><footer className="mt-4 flex justify-end gap-2"><button type="button" onClick={onClose}>Cancelar</button><button disabled={saving} className="rounded bg-hope-600 px-4 py-2 text-white">{saving ? "Salvando..." : "Salvar"}</button></footer></form></div>;
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) { return <label className={`grid gap-1 text-xs font-bold uppercase text-ink-500 ${className}`}>{label}{children}</label>; }