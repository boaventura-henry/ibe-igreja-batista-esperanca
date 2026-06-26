"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { AccessRoleFormValues, AccessRoleListResult, AccessRoleSummary } from "@/types";

type ApiResponse<T> =
  | ({ success: true; data: T } & T)
  | { success: false; error: { code: string; message: string } };

const emptyForm: AccessRoleFormValues = {
  name: "",
  description: "",
  permissions: [],
  isActive: true,
  confirmSystemChange: false
};

export function AccessRoleManager() {
  const [data, setData] = useState<AccessRoleListResult | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<AccessRoleSummary | null>(null);
  const [form, setForm] = useState<AccessRoleFormValues>(emptyForm);

  const permissionGroups = useMemo(() => {
    const groups = new Map<string, AccessRoleListResult["availablePermissions"]>();

    data?.availablePermissions.forEach((permission) => {
      groups.set(permission.module, [...(groups.get(permission.module) ?? []), permission]);
    });

    return Array.from(groups.entries());
  }, [data]);

  const loadAccessRoles = useCallback(async () => {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/access-roles", { cache: "no-store" });
      const payload = (await response.json()) as ApiResponse<AccessRoleListResult>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setData(payload.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel carregar os perfis.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccessRoles();
  }, [loadAccessRoles]);

  function openCreateForm() {
    setEditingRole(null);
    setForm(emptyForm);
    setIsFormOpen(true);
    setMessage("");
  }

  function openEditForm(role: AccessRoleSummary) {
    setEditingRole(role);
    setForm({
      name: role.name,
      description: role.description ?? "",
      permissions: role.permissions.map((permission) => permission.code) as AccessRoleFormValues["permissions"],
      isActive: role.isActive,
      confirmSystemChange: false
    });
    setIsFormOpen(true);
    setMessage("");
  }

  function togglePermission(permission: AccessRoleFormValues["permissions"][number]) {
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((item) => item !== permission)
        : [...current.permissions, permission]
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    try {
      const response = await fetch(
        editingRole ? `/api/access-roles/${editingRole.id}` : "/api/access-roles",
        {
          method: editingRole ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form)
        }
      );
      const payload = (await response.json()) as ApiResponse<AccessRoleSummary>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setIsFormOpen(false);
      setMessage(editingRole ? "Perfil atualizado com sucesso." : "Perfil criado com sucesso.");
      await loadAccessRoles();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel salvar o perfil.");
    }
  }

  async function handleDelete(role: AccessRoleSummary) {
    const confirmed = window.confirm("Deseja excluir este perfil de acesso?");

    if (!confirmed) {
      return;
    }

    try {
      const systemQuery = role.isSystem ? "?confirmSystemChange=true" : "";
      const response = await fetch(`/api/access-roles/${role.id}${systemQuery}`, { method: "DELETE" });
      const payload = (await response.json()) as ApiResponse<{ id: string }>;

      if (!payload.success) {
        throw new Error(payload.error.message);
      }

      setMessage("Perfil excluido com sucesso.");
      await loadAccessRoles();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel excluir o perfil.");
    }
  }

  return (
    <div className="space-y-5">
      {message ? (
        <div className="rounded-md border border-hope-100 bg-hope-50 px-4 py-3 text-sm font-semibold text-ink-800">
          {message}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-md border border-hope-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-hope-100 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-ink-900">Perfis cadastrados</p>
            <p className="text-xs text-ink-500">{data?.accessRoles.length ?? 0} perfil(is)</p>
          </div>
          <button
            type="button"
            onClick={openCreateForm}
            className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white"
          >
            Novo perfil
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-hope-100 text-sm">
            <thead className="bg-hope-50 text-left text-xs font-bold uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Descricao</th>
                <th className="px-4 py-3">Permissoes</th>
                <th className="px-4 py-3">Membros</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hope-100">
              {isLoading ? (
                <tr>
                  <td className="px-4 py-8 text-center font-semibold text-ink-500" colSpan={6}>
                    Carregando perfis...
                  </td>
                </tr>
              ) : null}
              {data?.accessRoles.map((role) => (
                <tr key={role.id} className="align-top">
                  <td className="px-4 py-4 font-semibold text-ink-900">
                    {role.name}
                    {role.isSystem ? <span className="ml-2 text-xs text-hope-700">Sistema</span> : null}
                  </td>
                  <td className="px-4 py-4 text-ink-700">{role.description || "-"}</td>
                  <td className="px-4 py-4 text-ink-700">{role.permissions.length}</td>
                  <td className="px-4 py-4 text-ink-700">{role.membersCount}</td>
                  <td className="px-4 py-4">
                    <span className="rounded-md bg-hope-50 px-2 py-1 text-xs font-bold text-hope-700">
                      {role.isActive ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEditForm(role)}
                        className="rounded-md border border-hope-100 px-3 py-2 text-xs font-bold text-ink-700 hover:bg-hope-50"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(role)}
                        className="rounded-md border border-red-100 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isFormOpen ? (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-ink-900/45 px-4 py-6">
          <div className="mx-auto max-w-3xl rounded-md bg-white shadow-soft">
            <form onSubmit={handleSubmit}>
              <div className="flex items-start justify-between border-b border-hope-100 px-5 py-4">
                <div>
                  <h2 className="text-lg font-bold text-ink-900">
                    {editingRole ? "Editar perfil" : "Novo perfil"}
                  </h2>
                  <p className="text-sm text-ink-500">Permissoes de acesso por funcao.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="rounded-md border border-hope-100 px-3 py-2 text-sm font-bold text-ink-700"
                >
                  Fechar
                </button>
              </div>

              <div className="grid gap-4 p-5">
                <label className={labelClass}>
                  Nome
                  <input
                    required
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  Descricao
                  <textarea
                    value={form.description}
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                    className={`${inputClass} min-h-24`}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm font-bold text-ink-700">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                  />
                  Perfil ativo
                </label>

                {editingRole?.isSystem ? (
                  <label className="flex items-center gap-2 text-sm font-bold text-ink-700">
                    <input
                      type="checkbox"
                      checked={form.confirmSystemChange}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, confirmSystemChange: event.target.checked }))
                      }
                    />
                    Confirmar alteracao de perfil do sistema
                  </label>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  {permissionGroups.map(([group, permissions]) => (
                    <fieldset key={group} className="rounded-md border border-hope-100 p-3">
                      <legend className="px-1 text-xs font-bold uppercase tracking-wide text-ink-500">
                        {group}
                      </legend>
                      <div className="mt-2 grid gap-2">
                        {permissions.map((permission) => {
                          const permissionCode = permission.code as AccessRoleFormValues["permissions"][number];

                          return (
                            <label key={permission.code} className="flex items-start gap-2 text-sm text-ink-700">
                              <input
                                type="checkbox"
                                checked={form.permissions.includes(permissionCode)}
                                onChange={() => togglePermission(permissionCode)}
                                className="mt-1"
                              />
                              <span>
                                <span className="block font-semibold text-ink-800">{permission.label || permission.name}</span>
                                <span className="block text-xs text-ink-500">{permission.code}</span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-hope-100 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="rounded-md border border-hope-100 px-4 py-2 text-sm font-bold text-ink-700"
                >
                  Cancelar
                </button>
                <button type="submit" className="rounded-md bg-hope-600 px-4 py-2 text-sm font-bold text-white">
                  Salvar perfil
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const labelClass = "grid gap-1 text-xs font-bold uppercase tracking-wide text-ink-500";
const inputClass =
  "w-full rounded-md border border-hope-100 px-3 py-2 text-sm font-semibold text-ink-800 outline-none transition focus:border-hope-500 focus:ring-2 focus:ring-hope-100";
