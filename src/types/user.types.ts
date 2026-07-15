import type { UserRole } from "@prisma/client";

export type UserStatusFilter = "ACTIVE" | "INACTIVE" | "LOCKED" | "MUST_CHANGE_PASSWORD";

export type UserSummary = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: UserRole;
  member: { id: string; name: string; nickname: string | null; displayName: string; email: string | null; cpf: string | null } | null;
  accessRole: { id: string; name: string } | null;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserListResult = {
  users: UserSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  filters: {
    accessRoles: Array<{ id: string; name: string }>;
    members: Array<{ id: string; name: string; nickname: string | null; displayName: string; email: string | null; cpf: string | null }>;
  };
};

export type UserFormValues = {
  name: string;
  username: string;
  email: string;
  password?: string;
  role: UserRole;
  memberId?: string;
  accessRoleId: string;
  isActive: boolean;
  mustChangePassword: boolean;
};
