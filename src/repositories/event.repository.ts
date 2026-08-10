import { EventStatus, Prisma } from "@prisma/client";
import { prisma } from "@/prisma/client";
import { applicationDateOnlyCutoff } from "@/lib/application-time";
import type { EventCreateInput, EventListQueryInput, EventUpdateInput } from "@/validators";

const eventSelect = {
  id: true,
  title: true,
  slug: true,
  description: true,
  type: true,
  status: true,
  publishedAt: true,
  notificationVersion: true,
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
export type EventDatabase = Prisma.TransactionClient | typeof prisma;

function dateOnly(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function buildEventWhere(filters: EventListQueryInput): Prisma.EventWhereInput {
  const and: Prisma.EventWhereInput[] = [{ deletedAt: null }];

  if (!filters.includeArchived) {
    const today = applicationDateOnlyCutoff();
    and.push(
      { status: { notIn: [EventStatus.ARCHIVED, EventStatus.CANCELED, EventStatus.COMPLETED] } },
      { OR: [{ endDate: { gte: today } }, { endDate: null, startDate: { gte: today } }] }
    );
  }

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
  transaction<T>(callback: (database: Prisma.TransactionClient) => Promise<T>) {
    return prisma.$transaction(callback, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5_000,
      timeout: 30_000
    });
  },

  async list(filters: EventListQueryInput) {
    const where = buildEventWhere(filters);
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
    const today = applicationDateOnlyCutoff();
    return prisma.event.findMany({
      where: {
        deletedAt: null,
        isPublic: true,
        status: EventStatus.PUBLISHED,
        OR: [{ endDate: { gte: today } }, { endDate: null, startDate: { gte: today } }]
      },
      select: eventSelect,
      orderBy: [{ startDate: "asc" }, { startTime: "asc" }],
      take: limit
    });
  },

  findById(id: string, database: EventDatabase = prisma) {
    return database.event.findFirst({
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

  create(
    data: EventCreateInput,
    slug: string,
    userId: string,
    database: EventDatabase = prisma,
    notificationState?: { publishedAt: Date; notificationVersion: number }
  ) {
    return database.event.create({
      data: {
        ...createData(data, slug, userId),
        ...(notificationState ?? {})
      },
      select: eventSelect
    });
  },

  update(
    id: string,
    data: EventUpdateInput & { slug?: string },
    userId: string,
    database: EventDatabase = prisma
  ) {
    return database.event.update({
      where: { id },
      data: {
        ...updateData(data),
        updatedById: userId
      },
      select: eventSelect
    });
  },

  async transitionStatus(
    id: string,
    fromStatuses: EventStatus[],
    status: EventStatus,
    userId: string,
    database: EventDatabase,
    options: { publishedAt?: Date; incrementNotificationVersion?: boolean } = {}
  ) {
    const result = await database.event.updateMany({
      where: { id, deletedAt: null, status: { in: fromStatuses } },
      data: {
        status,
        updatedById: userId,
        ...(options.publishedAt ? { publishedAt: options.publishedAt } : {}),
        ...(options.incrementNotificationVersion
          ? { notificationVersion: { increment: 1 } }
          : {})
      }
    });
    if (result.count === 0) return null;
    return this.findById(id, database);
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

  softDeleteWithinTransaction(id: string, userId: string, database: EventDatabase) {
    return database.event.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date(), updatedById: userId }
    });
  },

  incrementNotificationVersion(id: string, database: EventDatabase) {
    return database.event.update({
      where: { id },
      data: { notificationVersion: { increment: 1 } },
      select: { notificationVersion: true }
    });
  },

  listActivePortalUsers(database: EventDatabase = prisma) {
    return database.user.findMany({
      where: {
        isActive: true,
        memberId: { not: null },
        member: { is: { deletedAt: null, status: "ACTIVE" } }
      },
      select: { id: true }
    });
  },

  listActivePortalUsersByIds(userIds: string[], database: EventDatabase = prisma) {
    if (!userIds.length) return Promise.resolve([] as Array<{ id: string }>);
    return database.user.findMany({
      where: {
        id: { in: [...new Set(userIds)] },
        isActive: true,
        memberId: { not: null },
        member: { is: { deletedAt: null, status: "ACTIVE" } }
      },
      select: { id: true }
    });
  },

  listPublishedByIds(eventIds: string[], database: EventDatabase = prisma) {
    if (!eventIds.length) return Promise.resolve([] as EventRecord[]);
    return database.event.findMany({
      where: { id: { in: [...new Set(eventIds)] }, deletedAt: null, status: EventStatus.PUBLISHED },
      select: eventSelect
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
