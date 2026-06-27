import type { AuthSessionUser } from "@/types";

export const availablePermissions = [
  { code: "member.view", name: "Visualizar membros", label: "Visualizar membros", module: "Membros" },
  { code: "member.create", name: "Criar membros", label: "Criar membros", module: "Membros" },
  { code: "member.update", name: "Alterar membros", label: "Alterar membros", module: "Membros" },
  { code: "member.delete", name: "Excluir membros", label: "Excluir membros", module: "Membros" },
  { code: "member.photo.upload", name: "Enviar foto de membro", label: "Enviar foto de membro", module: "Membros" },
  { code: "member.export", name: "Exportar membros", label: "Exportar membros", module: "Membros" },
  { code: "accessRole.view", name: "Visualizar perfis", label: "Visualizar perfis", module: "Perfis de Acesso" },
  { code: "accessRole.create", name: "Criar perfis", label: "Criar perfis", module: "Perfis de Acesso" },
  { code: "accessRole.update", name: "Alterar perfis", label: "Alterar perfis", module: "Perfis de Acesso" },
  { code: "accessRole.delete", name: "Excluir perfis", label: "Excluir perfis", module: "Perfis de Acesso" },
  { code: "user.view", name: "Visualizar usuarios", label: "Visualizar usuarios", module: "Usuarios" },
  { code: "user.create", name: "Criar usuarios", label: "Criar usuarios", module: "Usuarios" },
  { code: "user.update", name: "Alterar usuarios", label: "Alterar usuarios", module: "Usuarios" },
  { code: "user.delete", name: "Excluir usuarios", label: "Excluir usuarios", module: "Usuarios" },
  { code: "user.resetPassword", name: "Redefinir senha", label: "Redefinir senha", module: "Usuarios" },
  { code: "user.lock", name: "Bloquear usuario", label: "Bloquear usuario", module: "Usuarios" },
  { code: "user.unlock", name: "Desbloquear usuario", label: "Desbloquear usuario", module: "Usuarios" },
  {
    code: "system.settings.view",
    name: "Visualizar configuracoes",
    label: "Visualizar configuracoes",
    module: "Sistema"
  },
  {
    code: "system.settings.update",
    name: "Alterar configuracoes",
    label: "Alterar configuracoes",
    module: "Sistema"
  }
] as const;

export type PermissionCode = (typeof availablePermissions)[number]["code"];
export type PermissionKey = PermissionCode;

export const permissionCodes = availablePermissions.map((permission) => permission.code) as [
  PermissionCode,
  ...PermissionCode[]
];
export const permissionKeys = permissionCodes;

export type AuthPermission = {
  code: string;
  name: string;
  label: string;
  module: string;
};

export function isPermissionCode(value: string): value is PermissionCode {
  return permissionCodes.includes(value as PermissionCode);
}

export const isPermissionKey = isPermissionCode;

export function getPermissionCodes(permissions: Array<string | AuthPermission> | null | undefined) {
  return (permissions ?? []).map((permission) =>
    typeof permission === "string" ? permission : permission.code
  );
}

export function hasPermission(
  subject:
    | AuthSessionUser
    | {
        role?: string | null;
        permissions?: Array<string | AuthPermission> | null;
        permissionCodes?: string[] | null;
      }
    | null
    | undefined,
  permission: PermissionCode
) {
  if (!subject) {
    return false;
  }

  if ("permissions" in subject) {
    if (subject.permissionCodes) {
      return subject.permissionCodes.includes(permission);
    }

    return getPermissionCodes(subject.permissions).includes(permission);
  }

  return false;
}
