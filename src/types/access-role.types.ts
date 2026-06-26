import type { PermissionCode } from "@/lib/permissions";

export type AccessRoleFormValues = {
  name: string;
  description?: string;
  permissions: PermissionCode[];
  isActive: boolean;
  confirmSystemChange?: boolean;
};

export type AccessRoleSummary = {
  id: string;
  name: string;
  description: string | null;
  permissions: Array<{ id: string; code: string; name: string; label: string; module: string }>;
  isSystem: boolean;
  isActive: boolean;
  usersCount: number;
  membersCount: number;
  updatedAt: string;
};

export type AccessRoleListResult = {
  accessRoles: AccessRoleSummary[];
  availablePermissions: Array<{
    id: string;
    code: string;
    name: string;
    label: string;
    module: string;
  }>;
};
