import type { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/prisma/client";
import type { AccessRequestListQueryInput } from "@/validators";

const memberSummarySelect = {
  id: true,
  name: true,
  email: true,
  cpf: true,
  rg: true,
  phone: true,
  mobilePhone: true,
  whatsapp: true,
  birthDate: true,
  status: true
} satisfies Prisma.MemberSelect;

const accessRequestSelect = {
  id: true,
  name: true,
  username: true,
  email: true,
  phone: true,
  cpf: true,
  rg: true,
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
  approvedMemberId: true,
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
        { cpf: { contains: filters.search } },
        { rg: { contains: filters.search, mode: "insensitive" } }
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

  findPendingDuplicate(data: { username: string; phone?: string; cpf?: string; rg?: string; email?: string | null }) {
    return prisma.userAccessRequest.findFirst({
      where: {
        status: "PENDING",
        deletedAt: null,
        OR: [
          { username: data.username },
          ...(data.phone ? [{ phone: data.phone }] : []),
          ...(data.cpf ? [{ cpf: data.cpf }] : []),
          ...(data.rg ? [{ rg: data.rg }] : []),
          ...(data.email ? [{ email: data.email }] : [])
        ]
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

  findUserByIdentifier(identifier: string) {
    return prisma.user.findFirst({
      where: {
        OR: [
          { username: identifier },
          { member: { phone: identifier } },
          { member: { mobilePhone: identifier } },
          { member: { whatsapp: identifier } },
          { member: { cpf: identifier } }
        ]
      },
      select: { id: true, memberId: true, isActive: true }
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

  findMemberCandidates(data: {
    name: string;
    email?: string | null;
    phone: string;
    cpf?: string;
    rg?: string;
    birthDate: Date;
  }) {
    return prisma.member.findMany({
      where: {
        deletedAt: null,
        OR: [
          ...(data.cpf ? [{ cpf: data.cpf }] : []),
          ...(data.rg ? [{ rg: data.rg }] : []),
          { phone: data.phone },
          { mobilePhone: data.phone },
          { whatsapp: data.phone },
          ...(data.email ? [{ email: data.email }] : []),
          { birthDate: data.birthDate },
          { name: { contains: data.name.split(" ")[0] ?? data.name, mode: "insensitive" } }
        ]
      },
      select: {
        ...memberSummarySelect,
        user: {
          select: {
            id: true,
            isActive: true
          }
        }
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }]
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
    email?: string | null;
    phone?: string;
    cpf?: string;
    rg?: string;
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
        rg: data.rg,
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

  autoApproveWithExistingMember(data: {
    request: {
      name: string;
      username: string;
      email: string;
      phone: string;
      cpf?: string | null;
      rg?: string | null;
      birthDate: Date;
      passwordHash: string;
      possibleMemberId: string;
    };
    accessRoleId: string;
  }) {
    return prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          name: data.request.name,
          username: data.request.username,
          email: data.request.email,
          passwordHash: data.request.passwordHash,
          role: "LEADER",
          memberId: data.request.possibleMemberId,
          accessRoleId: data.accessRoleId,
          isActive: true,
          mustChangePassword: false
        },
        select: { id: true }
      });

      return tx.userAccessRequest.create({
        data: {
          name: data.request.name,
          username: data.request.username,
          email: data.request.email,
          phone: data.request.phone,
          cpf: data.request.cpf,
          rg: data.request.rg,
          birthDate: data.request.birthDate,
          passwordHash: data.request.passwordHash,
          status: "APPROVED",
          possibleMemberId: data.request.possibleMemberId,
          approvedMemberId: data.request.possibleMemberId,
          approvedAt: new Date()
        },
        select: accessRequestSelect
      });
    });
  },

  autoApproveWithNewMember(data: {
    request: {
      name: string;
      username: string;
      email: string;
      phone: string;
      cpf?: string | null;
      rg?: string | null;
      birthDate: Date;
      passwordHash: string;
    };
    accessRoleId: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const member = await tx.member.create({
        data: {
          name: data.request.name,
          cpf: data.request.cpf,
          rg: data.request.rg,
          birthDate: data.request.birthDate,
          mobilePhone: data.request.phone,
          whatsapp: data.request.phone,
          email: data.request.email.endsWith("@ibe.local") ? null : data.request.email,
          status: "ACTIVE",
          notes: "Cadastro criado automaticamente por solicitacao de acesso."
        },
        select: { id: true }
      });

      await tx.user.create({
        data: {
          name: data.request.name,
          username: data.request.username,
          email: data.request.email,
          passwordHash: data.request.passwordHash,
          role: "LEADER",
          memberId: member.id,
          accessRoleId: data.accessRoleId,
          isActive: true,
          mustChangePassword: false
        },
        select: { id: true }
      });

      return tx.userAccessRequest.create({
        data: {
          name: data.request.name,
          username: data.request.username,
          email: data.request.email,
          phone: data.request.phone,
          cpf: data.request.cpf,
          rg: data.request.rg,
          birthDate: data.request.birthDate,
          passwordHash: data.request.passwordHash,
          status: "APPROVED",
          approvedMemberId: member.id,
          approvedAt: new Date()
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
