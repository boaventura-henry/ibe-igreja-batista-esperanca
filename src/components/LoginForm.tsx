"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const [showPassword, setShowPassword] = useState(false);

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
        <div className="relative">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="Digite sua senha"
            autoComplete="current-password"
            required
            minLength={6}
            className="w-full rounded-md border-hope-100 pr-10 focus:border-hope-600 focus:ring-hope-600"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            onMouseDown={(e) => e.preventDefault()}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 focus:outline-none focus:text-ink-600"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPassword ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="h-5 w-5"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="h-5 w-5"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>
            )}
          </button>
        </div>
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
      <Link href="/solicitar-acesso" className="text-center text-sm font-bold text-hope-700 underline">
        Solicitar acesso
      </Link>
    </form>
  );
}
