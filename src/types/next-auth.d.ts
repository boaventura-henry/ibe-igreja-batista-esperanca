import type { DefaultSession } from "next-auth";
import type { AuthRole } from "@/types/auth";
import type { AuthPermission } from "@/lib/permissions";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AuthRole;
      memberId?: string | null;
      accessRoleId?: string | null;
      mustChangePassword: boolean;
      permissions: AuthPermission[];
      permissionCodes: string[];
    } & DefaultSession["user"];
  }

  interface User {
    role: AuthRole;
    memberId?: string | null;
    accessRoleId?: string | null;
    mustChangePassword: boolean;
    permissions: AuthPermission[];
    permissionCodes: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: AuthRole;
    memberId?: string | null;
    accessRoleId?: string | null;
    mustChangePassword: boolean;
    permissions: AuthPermission[];
    permissionCodes: string[];
  }
}
