import type { Prisma } from "@prisma/client";
import { prisma } from "@/prisma/client";
import type { UserCreateInput, UserListQueryInput, UserUpdateInput } from "@/validators";

const userSelect = {
  id: true,
  name: true,
  username: true,
  email: true,
  role: true,
  memberId: true,
  accessRoleId: true,
  isActive: true,
  mustChangePassword: true,
  lastLoginAt: true,
  failedLoginAttempts: true,
  lockedUntil: true,
  member: {
    select: {
      id: true,
      name: true,
      email: true,
      cpf: true
    }
  },
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
        },
        orderBy: [{ module: "asc" }, { code: "asc" }]
      }
    }
  },
  createdAt: true,
  updatedAt: true
} satisfies Prisma.UserSelect;

export type SafeUser = Prisma.UserGetPayload<{
  select: typeof userSelect;
}>;

export type UserWithPassword = SafeUser & {
  passwordHash: string;
};

function buildWhere(filters: UserListQueryInput): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [];

  if (filters.search) {
    and.push({
      OR: [
        { name: { contains: filters.search, mode: "insensitive" } },
        { username: { contains: filters.search, mode: "insensitive" } },
        { email: { contains: filters.search, mode: "insensitive" } },
        { member: { name: { contains: filters.search, mode: "insensitive" } } }
      ]
    });
  }

  if (filters.status === "ACTIVE") {
    and.push({ isActive: true, OR: [{ lockedUntil: null }, { lockedUntil: { lte: new Date() } }] });
  }

  if (filters.status === "INACTIVE") {
    and.push({ isActive: false });
  }

  if (filters.status === "LOCKED") {
    and.push({ lockedUntil: { gt: new Date() } });
  }

  if (filters.status === "MUST_CHANGE_PASSWORD") {
    and.push({ mustChangePassword: true });
  }

  if (filters.accessRoleId) {
    and.push({ accessRoleId: filters.accessRoleId });
  }

  return and.length > 0 ? { AND: and } : {};
}

export const userRepository = {
  async list(filters: UserListQueryInput) {
    const where = buildWhere(filters);
    const skip = (filters.page - 1) * filters.pageSize;
    const orderBy = {
      [filters.sortBy]: filters.sortOrder
    } satisfies Prisma.UserOrderByWithRelationInput;

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: userSelect,
        orderBy,
        skip,
        take: filters.pageSize
      }),
      prisma.user.count({ where })
    ]);

    return { users, total };
  },

  findByUsernameWithPassword(username: string) {
    return prisma.user.findUnique({
      where: { username },
      select: {
        ...userSelect,
        passwordHash: true
      }
    });
  },

  findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: userSelect
    });
  },

  findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: { id: true }
    });
  },

  findByUsername(username: string) {
    return prisma.user.findUnique({
      where: { username },
      select: { id: true }
    });
  },

  findByMemberId(memberId: string) {
    return prisma.user.findUnique({
      where: { memberId },
      select: { id: true }
    });
  },

  countActiveAdmins(excludeUserId?: string) {
    return prisma.user.count({
      where: {
        role: "ADMIN",
        isActive: true,
        id: excludeUserId ? { not: excludeUserId } : undefined
      }
    });
  },

  create(data: UserCreateInput & { passwordHash: string }) {
    return prisma.user.create({
      data: {
        name: data.name,
        username: data.username,
        email: data.email,
        passwordHash: data.passwordHash,
        role: data.role,
        memberId: data.memberId,
        accessRoleId: data.accessRoleId,
        isActive: data.isActive,
        mustChangePassword: data.mustChangePassword
      },
      select: userSelect
    });
  },

  update(id: string, data: UserUpdateInput) {
    return prisma.user.update({
      where: { id },
      data: {
        name: data.name,
        username: data.username,
        email: data.email,
        role: data.role,
        memberId: data.memberId,
        accessRoleId: data.accessRoleId,
        isActive: data.isActive,
        mustChangePassword: data.mustChangePassword
      },
      select: userSelect
    });
  },

  updatePassword(id: string, passwordHash: string) {
    return prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        mustChangePassword: true,
        failedLoginAttempts: 0,
        lockedUntil: null
      },
      select: userSelect
    });
  },

  activate(id: string) {
    return prisma.user.update({
      where: { id },
      data: { isActive: true },
      select: userSelect
    });
  },

  deactivate(id: string) {
    return prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: userSelect
    });
  },

  lock(id: string, lockedUntil: Date) {
    return prisma.user.update({
      where: { id },
      data: { lockedUntil },
      select: userSelect
    });
  },

  unlock(id: string) {
    return prisma.user.update({
      where: { id },
      data: {
        lockedUntil: null,
        failedLoginAttempts: 0
      },
      select: userSelect
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

  listAccessRoles() {
    return prisma.accessRole.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    });
  },

  listAssignableMembers(currentUserId?: string) {
    return prisma.member.findMany({
      where: {
        deletedAt: null,
        OR: currentUserId ? [{ user: null }, { user: { id: currentUserId } }] : [{ user: null }]
      },
      select: {
        id: true,
        name: true,
        email: true,
        cpf: true
      },
      orderBy: { name: "asc" }
    });
  },

  async upsertAdmin(data: { username: string; name: string; email: string; passwordHash: string; accessRoleId?: string | null }) {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ username: data.username }, { email: data.email }]
      },
      select: { id: true }
    });

    if (existing) {
      return prisma.user.update({
        where: { id: existing.id },
        data: {
          username: data.username,
          name: data.name,
          email: data.email,
          passwordHash: data.passwordHash,
          role: "ADMIN",
          accessRoleId: data.accessRoleId,
          isActive: true
        },
        select: userSelect
      });
    }

    return prisma.user.create({
      data: {
        username: data.username,
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
        role: "ADMIN",
        accessRoleId: data.accessRoleId,
        isActive: true
      },
      select: userSelect
    });
  }
};
