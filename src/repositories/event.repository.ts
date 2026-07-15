import { EventStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/prisma/client";
import type { EventCreateInput, EventListQueryInput, EventUpdateInput } from "@/validators";

const eventSelect = {
  id: true,
  title: true,
  slug: true,
  description: true,
  type: true,
  status: true,
  ministry: {
    select: {
      id: true,
      name: true,
      color: true
    }
  },
  responsibleMember: {
    select: {
      id: true,
      name: true,
      nickname: true,
      email: true,
      cpf: true
    }
  },
  startDate: true,
  endDate: true,
  startTime: true,
  endTime: true,
  location: true,
  address: true,
  capacity: true,
  requiresRegistration: true,
  isPublic: true,
  imageUrl: true,
  observations: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.EventSelect;

export type EventRecord = Prisma.EventGetPayload<{ select: typeof eventSelect }>;

function dateOnly(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function buildWhere(filters: EventListQueryInput): Prisma.EventWhereInput {
  const and: Prisma.EventWhereInput[] = [{ deletedAt: null }];

  if (filters.search) {
    and.push({
      OR: [
        { title: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
        { location: { contains: filters.search, mode: "insensitive" } },
        { address: { contains: filters.search, mode: "insensitive" } },
        { ministry: { name: { contains: filters.search, mode: "insensitive" } } },
        { responsibleMember: { name: { contains: filters.search, mode: "insensitive" } } },
        { responsibleMember: { nickname: { contains: filters.search, mode: "insensitive" } } }
      ]
    });
  }

  if (filters.type) {
    and.push({ type: filters.type });
  }

  if (filters.status) {
    and.push({ status: filters.status });
  }

  if (filters.ministryId) {
    and.push({ ministryId: filters.ministryId });
  }

  if (filters.startDate) {
    and.push({ startDate: { gte: dateOnly(filters.startDate) } });
  }

  if (filters.endDate) {
    and.push({ startDate: { lte: dateOnly(filters.endDate) } });
  }

  if (filters.isPublic !== undefined) {
    and.push({ isPublic: filters.isPublic });
  }

  return { AND: and };
}

function createData(data: EventCreateInput, slug: string, userId: string): Prisma.EventUncheckedCreateInput {
  return {
    title: data.title,
    slug,
    description: data.description,
    type: data.type,
    status: data.status,
    ministryId: data.ministryId,
    responsibleMemberId: data.responsibleMemberId,
    startDate: dateOnly(data.startDate),
    endDate: data.endDate ? dateOnly(data.endDate) : null,
    startTime: data.startTime,
    endTime: data.endTime,
    location: data.location,
    address: data.address,
    capacity: data.capacity,
    requiresRegistration: data.requiresRegistration,
    isPublic: data.isPublic,
    imageUrl: data.imageUrl,
    observations: data.observations,
    createdById: userId,
    updatedById: userId
  };
}

function updateData(data: EventUpdateInput & { slug?: string }): Prisma.EventUncheckedUpdateInput {
  return {
    title: data.title,
    slug: data.slug,
    description: data.description,
    type: data.type,
    status: data.status,
    ministryId: data.ministryId,
    responsibleMemberId: data.responsibleMemberId,
    startDate: data.startDate ? dateOnly(data.startDate) : undefined,
    endDate: data.endDate === undefined ? undefined : data.endDate ? dateOnly(data.endDate) : null,
    startTime: data.startTime,
    endTime: data.endTime,
    location: data.location,
    address: data.address,
    capacity: data.capacity,
    requiresRegistration: data.requiresRegistration,
    isPublic: data.isPublic,
    imageUrl: data.imageUrl,
    observations: data.observations
  };
}

export const eventRepository = {
  async list(filters: EventListQueryInput) {
    const where = buildWhere(filters);
    const skip = (filters.page - 1) * filters.pageSize;
    const orderBy = {
      [filters.sortBy]: filters.sortDirection
    } satisfies Prisma.EventOrderByWithRelationInput;

    const [events, total] = await prisma.$transaction([
      prisma.event.findMany({
        where,
        select: eventSelect,
        orderBy,
        skip,
        take: filters.pageSize
      }),
      prisma.event.count({ where })
    ]);

    return { events, total };
  },

  listPublicPublished(limit = 50) {
    return prisma.event.findMany({
      where: {
        deletedAt: null,
        isPublic: true,
        status: EventStatus.PUBLISHED
      },
      select: eventSelect,
      orderBy: [{ startDate: "asc" }, { startTime: "asc" }],
      take: limit
    });
  },

  findById(id: string) {
    return prisma.event.findFirst({
      where: { id, deletedAt: null },
      select: eventSelect
    });
  },

  findBySlug(slug: string) {
    return prisma.event.findUnique({
      where: { slug },
      select: { id: true }
    });
  },

  findMinistryById(id: string) {
    return prisma.ministry.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, isActive: true }
    });
  },

  findMemberById(id: string) {
    return prisma.member.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, status: true }
    });
  },

  create(data: EventCreateInput, slug: string, userId: string) {
    return prisma.event.create({
      data: createData(data, slug, userId),
      select: eventSelect
    });
  },

  update(id: string, data: EventUpdateInput & { slug?: string }, userId: string) {
    return prisma.event.update({
      where: { id },
      data: {
        ...updateData(data),
        updatedById: userId
      },
      select: eventSelect
    });
  },

  updateStatus(id: string, status: EventStatus, userId: string) {
    return prisma.event.update({
      where: { id },
      data: {
        status,
        updatedById: userId
      },
      select: eventSelect
    });
  },

  softDelete(id: string, userId: string) {
    return prisma.event.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedById: userId
      },
      select: { id: true, deletedAt: true }
    });
  },

  listMinistries() {
    return prisma.ministry.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" }
    });
  },

  listMembers() {
    return prisma.member.findMany({
      where: { deletedAt: null, status: "ACTIVE" },
      select: { id: true, name: true, nickname: true, email: true, cpf: true },
      orderBy: { name: "asc" }
    });
  }
};
