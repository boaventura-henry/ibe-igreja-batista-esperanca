"use client";

import { FormEvent, useState } from "react";
import { PasswordInput } from "@/components/PasswordInput";
import type { MemberAccountData } from "@/types";

type ApiResponse<T> =
  | ({ success: true; data: T } & T)
  | { success: false; error: { code: string; message: string } };

type AccountForm = {
  phone: string;
  email: string;
};

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const inputClass =
  "w-full rounded-md border border-hope-100 px-3 py-2 text-sm font-semibold text-ink-800 outline-none transition focus:border-hope-500 focus:ring-2 focus:ring-hope-100";

function accountForm(account: MemberAccountData): AccountForm {
  return {
    phone: account.phone ?? "",
    email: account.email ?? account.member?.email ?? ""
  };
}

const emptyPasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: ""
};

export function MemberAccountManager({ account }: { account: MemberAccountData }) {
  const [currentAccount, setCurrentAccount] = useState(account);
  const [form, setForm] = useState<AccountForm>(accountForm(account));
  const [passwordForm, setPasswordForm] = useState<PasswordForm>(emptyPasswordForm);
  const [accountMessage, setAccountMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  async function handleAccountSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAccountMessage("");
    setIsSavingAccount(true);

    try {
      const response = await fetch("/api/portal/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const payload = (await response.json()) as ApiResponse<MemberAccountData>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setCurrentAccount(payload.data);
      setForm(accountForm(payload.data));
      setAccountMessage("Dados da conta atualizados com sucesso.");
    } catch (error) {
      setAccountMessage(error instanceof Error ? error.message : "Nao foi possivel atualizar os dados da conta.");
    } finally {
      setIsSavingAccount(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordMessage("");
    setIsChangingPassword(true);

    try {
      const response = await fetch("/api/portal/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwordForm)
      });
      const payload = (await response.json()) as ApiResponse<MemberAccountData>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setCurrentAccount(payload.data);
      setPasswordForm(emptyPasswordForm);
      setPasswordMessage("Senha alterada com sucesso.");
    } catch (error) {
      setPasswordMessage(error instanceof Error ? error.message : "Nao foi possivel alterar sua senha.");
    } finally {
      setIsChangingPassword(false);
    }
  }

  return (
    <div className="grid gap-5">
      {!currentAccount.member ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          Seu usuario ainda nao esta vinculado a um cadastro de membro. Alguns dados aparecem apenas para consulta.
        </div>
      ) : null}

      <form onSubmit={handleAccountSubmit} className="rounded-md border border-hope-100 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-ink-900">Dados da Conta</h2>
          <p className="mt-1 text-sm text-ink-500">Somente telefone e e-mail podem ser alterados por aqui.</p>
        </div>

        {accountMessage ? (
          <div className="mb-4 rounded-md border border-hope-100 bg-hope-50 px-4 py-3 text-sm font-semibold text-ink-800" role="status">
            {accountMessage}
          </div>
        ) : null}

        <dl className="grid gap-4 md:grid-cols-3">
          <Info label="Nome" value={currentAccount.member?.displayName ?? currentAccount.name} />
          <Info label="CPF" value={currentAccount.member?.cpf ?? "-"} />
          <Info label="Login atual" value={currentAccount.maskedLogin} />
          <Info label="Perfil de acesso" value={currentAccount.accessRole?.name ?? "-"} />
          <Info label="Status" value={currentAccount.isActive ? "Ativo" : "Inativo"} />
          <Info
            label="Ultimo login"
            value={currentAccount.lastLoginAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(currentAccount.lastLoginAt)) : "-"}
          />
        </dl>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Telefone">
            <input
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              className={inputClass}
              inputMode="tel"
              autoComplete="tel"
              placeholder="Informe seu telefone"
            />
          </Field>
          <Field label="E-mail">
            <input
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              className={inputClass}
              type="email"
              autoComplete="email"
              placeholder="Informe seu e-mail"
            />
          </Field>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            disabled={isSavingAccount}
            className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-hope-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSavingAccount ? "Salvando..." : "Salvar dados"}
          </button>
        </div>
      </form>

      <form onSubmit={handlePasswordSubmit} className="rounded-md border border-hope-100 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-ink-900">Alterar Senha</h2>
          <p className="mt-1 text-sm text-ink-500">Use sua senha atual para definir uma nova senha de acesso.</p>
        </div>

        {passwordMessage ? (
          <div className="mb-4 rounded-md border border-hope-100 bg-hope-50 px-4 py-3 text-sm font-semibold text-ink-800" role="status">
            {passwordMessage}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Senha atual">
            <PasswordInput
              value={passwordForm.currentPassword}
              onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
              className={inputClass}
              autoComplete="current-password"
              required
            />
          </Field>
          <Field label="Nova senha">
            <PasswordInput
              value={passwordForm.newPassword}
              onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
              className={inputClass}
              autoComplete="new-password"
              required
              minLength={6}
            />
          </Field>
          <Field label="Confirmar nova senha">
            <PasswordInput
              value={passwordForm.confirmPassword}
              onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
              className={inputClass}
              autoComplete="new-password"
              required
              minLength={6}
            />
          </Field>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            disabled={isChangingPassword}
            className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-hope-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isChangingPassword ? "Alterando..." : "Alterar senha"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-ink-900">{value}</dd>
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
