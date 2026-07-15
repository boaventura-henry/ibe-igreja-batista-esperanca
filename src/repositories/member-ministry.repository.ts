import { MemberMinistryStatus, MemberStatus, Prisma } from "@prisma/client";
import { prisma } from "@/prisma/client";
import type {
  MemberMinistryCreateInput,
  MemberMinistryListQueryInput,
  MemberMinistryUpdateInput
} from "@/validators";

const memberMinistrySelect = {
  id: true,
  role: true,
  status: true,
  entryDate: true,
  exitDate: true,
  observations: true,
  createdAt: true,
  updatedAt: true,
  member: {
    select: {
      id: true,
      name: true,
      nickname: true,
      cpf: true,
      email: true,
      status: true
    }
  },
  ministry: {
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      color: true
    }
  }
} satisfies Prisma.MemberMinistrySelect;

export type MemberMinistryRecord = Prisma.MemberMinistryGetPayload<{ select: typeof memberMinistrySelect }>;

function dateOrNull(value?: string) {
  if (value === undefined) {
    return undefined;
  }

  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function createData(data: MemberMinistryCreateInput): Prisma.MemberMinistryUncheckedCreateInput {
  return {
    memberId: data.memberId,
    ministryId: data.ministryId,
    role: data.role,
    status: data.status,
    entryDate: new Date(`${data.entryDate}T00:00:00.000Z`),
    exitDate: dateOrNull(data.exitDate),
    observations: data.observations
  };
}

function updateData(data: MemberMinistryUpdateInput): Prisma.MemberMinistryUncheckedUpdateInput {
  return {
    memberId: data.memberId,
    ministryId: data.ministryId,
    role: data.role,
    status: data.status,
    entryDate: data.entryDate ? new Date(`${data.entryDate}T00:00:00.000Z`) : undefined,
    exitDate: dateOrNull(data.exitDate),
    observations: data.observations
  };
}

function buildWhere(filters: MemberMinistryListQueryInput): Prisma.MemberMinistryWhereInput {
  const and: Prisma.MemberMinistryWhereInput[] = [{ deletedAt: null }];

  if (filters.memberId) {
    and.push({ memberId: filters.memberId });
  }

  if (filters.ministryId) {
    and.push({ ministryId: filters.ministryId });
  }

  if (filters.status) {
    and.push({ status: filters.status });
  }

  if (filters.role) {
    and.push({ role: filters.role });
  }

  if (filters.activeOnly) {
    and.push({ status: MemberMinistryStatus.ACTIVE });
  }

  if (filters.search) {
    and.push({
      OR: [
        { member: { name: { contains: filters.search, mode: "insensitive" } } },
        { member: { nickname: { contains: filters.search, mode: "insensitive" } } },
        { member: { cpf: { contains: filters.search } } },
        { ministry: { name: { contains: filters.search, mode: "insensitive" } } },
        { observations: { contains: filters.search, mode: "insensitive" } }
      ]
    });
  }

  return { AND: and };
}

function buildOrderBy(filters: MemberMinistryListQueryInput): Prisma.MemberMinistryOrderByWithRelationInput {
  if (filters.sortBy === "memberName") {
    return { member: { name: filters.sortOrder } };
  }

  if (filters.sortBy === "ministryName") {
    return { ministry: { name: filters.sortOrder } };
  }

  return { [filters.sortBy]: filters.sortOrder };
}

export const memberMinistryRepository = {
  async list(filters: MemberMinistryListQueryInput) {
    const where = buildWhere(filters);
    const skip = (filters.page - 1) * filters.pageSize;
    const orderBy = buildOrderBy(filters);

    const [memberMinistries, total] = await prisma.$transaction([
      prisma.memberMinistry.findMany({
        where,
        select: memberMinistrySelect,
        orderBy,
        skip,
        take: filters.pageSize
      }),
      prisma.memberMinistry.count({ where })
    ]);

    return { memberMinistries, total };
  },

  findById(id: string) {
    return prisma.memberMinistry.findFirst({
      where: { id, deletedAt: null },
      select: memberMinistrySelect
    });
  },

  findMemberById(id: string) {
    return prisma.member.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, nickname: true, status: true }
    });
  },

  findMinistryById(id: string) {
    return prisma.ministry.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, isActive: true }
    });
  },

  findActiveLink(memberId: string, ministryId: string, ignoreId?: string) {
    return prisma.memberMinistry.findFirst({
      where: {
        memberId,
        ministryId,
        status: MemberMinistryStatus.ACTIVE,
        deletedAt: null,
        ...(ignoreId ? { id: { not: ignoreId } } : {})
      },
      select: { id: true }
    });
  },

  create(data: MemberMinistryCreateInput, userId: string) {
    return prisma.memberMinistry.create({
      data: {
        ...createData(data),
        createdById: userId,
        updatedById: userId
      },
      select: memberMinistrySelect
    });
  },

  update(id: string, data: MemberMinistryUpdateInput, userId: string) {
    return prisma.memberMinistry.update({
      where: { id },
      data: {
        ...updateData(data),
        updatedById: userId
      },
      select: memberMinistrySelect
    });
  },

  softDelete(id: string, userId: string) {
    return prisma.memberMinistry.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedById: userId
      },
      select: { id: true, deletedAt: true }
    });
  },

  listMembers() {
    return prisma.member.findMany({
      where: {
        deletedAt: null,
        status: { notIn: [MemberStatus.INACTIVE, MemberStatus.DECEASED] }
      },
      select: {
        id: true,
        name: true,
        nickname: true,
        cpf: true,
        email: true,
        status: true
      },
      orderBy: { name: "asc" }
    });
  },

  listMinistries() {
    return prisma.ministry.findMany({
      where: {
        deletedAt: null,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        color: true
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }]
    });
  }
};
