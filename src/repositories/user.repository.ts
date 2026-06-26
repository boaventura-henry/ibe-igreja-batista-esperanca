import type { Prisma } from "@prisma/client";
import { prisma } from "@/prisma/client";

const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
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

  upsertAdmin(data: { name: string; email: string; passwordHash: string }) {
    return prisma.user.upsert({
      where: { email: data.email },
      update: {
        name: data.name,
        passwordHash: data.passwordHash,
        role: "ADMIN"
      },
      create: {
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
        role: "ADMIN"
      },
      select: safeUserSelect
    });
  }
};
