import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { AppError } from "@/lib/errors";
import { hasPermission, type PermissionKey } from "@/lib/permissions";
import type { AuthRole } from "@/types";

export async function requireCurrentUser() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new AppError("Acesso nao autorizado.", 401, "UNAUTHORIZED");
  }

  return session.user;
}

export async function requireRole(allowedRoles: AuthRole[]) {
  const user = await requireCurrentUser();

  if (!allowedRoles.includes(user.role)) {
    throw new AppError("Voce nao tem permissao para esta acao.", 403, "FORBIDDEN");
  }

  return user;
}

export async function requirePermission(permission: PermissionKey) {
  const user = await requireCurrentUser();

  if (!hasPermission(user, permission)) {
    throw new AppError("Voce nao tem permissao para esta acao.", 403, "FORBIDDEN");
  }

  return user;
}
