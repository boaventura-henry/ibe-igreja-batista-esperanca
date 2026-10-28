"use client";

import { FormEvent, useState } from "react";
import { formatPhone, onlyDigits } from "@/utils";

type Status = "ACTIVE" | "INACTIVE" | "CONVERTED";
export type VisitorFormValue = {
  name: string; phone: string; birthDate: string; street?: string | null; number?: string | null; complement?: string | null;
  district?: string | null; city?: string | null; state?: string | null; status: Status;
};

export function VisitorForm({ value, onClose, onSaved }: { value: VisitorFormValue & { id: string }; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<VisitorFormValue>({
    name: value.name,
    phone: formatPhone(value.phone),
    birthDate: value.birthDate,
    street: value.street,
    number: value.number,
    complement: value.complement,
    district: value.district,
    city: value.city,
    state: value.state,
    status: value.status
  });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (key: keyof VisitorFormValue, next: string) => setForm((current) => ({ ...current, [key]: next }));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage("");
    const body = { ...form, phone: onlyDigits(form.phone), state: form.state?.toUpperCase() };
    try {
      const response = await fetch(`/api/visitors/${value.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { success: boolean; error?: { message?: string } };
      if (!result.success) setMessage(result.error?.message ?? "Nao foi possivel atualizar visitante.");
      else onSaved();
    } catch { setMessage("Nao foi possivel atualizar visitante."); }
    finally { setSaving(false); }
  }
  return <form onSubmit={submit} className="mt-5 space-y-4 rounded-md border border-hope-100 bg-hope-50 p-4">
    <h2 className="text-lg font-bold text-ink-900">Editar visitante</h2>
    {message ? <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800">{message}</p> : null}
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Nome" value={form.name} onChange={(next) => set("name", next)} required /><Field label="Telefone" value={form.phone} onChange={(next) => set("phone", formatPhone(next))} required inputMode="numeric" /><Field label="Data de nascimento" value={form.birthDate} onChange={(next) => set("birthDate", next)} required type="date" /><label className="grid gap-1 text-sm font-semibold">Situacao<select value={form.status} onChange={(event) => set("status", event.target.value)} className="rounded-md border border-hope-100 px-3 py-2"><option value="ACTIVE">Ativo</option><option value="INACTIVE">Inativo</option></select></label></div>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Endereco" value={form.street ?? ""} onChange={(next) => set("street", next)} /><Field label="Numero" value={form.number ?? ""} onChange={(next) => set("number", next)} /><Field label="Complemento" value={form.complement ?? ""} onChange={(next) => set("complement", next)} /><Field label="Bairro" value={form.district ?? ""} onChange={(next) => set("district", next)} /><Field label="Cidade" value={form.city ?? ""} onChange={(next) => set("city", next)} /><Field label="UF" value={form.state ?? ""} onChange={(next) => set("state", next)} maxLength={2} /></div>
    <div className="flex gap-2"><button type="submit" disabled={saving} className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? "Salvando..." : "Salvar"}</button><button type="button" onClick={onClose} disabled={saving} className="rounded-md border border-hope-100 px-4 py-2 text-sm font-bold">Cancelar</button></div>
  </form>;
}

function Field({ label, value, onChange, type = "text", required = false, inputMode, maxLength }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; inputMode?: "numeric"; maxLength?: number }) {
  return <label className="grid gap-1 text-sm font-semibold">{label}<input type={type} required={required} value={value} onChange={(event) => onChange(event.target.value)} inputMode={inputMode} maxLength={maxLength} className="rounded-md border border-hope-100 px-3 py-2" /></label>;
}
