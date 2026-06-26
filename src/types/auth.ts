import type { UserRole } from "@prisma/client";

export type AuthRole = UserRole;

export type AuthSessionUser = {
  id: string;
  name: string;
  email: string;
  role: AuthRole;
};
