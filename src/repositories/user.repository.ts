import type { Prisma } from "@prisma/client";
import { prisma } from "@/prisma/client";

const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  memberId: true,
  accessRoleId: true,
  isActive: true,
  mustChangePassword: true,
  lockedUntil: true,
  accessRole: {
    select: {
      id: true,
      name: true,
      permissions: {
        select: {
          code: true,
          name: true,
          label: true,
          module: true
        },
        where: {
          isActive: true
        }
      }
    }
  },
  createdAt: true,
  updatedAt: true
} satisfies Prisma.UserSelect;

export type SafeUser = Prisma.UserGetPayload<{
  select: typeof safeUserSelect;
}>;

export type UserWithPassword = SafeUser & {
  passwordHash: string;
};

export const userRepository = {
  findByEmailWithPassword(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: {
        ...safeUserSelect,
        passwordHash: true
      }
    });
  },

  findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: safeUserSelect
    });
  },

  registerFailedLogin(id: string) {
    return prisma.user.update({
      where: { id },
      data: {
        failedLoginAttempts: { increment: 1 }
      },
      select: { id: true }
    });
  },

  registerSuccessfulLogin(id: string) {
    return prisma.user.update({
      where: { id },
      data: {
        lastLoginAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null
      },
      select: { id: true }
    });
  },

  upsertAdmin(data: { name: string; email: string; passwordHash: string; accessRoleId?: string | null }) {
    return prisma.user.upsert({
      where: { email: data.email },
      update: {
        name: data.name,
        passwordHash: data.passwordHash,
        role: "ADMIN",
        accessRoleId: data.accessRoleId,
        isActive: true
      },
      create: {
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
        role: "ADMIN",
        accessRoleId: data.accessRoleId,
        isActive: true
      },
      select: safeUserSelect
    });
  }
};
