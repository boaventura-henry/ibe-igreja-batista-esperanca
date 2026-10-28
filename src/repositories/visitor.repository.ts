import { Prisma, PrismaClient, VisitorPrivacyChannel, VisitorStatus } from "@prisma/client";
import { visitorCivilDate } from "@/lib/visitor-civil-date";
import { prisma } from "@/prisma/client";
import { onlyDigits } from "@/utils";
import type { VisitorAdminUpdateInput, VisitorCreateInput, VisitorListQueryInput, VisitorUpdateInput } from "@/validators";

const visitorSelect = {
  id: true,
  name: true,
  phone: true,
  birthDate: true,
  street: true,
  number: true,
  complement: true,
  district: true,
  city: true,
  state: true,
  status: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.VisitorSelect;

export type VisitorRecord = Prisma.VisitorGetPayload<{ select: typeof visitorSelect }>;
export type VisitorDatabase = Prisma.TransactionClient | typeof prisma;

const visitorListSelect = {
  id: true, name: true, phone: true, birthDate: true, status: true, createdAt: true, updatedAt: true
} satisfies Prisma.VisitorSelect;

const visitorDetailSelect = {
  ...visitorSelect,
  createdBy: { select: { name: true } },
  updatedBy: { select: { name: true } },
  privacyRecords: {
    select: { noticeVersion: true, channel: true, acknowledgedAt: true, createdAt: true },
    orderBy: [{ acknowledgedAt: "desc" }, { id: "desc" }]
  },
} satisfies Prisma.VisitorSelect;

export type VisitorDetailRecord = Prisma.VisitorGetPayload<{ select: typeof visitorDetailSelect }>;

function visitorCreateData(data: VisitorCreateInput, userId?: string): Prisma.VisitorUncheckedCreateInput {
  return { ...data, birthDate: visitorCivilDate(data.birthDate), createdById: userId, updatedById: userId };
}

function visitorUpdateData(data: VisitorUpdateInput | VisitorAdminUpdateInput, userId?: string): Prisma.VisitorUncheckedUpdateInput {
  return { ...data, birthDate: data.birthDate ? visitorCivilDate(data.birthDate) : undefined, updatedById: userId };
}

export const visitorRepository = {
  transaction<T>(callback: (database: Prisma.TransactionClient) => Promise<T>, client: PrismaClient = prisma) {
    return client.$transaction(callback, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5_000,
      timeout: 30_000
    });
  },

  findByIdentity(phone: string, birthDate: Date, database: VisitorDatabase = prisma) {
    return database.visitor.findFirst({ where: { phone, birthDate: visitorCivilDate(birthDate), deletedAt: null }, select: visitorSelect });
  },

  findById(id: string, database: VisitorDatabase = prisma) {
    return database.visitor.findFirst({ where: { id, deletedAt: null }, select: visitorSelect });
  },

  findDetailById(id: string) {
    return prisma.visitor.findFirst({ where: { id, deletedAt: null }, select: visitorDetailSelect });
  },

  async list(filters: VisitorListQueryInput) {
    const normalizedPhone = onlyDigits(filters.search);
    const search = filters.search?.trim();
    const where: Prisma.VisitorWhereInput = {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              ...(normalizedPhone ? [{ phone: { contains: normalizedPhone } }] : [])
            ]
          }
        : {}),
      ...(filters.status ? { status: filters.status } : {})
    };
    const skip = (filters.page - 1) * filters.pageSize;
    const orderBy: Prisma.VisitorOrderByWithRelationInput[] = [
      { [filters.sortBy]: filters.sortOrder },
      { id: filters.sortOrder }
    ];
    const [visitors, total] = await prisma.$transaction([
      prisma.visitor.findMany({ where, select: visitorListSelect, orderBy, skip, take: filters.pageSize }),
      prisma.visitor.count({ where })
    ]);
    return { visitors, total };
  },

  findIdentityConflict(phone: string, birthDate: Date, ignoreId: string) {
    return prisma.visitor.findFirst({
      where: { phone, birthDate: visitorCivilDate(birthDate), id: { not: ignoreId } },
      select: { id: true }
    });
  },

  create(data: VisitorCreateInput, userId?: string, database: VisitorDatabase = prisma) {
    return database.visitor.create({ data: visitorCreateData(data, userId), select: visitorSelect });
  },

  update(id: string, data: VisitorUpdateInput | VisitorAdminUpdateInput, userId?: string, database: VisitorDatabase = prisma) {
    return database.visitor.update({
      where: { id, deletedAt: null, status: { not: VisitorStatus.CONVERTED } },
      data: visitorUpdateData(data, userId),
      select: visitorSelect
    });
  },

  async softDelete(id: string, userId: string) {
    return prisma.visitor.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date(), updatedById: userId }
    });
  },

  async listVisits(visitorId: string, page: number, pageSize: number) {
    const where: Prisma.VisitorVisitWhereInput = { visitorId, visitor: { deletedAt: null } };
    const skip = (page - 1) * pageSize;
    const [visitor, visits, total] = await prisma.$transaction([
      prisma.visitor.findFirst({ where: { id: visitorId, deletedAt: null }, select: { id: true } }),
      prisma.visitorVisit.findMany({
        where,
        select: { id: true, visitDate: true, createdAt: true },
        orderBy: [{ visitDate: "desc" }, { id: "desc" }],
        skip,
        take: pageSize
      }),
      prisma.visitorVisit.count({ where })
    ], { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { visitorFound: Boolean(visitor), visits, total };
  },

  visitSummary(visitorId: string) {
    return prisma.visitorVisit.aggregate({
      where: { visitorId },
      _count: { _all: true },
      _min: { visitDate: true },
      _max: { visitDate: true }
    });
  },

  reactivate(id: string, database: VisitorDatabase = prisma) {
    return database.visitor.update({ where: { id }, data: { status: VisitorStatus.ACTIVE }, select: visitorSelect });
  },

  upsertVisit(visitorId: string, visitDate: Date, database: VisitorDatabase = prisma) {
    const civilVisitDate = visitorCivilDate(visitDate);
    return database.visitorVisit.upsert({
      where: { visitorId_visitDate: { visitorId, visitDate: civilVisitDate } },
      create: { visitorId, visitDate: civilVisitDate },
      update: {}
    });
  },

  upsertPrivacyRecord(visitorId: string, noticeVersion: string, channel: VisitorPrivacyChannel, database: VisitorDatabase = prisma) {
    return database.visitorPrivacyRecord.upsert({
      where: { visitorId_noticeVersion_channel: { visitorId, noticeVersion, channel } },
      create: { visitorId, noticeVersion, channel, acknowledgedAt: new Date() },
      update: {}
    });
  }
};
