import type { Prisma } from "@prisma/client";
import { prisma } from "@/prisma/client";
import type { MinistryCreateInput, MinistryListQueryInput, MinistryUpdateInput } from "@/validators";

const ministrySelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  color: true,
  icon: true,
  imageUrl: true,
  displayOrder: true,
  email: true,
  phone: true,
  meetingDay: true,
  meetingTime: true,
  location: true,
  notes: true,
  isActive: true,
  isSystem: true,
  leaderMember: {
    select: {
      id: true,
      name: true,
      nickname: true,
      email: true,
      cpf: true
    }
  },
  viceLeaderMember: {
    select: {
      id: true,
      name: true,
      nickname: true,
      email: true,
      cpf: true
    }
  },
  createdAt: true,
  updatedAt: true,
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true
    }
  },
  updatedBy: {
    select: {
      id: true,
      name: true,
      email: true
    }
  },
  _count: {
    select: {
      memberMinistries: {
        where: {
          status: "ACTIVE",
          deletedAt: null
        }
      },
      events: true
    }
  }
} satisfies Prisma.MinistrySelect;

export type MinistryRecord = Prisma.MinistryGetPayload<{ select: typeof ministrySelect }>;

function buildWhere(filters: MinistryListQueryInput): Prisma.MinistryWhereInput {
  const and: Prisma.MinistryWhereInput[] = [{ deletedAt: null }];

  if (filters.search) {
    and.push({
      OR: [
        { name: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
        { location: { contains: filters.search, mode: "insensitive" } },
        { leaderMember: { name: { contains: filters.search, mode: "insensitive" } } },
        { leaderMember: { nickname: { contains: filters.search, mode: "insensitive" } } }
      ]
    });
  }

  if (filters.status === "ACTIVE") {
    and.push({ isActive: true });
  }

  if (filters.status === "INACTIVE") {
    and.push({ isActive: false });
  }

  if (filters.leaderMemberId) {
    and.push({
      OR: [
        { leaderMemberId: filters.leaderMemberId },
        { viceLeaderMemberId: filters.leaderMemberId }
      ]
    });
  }

  return { AND: and };
}

function createMinistryData(data: MinistryCreateInput & { displayOrder: number }) {
  return {
    name: data.name,
    description: data.description,
    color: data.color,
    icon: data.icon,
    imageUrl: data.imageUrl,
    displayOrder: data.displayOrder,
    email: data.email,
    phone: data.phone,
    meetingDay: data.meetingDay,
    meetingTime: data.meetingTime,
    location: data.location,
    notes: data.notes,
    isActive: data.isActive,
    leaderMemberId: data.leaderMemberId,
    viceLeaderMemberId: data.viceLeaderMemberId
  };
}

function updateMinistryData(data: MinistryUpdateInput & { slug?: string }): Prisma.MinistryUncheckedUpdateInput {
  return {
    name: data.name,
    slug: data.slug,
    description: data.description,
    color: data.color,
    icon: data.icon,
    imageUrl: data.imageUrl,
    displayOrder: data.displayOrder,
    email: data.email,
    phone: data.phone,
    meetingDay: data.meetingDay,
    meetingTime: data.meetingTime,
    location: data.location,
    notes: data.notes,
    isActive: data.isActive,
    leaderMemberId: data.leaderMemberId,
    viceLeaderMemberId: data.viceLeaderMemberId
  };
}

export const ministryRepository = {
  async list(filters: MinistryListQueryInput) {
    const where = buildWhere(filters);
    const skip = (filters.page - 1) * filters.pageSize;
    const orderBy = filters.sortBy === "displayOrder"
      ? [
          { displayOrder: filters.sortOrder },
          { name: "asc" as const }
        ]
      : {
          [filters.sortBy]: filters.sortOrder
        } satisfies Prisma.MinistryOrderByWithRelationInput | Prisma.MinistryOrderByWithRelationInput[];

    const [ministries, total] = await prisma.$transaction([
      prisma.ministry.findMany({
        where,
        select: ministrySelect,
        orderBy,
        skip,
        take: filters.pageSize
      }),
      prisma.ministry.count({ where })
    ]);

    return { ministries, total };
  },

  findById(id: string) {
    return prisma.ministry.findFirst({
      where: { id, deletedAt: null },
      select: ministrySelect
    });
  },

  findByName(name: string) {
    return prisma.ministry.findUnique({
      where: { name },
      select: { id: true }
    });
  },

  findBySlug(slug: string) {
    return prisma.ministry.findUnique({
      where: { slug },
      select: { id: true }
    });
  },

  findActiveByDisplayOrder(displayOrder: number) {
    return prisma.ministry.findFirst({
      where: { displayOrder, isActive: true, deletedAt: null },
      select: { id: true }
    });
  },

  async getNextDisplayOrder() {
    const result = await prisma.ministry.aggregate({
      where: { deletedAt: null },
      _max: { displayOrder: true }
    });

    return result._max.displayOrder === null ? 1 : result._max.displayOrder + 1;
  },

  create(data: MinistryCreateInput & { displayOrder: number }, userId: string, slug: string) {
    return prisma.ministry.create({
      data: {
        ...createMinistryData(data),
        slug,
        createdById: userId,
        updatedById: userId
      },
      select: ministrySelect
    });
  },

  update(id: string, data: MinistryUpdateInput & { slug?: string }, userId: string) {
    return prisma.ministry.update({
      where: { id },
      data: {
        ...updateMinistryData(data),
        updatedById: userId
      },
      select: ministrySelect
    });
  },

  softDelete(id: string, userId: string) {
    return prisma.ministry.update({
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
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        nickname: true,
        email: true,
        cpf: true
      },
      orderBy: { name: "asc" }
    });
  }
};
