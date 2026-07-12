"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import type { PublicPasswordResetRequestFormValues } from "@/types";

type ApiResponse<T> =
  | ({ success: true; data: T } & T)
  | { success: false; error: { code: string; message: string } };

const emptyForm: PublicPasswordResetRequestFormValues = {
  identifier: "",
  name: "",
  email: "",
  phone: "",
  cpf: ""
};

const inputClass =
  "w-full rounded-md border border-hope-100 px-3 py-2 text-sm font-semibold text-ink-800 outline-none transition focus:border-hope-500 focus:ring-2 focus:ring-hope-100";

export default function RecoverPasswordPage() {
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/password-reset-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          name: form.name || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          cpf: form.cpf || undefined
        })
      });
      const payload = (await response.json()) as ApiResponse<{ message: string }>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setMessage(payload.data.message);
      setForm(emptyForm);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel enviar a solicitacao.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-hope-50 px-4 py-8 text-ink-900">
      <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <section className="rounded-md border border-hope-100 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-hope-700">IBE</p>
          <h1 className="mt-3 text-3xl font-bold">Recuperar senha</h1>
          <p className="mt-3 text-sm leading-6 text-ink-600">
            Informe telefone ou CPF usado no login. A equipe administrativa avaliara a solicitacao e entregara uma
            senha temporaria quando o cadastro for confirmado.
          </p>
          <div className="mt-6 rounded-md bg-hope-50 p-4 text-sm font-semibold text-ink-700">
            Lembrou a senha?
            <Link href="/login" className="ml-1 text-hope-700 underline">
              Voltar para o login
            </Link>
          </div>
        </section>

        <section className="rounded-md border border-hope-100 bg-white shadow-sm">
          <form onSubmit={handleSubmit}>
            <div className="border-b border-hope-100 px-5 py-4">
              <h2 className="text-lg font-bold">Solicitacao de recuperacao</h2>
              <p className="text-sm text-ink-500">Por seguranca, a resposta publica nao confirma se o usuario existe.</p>
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-2">
              <Field label="Telefone ou CPF usado no login" className="md:col-span-2">
                <input
                  required
                  value={form.identifier}
                  onChange={(event) => setForm((current) => ({ ...current, identifier: event.target.value }))}
                  className={inputClass}
                  placeholder="Informe telefone ou CPF"
                />
              </Field>
              <Field label="Nome opcional">
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className={inputClass}
                />
              </Field>
              <Field label="E-mail opcional">
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  className={inputClass}
                  placeholder="voce@email.com"
                />
              </Field>
              <Field label="Telefone para contato opcional">
                <input
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                  className={inputClass}
                  placeholder="11999999999"
                />
              </Field>
              <Field label="CPF opcional">
                <input
                  value={form.cpf}
                  onChange={(event) => setForm((current) => ({ ...current, cpf: event.target.value }))}
                  className={inputClass}
                  placeholder="00000000000"
                />
              </Field>
            </div>

            {message ? (
              <div className="mx-5 mb-4 rounded-md border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                {message}
              </div>
            ) : null}

            {error ? (
              <div className="mx-5 mb-4 rounded-md border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </div>
            ) : null}

            <div className="flex justify-end border-t border-hope-100 px-5 py-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {isSubmitting ? "Enviando..." : "Enviar solicitacao"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
  className = ""
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`grid gap-1 text-xs font-bold uppercase tracking-wide text-ink-500 ${className}`}>
      {label}
      {children}
    </label>
  );
}
