import type { PermissionKey } from "@/lib/permissions";
import { requireAnyPermission } from "@/lib/session";
import { ministryFinanceRepository } from "@/repositories/ministry-finance.repository";
import type { FinancialAccessContext, FinancialAuthorization } from "@/types/ministry-finance.types";

const operationPermissions = {
  view: ["financialEntry.view", "ministryFinance.view"],
  create: ["financialEntry.create", "ministryFinance.create"],
  update: ["financialEntry.update", "ministryFinance.update"],
  delete: ["financialEntry.delete", "ministryFinance.delete"],
  cancel: ["financialEntry.cancel", "ministryFinance.cancel"],
  report: ["financialEntry.view", "ministryFinance.report"]
} as const satisfies Record<string, readonly [PermissionKey, PermissionKey]>;

export type FinancialOperation = keyof typeof operationPermissions;

export async function resolveFinancialAccessContext(
  user: { id: string; permissionCodes: readonly string[] },
  operation: FinancialOperation
): Promise<FinancialAccessContext> {
  const [globalPermission, scopedPermission] = operationPermissions[operation];
  if (user.permissionCodes.includes(globalPermission)) {
    return Object.freeze({ allMinistries: true, authorizedMinistryIds: Object.freeze([]) });
  }
  if (!user.permissionCodes.includes(scopedPermission)) {
    return Object.freeze({ allMinistries: false, authorizedMinistryIds: Object.freeze([]) });
  }
  const accesses = await ministryFinanceRepository.listAuthorizedMinistryIds(user.id);
  return Object.freeze({
    allMinistries: false,
    authorizedMinistryIds: Object.freeze(accesses.map((item) => item.ministryId))
  });
}

export async function requireFinancialAccess(operation: FinancialOperation): Promise<FinancialAuthorization> {
  const user = await requireAnyPermission([...operationPermissions[operation]]);
  return Object.freeze({ userId: user.id, accessContext: await resolveFinancialAccessContext(user, operation) });
}
