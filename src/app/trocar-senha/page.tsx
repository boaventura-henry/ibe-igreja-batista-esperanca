"use client";

import { signOut, useSession } from "next-auth/react";
import { FormEvent, useState } from "react";
import { PasswordInput } from "@/components/PasswordInput";

type ApiResponse<T> =
  | ({ success: true; data: T } & T)
  | { success: false; error: { code: string; message: string } };

const inputClass =
  "w-full rounded-md border border-hope-100 px-3 py-2 text-sm font-semibold text-ink-800 outline-none transition focus:border-hope-500 focus:ring-2 focus:ring-hope-100";

export default function ChangePasswordPage() {
  const { data: session } = useSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/change-required-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, password, confirmPassword })
      });
      const payload = (await response.json()) as ApiResponse<unknown>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setMessage("Senha alterada com sucesso. Entre novamente usando a nova senha.");
      window.setTimeout(() => {
        void signOut({ callbackUrl: "/login" });
      }, 1200);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Nao foi possivel alterar a senha.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-hope-50 px-4 py-8 text-ink-900">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center">
        <section className="w-full rounded-md border border-hope-100 bg-white p-6 shadow-soft">
          <p className="text-xs font-bold uppercase tracking-wide text-hope-700">Seguranca</p>
          <h1 className="mt-3 text-2xl font-bold">Trocar senha</h1>
          <p className="mt-2 text-sm leading-6 text-ink-600">
            {session?.user.mustChangePassword
              ? "Voce precisa definir uma nova senha para continuar usando o sistema."
              : "Atualize sua senha de acesso ao sistema."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm font-semibold text-ink-700">
              Senha atual
              <PasswordInput
                required
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className={inputClass}
                placeholder="Digite sua senha atual"
                autoComplete="current-password"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-ink-700">
              Nova senha
              <PasswordInput
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={inputClass}
                placeholder="Digite sua nova senha"
                minLength={6}
                autoComplete="new-password"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-ink-700">
              Confirmar nova senha
              <PasswordInput
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className={inputClass}
                placeholder="Confirme sua nova senha"
                minLength={6}
                autoComplete="new-password"
              />
            </label>

            {message ? (
              <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800" role="status">
                {message}
              </p>
            ) : null}

            {error ? (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-11 items-center justify-center rounded-md bg-hope-600 px-4 text-sm font-bold text-white transition hover:bg-hope-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Salvando..." : "Alterar senha"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
