import { Prisma, PrismaClient, VisitorPrivacyChannel, VisitorStatus } from "@prisma/client";
import { visitorCivilDate } from "@/lib/visitor-civil-date";
import { prisma } from "@/prisma/client";
import type { VisitorCreateInput, VisitorUpdateInput } from "@/validators";

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

function visitorCreateData(data: VisitorCreateInput, userId?: string): Prisma.VisitorUncheckedCreateInput {
  return { ...data, birthDate: visitorCivilDate(data.birthDate), createdById: userId, updatedById: userId };
}

function visitorUpdateData(data: VisitorUpdateInput, userId?: string): Prisma.VisitorUncheckedUpdateInput {
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

  create(data: VisitorCreateInput, userId?: string, database: VisitorDatabase = prisma) {
    return database.visitor.create({ data: visitorCreateData(data, userId), select: visitorSelect });
  },

  update(id: string, data: VisitorUpdateInput, userId?: string, database: VisitorDatabase = prisma) {
    return database.visitor.update({ where: { id }, data: visitorUpdateData(data, userId), select: visitorSelect });
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
