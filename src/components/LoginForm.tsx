"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PasswordInput } from "./PasswordInput";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError("");

    startTransition(async () => {
      const result = await signIn("credentials", {
        username: formData.get("username"),
        password: formData.get("password"),
        redirect: false,
        callbackUrl: "/dashboard"
      });

      if (!result || result.error) {
        setError("Usuario ou senha invalidos.");
        return;
      }

      router.replace(result.url ?? "/dashboard");
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="grid gap-4">
      <label className="grid gap-2 text-sm font-semibold text-ink-700">
        Telefone ou CPF
        <input
          name="username"
          type="text"
          placeholder="Informe telefone ou CPF"
          autoComplete="username"
          required
          minLength={4}
          maxLength={30}
          className="rounded-md border-hope-100 focus:border-hope-600 focus:ring-hope-600"
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-ink-700">
        Senha
        <PasswordInput
          name="password"
          placeholder="Digite sua senha"
          autoComplete="current-password"
          required
          minLength={6}
          className="w-full rounded-md border-hope-100 focus:border-hope-600 focus:ring-hope-600"
        />
      </label>

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="mt-2 inline-flex h-11 items-center justify-center rounded-md bg-hope-600 px-4 text-sm font-bold text-white transition hover:bg-hope-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? "Entrando..." : "Acessar dashboard"}
      </button>
      <div className="grid gap-2 text-center text-sm font-bold text-hope-700">
        <Link href="/recuperar-senha" className="underline">
          Esqueci minha senha
        </Link>
        <Link href="/solicitar-acesso" className="underline">
          Solicitar acesso
        </Link>
      </div>
    </form>
  );
}
