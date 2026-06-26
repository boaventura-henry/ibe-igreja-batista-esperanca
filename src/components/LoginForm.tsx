"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError("");

    startTransition(async () => {
      const result = await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirect: false,
        callbackUrl: "/dashboard"
      });

      if (!result || result.error) {
        setError("Email ou senha invalidos.");
        return;
      }

      router.replace(result.url ?? "/dashboard");
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="grid gap-4">
      <label className="grid gap-2 text-sm font-semibold text-ink-700">
        Email
        <input
          name="email"
          type="email"
          placeholder="admin@ibe.org.br"
          autoComplete="email"
          required
          className="rounded-md border-hope-100 focus:border-hope-600 focus:ring-hope-600"
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-ink-700">
        Senha
        <input
          name="password"
          type="password"
          placeholder="********"
          autoComplete="current-password"
          required
          minLength={8}
          className="rounded-md border-hope-100 focus:border-hope-600 focus:ring-hope-600"
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
    </form>
  );
}
