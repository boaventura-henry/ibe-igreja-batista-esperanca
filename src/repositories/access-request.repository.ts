import type { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/prisma/client";
import type { AccessRequestListQueryInput } from "@/validators";

const memberSummarySelect = {
  id: true,
  name: true,
  email: true,
  cpf: true,
  birthDate: true
} satisfies Prisma.MemberSelect;

const accessRequestSelect = {
  id: true,
  name: true,
  username: true,
  email: true,
  phone: true,
  cpf: true,
  birthDate: true,
  status: true,
  possibleMember: {
    select: memberSummarySelect
  },
  approvedMember: {
    select: memberSummarySelect
  },
  approvedBy: {
    select: {
      id: true,
      name: true
    }
  },
  approvedAt: true,
  rejectedBy: {
    select: {
      id: true,
      name: true
    }
  },
  rejectedAt: true,
  rejectionReason: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.UserAccessRequestSelect;

const privateAccessRequestSelect = {
  ...accessRequestSelect,
  possibleMemberId: true,
  passwordHash: true
} satisfies Prisma.UserAccessRequestSelect;

export type SafeAccessRequest = Prisma.UserAccessRequestGetPayload<{
  select: typeof accessRequestSelect;
}>;

export type PrivateAccessRequest = Prisma.UserAccessRequestGetPayload<{
  select: typeof privateAccessRequestSelect;
}>;

function buildWhere(filters: AccessRequestListQueryInput): Prisma.UserAccessRequestWhereInput {
  const and: Prisma.UserAccessRequestWhereInput[] = [{ deletedAt: null }];

  if (filters.search) {
    and.push({
      OR: [
        { name: { contains: filters.search, mode: "insensitive" } },
        { username: { contains: filters.search, mode: "insensitive" } },
        { email: { contains: filters.search, mode: "insensitive" } },
        { phone: { contains: filters.search } },
        { cpf: { contains: filters.search } }
      ]
    });
  }

  if (filters.status) {
    and.push({ status: filters.status });
  }

  return { AND: and };
}

export const accessRequestRepository = {
  async list(filters: AccessRequestListQueryInput) {
    const where = buildWhere(filters);
    const skip = (filters.page - 1) * filters.pageSize;
    const orderBy = {
      [filters.sortBy]: filters.sortOrder
    } satisfies Prisma.UserAccessRequestOrderByWithRelationInput;

    const [requests, total] = await prisma.$transaction([
      prisma.userAccessRequest.findMany({
        where,
        select: accessRequestSelect,
        orderBy,
        skip,
        take: filters.pageSize
      }),
      prisma.userAccessRequest.count({ where })
    ]);

    return { requests, total };
  },

  findById(id: string) {
    return prisma.userAccessRequest.findFirst({
      where: { id, deletedAt: null },
      select: accessRequestSelect
    });
  },

  findPrivateById(id: string) {
    return prisma.userAccessRequest.findFirst({
      where: { id, deletedAt: null },
      select: privateAccessRequestSelect
    });
  },

  findPendingByUsername(username: string) {
    return prisma.userAccessRequest.findFirst({
      where: {
        username,
        status: "PENDING",
        deletedAt: null
      },
      select: { id: true }
    });
  },

  findUserByUsername(username: string) {
    return prisma.user.findUnique({
      where: { username },
      select: { id: true }
    });
  },

  findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: { id: true }
    });
  },

  findMemberById(id: string) {
    return prisma.member.findFirst({
      where: { id, deletedAt: null },
      select: memberSummarySelect
    });
  },

  findMemberWithActiveUser(memberId: string) {
    return prisma.user.findFirst({
      where: {
        memberId,
        isActive: true
      },
      select: { id: true }
    });
  },

  findAccessRoleByName(name: string) {
    return prisma.accessRole.findFirst({
      where: {
        name,
        isActive: true,
        deletedAt: null
      },
      select: { id: true, name: true }
    });
  },

  async suggestMember(data: {
    email: string;
    phone?: string;
    cpf?: string;
    name: string;
    birthDate?: Date;
  }) {
    const or: Prisma.MemberWhereInput[] = [{ email: data.email }];

    if (data.cpf) {
      or.push({ cpf: data.cpf });
    }

    if (data.phone) {
      or.push({ OR: [{ phone: data.phone }, { mobilePhone: data.phone }, { whatsapp: data.phone }] });
    }

    if (data.birthDate) {
      or.push({
        name: { equals: data.name, mode: "insensitive" },
        birthDate: data.birthDate
      });
    }

    return prisma.member.findFirst({
      where: {
        deletedAt: null,
        OR: or
      },
      select: memberSummarySelect,
      orderBy: { updatedAt: "desc" }
    });
  },

  create(data: {
    name: string;
    username: string;
    email: string;
    phone?: string;
    cpf?: string;
    birthDate?: Date;
    passwordHash: string;
    possibleMemberId?: string | null;
  }) {
    return prisma.userAccessRequest.create({
      data: {
        name: data.name,
        username: data.username,
        email: data.email,
        phone: data.phone,
        cpf: data.cpf,
        birthDate: data.birthDate,
        passwordHash: data.passwordHash,
        possibleMemberId: data.possibleMemberId
      },
      select: accessRequestSelect
    });
  },

  listAssignableMembers() {
    return prisma.member.findMany({
      where: {
        deletedAt: null,
        user: null
      },
      select: memberSummarySelect,
      orderBy: { name: "asc" }
    });
  },

  approve(data: {
    requestId: string;
    actionUserId: string;
    memberId: string;
    accessRoleId: string;
    user: {
      name: string;
      username: string;
      email: string;
      passwordHash: string;
      role: UserRole;
      mustChangePassword: boolean;
    };
  }) {
    return prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          ...data.user,
          memberId: data.memberId,
          accessRoleId: data.accessRoleId,
          isActive: true
        },
        select: { id: true }
      });

      return tx.userAccessRequest.update({
        where: { id: data.requestId },
        data: {
          status: "APPROVED",
          approvedMemberId: data.memberId,
          approvedById: data.actionUserId,
          approvedAt: new Date(),
          rejectedById: null,
          rejectedAt: null,
          rejectionReason: null
        },
        select: accessRequestSelect
      });
    });
  },

  reject(id: string, actionUserId: string, reason: string) {
    return prisma.userAccessRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectedById: actionUserId,
        rejectedAt: new Date(),
        rejectionReason: reason
      },
      select: accessRequestSelect
    });
  }
};
