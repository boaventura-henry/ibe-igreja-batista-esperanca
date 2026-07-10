"use client";

import { UserRole } from "@prisma/client";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { UserFormValues, UserListResult, UserSummary } from "@/types";

type ApiResponse<T> =
  | ({ success: true; data: T } & T)
  | { success: false; error: { code: string; message: string } };

const emptyForm: UserFormValues = {
  name: "",
  username: "",
  email: "",
  password: "",
  role: "LEADER",
  memberId: "",
  accessRoleId: "",
  isActive: true,
  mustChangePassword: true
};

const statusOptions = [
  { value: "", label: "Todos" },
  { value: "ACTIVE", label: "Ativo" },
  { value: "INACTIVE", label: "Inativo" },
  { value: "LOCKED", label: "Bloqueado" },
  { value: "MUST_CHANGE_PASSWORD", label: "Deve trocar senha" }
];

const roleOptions = [
  { value: "ADMIN", label: "Admin" },
  { value: "LEADER", label: "Lider" },
  { value: "TREASURER", label: "Tesouraria" }
];

const sortOptions = [
  { value: "name", label: "Nome" },
  { value: "username", label: "Login" },
  { value: "email", label: "E-mail" },
  { value: "lastLoginAt", label: "Ultimo login" },
  { value: "failedLoginAttempts", label: "Falhas" },
  { value: "updatedAt", label: "Atualizacao" }
];

function userStatus(user: UserSummary) {
  if (!user.isActive) {
    return "Inativo";
  }

  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    return "Bloqueado";
  }

  if (user.mustChangePassword) {
    return "Deve trocar senha";
  }

  return "Ativo";
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export function UserManager() {
  const [data, setData] = useState<UserListResult | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UserFormValues>(emptyForm);
  const [assignableMembers, setAssignableMembers] = useState<UserListResult["filters"]["members"]>([]);
  const [resetUser, setResetUser] = useState<UserSummary | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    accessRoleId: "",
    sortBy: "name",
    sortOrder: "asc",
    page: "1"
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });
    params.set("pageSize", "10");

    return params.toString();
  }, [filters]);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/users?${queryString}`, { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse<UserListResult>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setData(payload.data);
      setAssignableMembers(payload.data.filters.members);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel carregar usuarios.");
    } finally {
      setIsLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    const timeout = window.setTimeout(loadUsers, 250);

    return () => window.clearTimeout(timeout);
  }, [loadUsers]);

  function updateFilter(name: keyof typeof filters, value: string) {
    setFilters((current) => ({
      ...current,
      [name]: value,
      page: name === "page" ? value : "1"
    }));
  }

  function openCreateForm() {
    setEditingId(null);
    setForm(emptyForm);
    setAssignableMembers(data?.filters.members ?? []);
    setIsFormOpen(true);
    setMessage("");
  }

  async function openEditForm(id: string) {
    setMessage("");

    try {
      const response = await fetch(`/api/users/${id}`, { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse<{
        user: UserSummary;
        assignableMembers: UserListResult["filters"]["members"];
      }>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      const user = payload.data.user;
      setEditingId(id);
      setAssignableMembers(payload.data.assignableMembers);
      setForm({
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        memberId: user.member?.id ?? "",
        accessRoleId: user.accessRole?.id ?? "",
        isActive: user.isActive,
        mustChangePassword: user.mustChangePassword
      });
      setIsFormOpen(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel abrir o usuario.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    try {
      const body = {
        ...form,
        memberId: form.memberId || undefined,
        accessRoleId: form.accessRoleId || undefined
      };
      const response = await fetch(editingId ? `/api/users/${editingId}` : "/api/users", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { ...body, password: undefined } : body)
      });
      const payload = (await response.json()) as ApiResponse<UserSummary>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setIsFormOpen(false);
      setMessage(editingId ? "Usuario atualizado com sucesso." : "Usuario criado com sucesso.");
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel salvar o usuario.");
    }
  }

  async function runAction(path: string, successMessage: string, body?: unknown) {
    setMessage("");

    try {
      const response = await fetch(path, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined
      });
      const payload = (await response.json()) as ApiResponse<UserSummary>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setMessage(successMessage);
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel concluir a acao.");
    }
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!resetUser) {
      return;
    }

    await runAction(`/api/users/${resetUser.id}/reset-password`, "Senha redefinida com sucesso.", {
      password: newPassword
    });
    setResetUser(null);
    setNewPassword("");
  }

  const pagination = data?.pagination;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-md border border-hope-100 bg-white p-4 shadow-sm lg:grid-cols-6">
        <FilterInput
          label="Pesquisa"
          value={filters.search}
          onChange={(value) => updateFilter("search", value)}
          className="lg:col-span-2"
        />
        <label className={filterLabelClass}>
          Status
          <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)} className={filterInputClass}>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className={filterLabelClass}>
          Perfil
          <select value={filters.accessRoleId} onChange={(event) => updateFilter("accessRoleId", event.target.value)} className={filterInputClass}>
            <option value="">Todos</option>
            {data?.filters.accessRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </label>
        <label className={filterLabelClass}>
          Ordenar por
          <select value={filters.sortBy} onChange={(event) => updateFilter("sortBy", event.target.value)} className={filterInputClass}>
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className={filterLabelClass}>
          Direcao
          <select value={filters.sortOrder} onChange={(event) => updateFilter("sortOrder", event.target.value)} className={filterInputClass}>
            <option value="asc">Crescente</option>
            <option value="desc">Decrescente</option>
          </select>
        </label>
      </div>

      {message ? (
        <div className="rounded-md border border-hope-100 bg-hope-50 px-4 py-3 text-sm font-semibold text-ink-800">
          {message}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-md border border-hope-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-hope-100 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-ink-900">Usuarios do sistema</p>
            <p className="text-xs text-ink-500">{pagination ? `${pagination.total} registro(s)` : "Carregando"}</p>
          </div>
          <button type="button" onClick={openCreateForm} className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white">
            Novo usuario
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-hope-100 text-sm">
            <thead className="bg-hope-50 text-left text-xs font-bold uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3">Usuario/Login</th>
                <th className="px-4 py-3">Membro</th>
                <th className="px-4 py-3">Perfil</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Ultimo login</th>
                <th className="px-4 py-3">Falhas</th>
                <th className="px-4 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hope-100">
              {isLoading ? (
                <tr>
                  <td className="px-4 py-8 text-center font-semibold text-ink-500" colSpan={7}>
                    Carregando usuarios...
                  </td>
                </tr>
              ) : null}

              {!isLoading && data?.users.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center font-semibold text-ink-500" colSpan={7}>
                    Nenhum usuario encontrado.
                  </td>
                </tr>
              ) : null}

              {data?.users.map((user) => {
                const locked = Boolean(user.lockedUntil && new Date(user.lockedUntil) > new Date());

                return (
                  <tr key={user.id} className="align-top">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-ink-900">{user.name}</p>
                      <p className="text-xs font-semibold text-hope-700">{user.username}</p>
                      <p className="text-xs text-ink-500">{user.email}</p>
                    </td>
                    <td className="px-4 py-4 text-ink-700">{user.member?.name ?? "-"}</td>
                    <td className="px-4 py-4 text-ink-700">{user.accessRole?.name ?? "-"}</td>
                    <td className="px-4 py-4">
                      <span className="rounded-md bg-hope-50 px-2 py-1 text-xs font-bold text-hope-700">
                        {userStatus(user)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-ink-700">{formatDate(user.lastLoginAt)}</td>
                    <td className="px-4 py-4 text-ink-700">{user.failedLoginAttempts}</td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <ActionButton onClick={() => openEditForm(user.id)}>Editar</ActionButton>
                        <ActionButton onClick={() => setResetUser(user)}>Resetar senha</ActionButton>
                        <ActionButton
                          onClick={() =>
                            runAction(
                              `/api/users/${user.id}/${user.isActive ? "deactivate" : "activate"}`,
                              user.isActive ? "Usuario inativado." : "Usuario ativado."
                            )
                          }
                        >
                          {user.isActive ? "Inativar" : "Ativar"}
                        </ActionButton>
                        <ActionButton
                          onClick={() =>
                            runAction(
                              `/api/users/${user.id}/${locked ? "unlock" : "lock"}`,
                              locked ? "Usuario desbloqueado." : "Usuario bloqueado."
                            )
                          }
                        >
                          {locked ? "Desbloquear" : "Bloquear"}
                        </ActionButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {pagination ? (
          <div className="flex flex-col gap-3 border-t border-hope-100 px-4 py-3 text-sm text-ink-600 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Pagina {pagination.page} de {pagination.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => updateFilter("page", String(pagination.page - 1))}
                className="rounded-md border border-hope-100 px-3 py-2 font-bold disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => updateFilter("page", String(pagination.page + 1))}
                className="rounded-md border border-hope-100 px-3 py-2 font-bold disabled:opacity-40"
              >
                Proxima
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {isFormOpen ? (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-ink-900/45 px-4 py-6">
          <div className="mx-auto max-w-3xl rounded-md bg-white shadow-soft">
            <form onSubmit={handleSubmit}>
              <div className="flex items-start justify-between border-b border-hope-100 px-5 py-4">
                <div>
                  <h2 className="text-lg font-bold text-ink-900">{editingId ? "Editar usuario" : "Novo usuario"}</h2>
                  <p className="text-sm text-ink-500">Acesso, vinculo com membro e perfil.</p>
                </div>
                <button type="button" onClick={() => setIsFormOpen(false)} className="rounded-md border border-hope-100 px-3 py-2 text-sm font-bold text-ink-700">
                  Fechar
                </button>
              </div>

              <div className="grid gap-4 p-5 md:grid-cols-2">
                <Field label="Nome">
                  <input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className={inputClass} />
                </Field>
                <Field label="Telefone ou CPF">
                  <input
                    required
                    value={form.username}
                    onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                    className={inputClass}
                    placeholder="Informe telefone ou CPF"
                  />
                </Field>
                <Field label="E-mail">
                  <input required type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className={inputClass} />
                </Field>
                {!editingId ? (
                  <Field label="Senha inicial">
                    <input
                      required
                      type="password"
                      value={form.password ?? ""}
                      onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                      className={inputClass}
                      placeholder="Digite sua senha"
                      minLength={6}
                    />
                  </Field>
                ) : null}
                <Field label="Papel legado">
                  <select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as UserRole }))} className={inputClass}>
                    {roleOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Perfil de acesso">
                  <select required value={form.accessRoleId} onChange={(event) => setForm((current) => ({ ...current, accessRoleId: event.target.value }))} className={inputClass}>
                    <option value="">Selecione</option>
                    {data?.filters.accessRoles.map((role) => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Membro vinculado">
                  <select value={form.memberId} onChange={(event) => setForm((current) => ({ ...current, memberId: event.target.value }))} className={inputClass}>
                    <option value="">Sem membro</option>
                    {assignableMembers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name} {member.email ? `- ${member.email}` : ""}
                      </option>
                    ))}
                  </select>
                </Field>
                <label className="flex items-center gap-2 text-sm font-bold text-ink-700">
                  <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} />
                  Usuario ativo
                </label>
                <label className="flex items-center gap-2 text-sm font-bold text-ink-700">
                  <input type="checkbox" checked={form.mustChangePassword} onChange={(event) => setForm((current) => ({ ...current, mustChangePassword: event.target.checked }))} />
                  Deve trocar senha
                </label>
              </div>

              <div className="flex justify-end gap-3 border-t border-hope-100 px-5 py-4">
                <button type="button" onClick={() => setIsFormOpen(false)} className="rounded-md border border-hope-100 px-4 py-2 text-sm font-bold text-ink-700">
                  Cancelar
                </button>
                <button type="submit" className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white">
                  Salvar usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {resetUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/45 px-4">
          <div className="w-full max-w-md rounded-md bg-white shadow-soft">
            <form onSubmit={handleResetPassword}>
              <div className="border-b border-hope-100 px-5 py-4">
                <h2 className="text-lg font-bold text-ink-900">Redefinir senha</h2>
                <p className="text-sm text-ink-500">{resetUser.email}</p>
              </div>
              <div className="p-5">
                <Field label="Nova senha">
                  <input required type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className={inputClass} placeholder="Digite sua senha" minLength={6} />
                </Field>
              </div>
              <div className="flex justify-end gap-3 border-t border-hope-100 px-5 py-4">
                <button type="button" onClick={() => setResetUser(null)} className="rounded-md border border-hope-100 px-4 py-2 text-sm font-bold text-ink-700">
                  Cancelar
                </button>
                <button type="submit" className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white">
                  Redefinir
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const filterLabelClass = "grid gap-1 text-xs font-bold uppercase tracking-wide text-ink-500";
const filterInputClass =
  "rounded-md border border-hope-100 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-ink-800";
const inputClass =
  "w-full rounded-md border border-hope-100 px-3 py-2 text-sm font-semibold text-ink-800 outline-none transition focus:border-hope-500 focus:ring-2 focus:ring-hope-100";

function FilterInput({
  label,
  value,
  onChange,
  className = ""
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={`${filterLabelClass} ${className}`}>
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} className={filterInputClass} />
    </label>
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

function ActionButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-hope-100 px-3 py-2 text-xs font-bold text-ink-700 hover:bg-hope-50"
    >
      {children}
    </button>
  );
}
