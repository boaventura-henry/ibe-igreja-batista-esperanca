import type { UserRole } from "@prisma/client";
import type { AuthPermission } from "@/lib/permissions";

export type AuthRole = UserRole;

export type AuthSessionUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: AuthRole;
  memberId?: string | null;
  accessRoleId?: string | null;
  mustChangePassword: boolean;
  permissions: AuthPermission[];
  permissionCodes: string[];
};
