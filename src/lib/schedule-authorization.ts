import type { PermissionKey } from "@/lib/permissions";
import { requireAnyPermission, requirePermission } from "@/lib/session";
import { resolveScheduleAccessContext } from "@/services/schedule-access.service";
import type { ScheduleAccessContext } from "@/types/schedule-access.types";

export type CurrentScheduleUser = Awaited<ReturnType<typeof requirePermission>>;

type CurrentPermission = CurrentScheduleUser["permissions"][number];

export type AuthorizedScheduleUser = Readonly<
  Omit<CurrentScheduleUser, "permissions" | "permissionCodes"> & {
    readonly permissions: readonly Readonly<CurrentPermission>[];
    readonly permissionCodes: readonly string[];
  }
>;

export type ScheduleAuthorization = Readonly<{
  user: AuthorizedScheduleUser;
  accessContext: ScheduleAccessContext;
}>;

export type ScheduleAuthorizationDependencies = Readonly<{
  requirePermission(permission: PermissionKey): Promise<CurrentScheduleUser>;
  requireAnyPermission(permissions: PermissionKey[]): Promise<CurrentScheduleUser>;
  resolveScheduleAccessContext(user: CurrentScheduleUser): Promise<ScheduleAccessContext>;
}>;

const defaultDependencies: ScheduleAuthorizationDependencies = {
  requirePermission,
  requireAnyPermission,
  resolveScheduleAccessContext
};

function immutableUser(user: CurrentScheduleUser): AuthorizedScheduleUser {
  return Object.freeze({
    ...user,
    permissions: Object.freeze(
      user.permissions.map((permission) => Object.freeze({ ...permission }))
    ),
    permissionCodes: Object.freeze([...user.permissionCodes])
  });
}

function immutableAccessContext(accessContext: ScheduleAccessContext): ScheduleAccessContext {
  return Object.freeze({
    ...accessContext,
    authorizedMinistryIds:
      accessContext.authorizedMinistryIds === null
        ? null
        : Object.freeze([...accessContext.authorizedMinistryIds])
  });
}

export async function requireScheduleAccess(
  permission: PermissionKey | readonly [PermissionKey, ...PermissionKey[]],
  dependencies: ScheduleAuthorizationDependencies = defaultDependencies
): Promise<ScheduleAuthorization> {
  const user =
    typeof permission === "string"
      ? await dependencies.requirePermission(permission)
      : await dependencies.requireAnyPermission([...permission]);
  const accessContext = await dependencies.resolveScheduleAccessContext(user);

  return Object.freeze({
    user: immutableUser(user),
    accessContext: immutableAccessContext(accessContext)
  });
}
