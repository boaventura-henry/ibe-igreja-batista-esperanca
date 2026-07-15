"use client";

import { FormEvent, useState } from "react";
import type { MemberPortalProfile } from "@/types";

type ApiResponse<T> =
  | ({ success: true; data: T } & T)
  | { success: false; error: { code: string; message: string } };

const inputClass = "w-full rounded-md border border-hope-100 px-3 py-2 text-sm font-semibold text-ink-800 outline-none transition focus:border-hope-500 focus:ring-2 focus:ring-hope-100";

type FormState = {
  nickname: string;
  phone: string;
  mobilePhone: string;
  whatsapp: string;
  email: string;
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
};

function initialForm(profile: MemberPortalProfile): FormState {
  return {
    nickname: profile.nickname ?? "",
    phone: profile.phone ?? "",
    mobilePhone: profile.mobilePhone ?? "",
    whatsapp: profile.whatsapp ?? "",
    email: profile.email ?? "",
    zipCode: profile.zipCode ?? "",
    street: profile.street ?? "",
    number: profile.number ?? "",
    complement: profile.complement ?? "",
    district: profile.district ?? "",
    city: profile.city ?? "",
    state: profile.state ?? ""
  };
}

export function MemberProfileForm({ profile }: { profile: MemberPortalProfile }) {
  const [form, setForm] = useState<FormState>(initialForm(profile));
  const [message, setMessage] = useState("");

  function updateField(name: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    try {
      const response = await fetch("/api/portal/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const payload = (await response.json()) as ApiResponse<MemberPortalProfile>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setForm(initialForm(payload.data));
      setMessage("Cadastro atualizado com sucesso.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel atualizar seu cadastro.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {message ? <div className="rounded-md border border-hope-100 bg-hope-50 px-4 py-3 text-sm font-semibold text-ink-800">{message}</div> : null}

      <section className="rounded-md border border-hope-100 bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <Info label="Nome" value={profile.displayName} />
          <Info label="Apelido" value={profile.nickname ?? "-"} />
          <Info label="CPF" value={profile.cpf ?? "-"} />
          <Info label="RG" value={profile.rg ?? "-"} />
          <Info label="Nascimento" value={profile.birthDate ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(profile.birthDate)) : "-"} />
          <Info label="Status" value={profile.status} />
        </div>
      </section>

      <section className="rounded-md border border-hope-100 bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Apelido"><input maxLength={80} value={form.nickname} onChange={(event) => updateField("nickname", event.target.value)} className={inputClass} /></Field>
          <Field label="Telefone"><input value={form.phone} onChange={(event) => updateField("phone", event.target.value)} className={inputClass} /></Field>
          <Field label="Celular"><input value={form.mobilePhone} onChange={(event) => updateField("mobilePhone", event.target.value)} className={inputClass} /></Field>
          <Field label="WhatsApp"><input value={form.whatsapp} onChange={(event) => updateField("whatsapp", event.target.value)} className={inputClass} /></Field>
          <Field label="E-mail"><input type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} className={inputClass} /></Field>
          <Field label="CEP"><input value={form.zipCode} onChange={(event) => updateField("zipCode", event.target.value)} className={inputClass} /></Field>
          <Field label="Logradouro"><input value={form.street} onChange={(event) => updateField("street", event.target.value)} className={inputClass} /></Field>
          <Field label="Numero"><input value={form.number} onChange={(event) => updateField("number", event.target.value)} className={inputClass} /></Field>
          <Field label="Complemento"><input value={form.complement} onChange={(event) => updateField("complement", event.target.value)} className={inputClass} /></Field>
          <Field label="Bairro"><input value={form.district} onChange={(event) => updateField("district", event.target.value)} className={inputClass} /></Field>
          <Field label="Cidade"><input value={form.city} onChange={(event) => updateField("city", event.target.value)} className={inputClass} /></Field>
          <Field label="Estado"><input maxLength={2} value={form.state} onChange={(event) => updateField("state", event.target.value.toUpperCase())} className={inputClass} /></Field>
        </div>
        <div className="mt-5 flex justify-end">
          <button type="submit" className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white">Salvar cadastro</button>
        </div>
      </section>
    </form>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-ink-900">{value}</dd>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-ink-500">
      {label}
      {children}
    </label>
  );
}
