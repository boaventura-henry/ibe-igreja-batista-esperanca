import { InstrumentStatus, Prisma, ScheduleMemberStatus, ScheduleStatus } from "@prisma/client";
import { prisma } from "@/prisma/client";
import type { ScheduleDatabase } from "@/repositories/schedule.repository";
import type { ScheduleInstrumentAssignmentInput } from "@/validators/schedule-instrument-assignment.validator";

const assignmentSelect = {
  id: true,
  source: true,
  startedAt: true,
  endedAt: true,
  changeReason: true,
  createdAt: true,
  instrumentCategory: { select: { id: true, name: true, isActive: true, deletedAt: true } },
  instrument: {
    select: { id: true, name: true, brand: true, model: true, status: true, deletedAt: true }
  },
  createdBy: { select: { id: true, name: true } }
} satisfies Prisma.ScheduleMemberInstrumentAssignmentSelect;

export type ScheduleInstrumentAssignmentRecord = Prisma.ScheduleMemberInstrumentAssignmentGetPayload<{
  select: typeof assignmentSelect;
}>;

const suggestionHistorySelect = {
  id: true,
  schedule: { select: { id: true, date: true, startTime: true } },
  instrumentAssignments: {
    select: assignmentSelect,
    orderBy: [{ startedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: 1
  }
} satisfies Prisma.ScheduleMemberSelect;

export type ScheduleInstrumentSuggestionHistoryRecord = Prisma.ScheduleMemberGetPayload<{
  select: typeof suggestionHistorySelect;
}>;

export function buildInstrumentSuggestionHistoryWhere(input: {
  memberId: string;
  scheduleId: string;
  scheduleDate: Date;
  scheduleStartTime: string | null;
}): Prisma.ScheduleMemberWhereInput {
  return {
    memberId: input.memberId,
    scheduleId: { not: input.scheduleId },
    status: { not: ScheduleMemberStatus.REPLACED },
    deletedAt: null,
    instrumentAssignments: { some: {} },
    schedule: {
      deletedAt: null,
      status: { not: ScheduleStatus.CANCELED },
      OR: [
        { date: { lt: input.scheduleDate } },
        ...(input.scheduleStartTime
          ? [{ date: input.scheduleDate, startTime: { not: null, lt: input.scheduleStartTime } }]
          : [])
      ]
    }
  };
}

export const scheduleInstrumentAssignmentRepository = {
  findLatestInstrumentSuggestionHistory(
    input: {
      memberId: string;
      scheduleId: string;
      scheduleDate: Date;
      scheduleStartTime: string | null;
    },
    database: ScheduleDatabase = prisma
  ) {
    return database.scheduleMember.findFirst({
      where: buildInstrumentSuggestionHistoryWhere(input),
      select: suggestionHistorySelect,
      orderBy: [
        { schedule: { date: "desc" } },
        { schedule: { startTime: "desc" } },
        { id: "desc" }
      ]
    });
  },

  findCurrent(scheduleMemberId: string, database: ScheduleDatabase = prisma) {
    return database.scheduleMemberInstrumentAssignment.findFirst({
      where: { scheduleMemberId, endedAt: null },
      select: assignmentSelect,
      orderBy: { startedAt: "desc" }
    });
  },

  findCategoryForNewAssignment(id: string, database: ScheduleDatabase = prisma) {
    return database.instrumentCategory.findFirst({
      where: { id, isActive: true, deletedAt: null },
      select: { id: true, name: true }
    });
  },

  findEligibleInstrument(id: string, categoryId: string, database: ScheduleDatabase = prisma) {
    return database.instrument.findFirst({
      where: { id, categoryId, status: InstrumentStatus.ACTIVE, deletedAt: null },
      select: { id: true, name: true, brand: true, model: true, status: true, categoryId: true }
    });
  },

  listEligible(categoryId: string, database: ScheduleDatabase = prisma) {
    return database.instrument.findMany({
      where: {
        categoryId,
        status: InstrumentStatus.ACTIVE,
        deletedAt: null,
        category: { isActive: true, deletedAt: null }
      },
      select: { id: true, name: true, brand: true, model: true, status: true },
      orderBy: { name: "asc" }
    });
  },

  createInitial(
    scheduleMemberId: string,
    input: ScheduleInstrumentAssignmentInput,
    userId: string,
    database: ScheduleDatabase
  ) {
    return database.scheduleMemberInstrumentAssignment.create({
      data: {
        scheduleMemberId,
        instrumentCategoryId: input.instrumentCategoryId,
        source: input.source,
        instrumentId: input.instrumentId,
        changeReason: input.changeReason,
        createdById: userId,
        updatedById: userId
      },
      select: assignmentSelect
    });
  },

  endActive(scheduleMemberId: string, userId: string, endedAt: Date, database: ScheduleDatabase) {
    const assignmentClient = database.scheduleMemberInstrumentAssignment;
    if (!assignmentClient) return Promise.resolve({ count: 0 });
    return assignmentClient.updateMany({
      where: { scheduleMemberId, endedAt: null },
      data: { endedAt, updatedById: userId }
    });
  },

  async lockParticipant(id: string, scheduleId: string, database: ScheduleDatabase) {
    await database.$queryRaw`SELECT "id" FROM "ScheduleMember" WHERE "id" = ${id} AND "scheduleId" = ${scheduleId} AND "deletedAt" IS NULL FOR UPDATE`;
    return this.findParticipant(id, scheduleId, database);
  },
  findParticipant(id: string, scheduleId: string, database: ScheduleDatabase = prisma) {
    return database.scheduleMember.findFirst({
      where: { id, scheduleId, deletedAt: null },
      select: { id: true, role: true, roles: { select: { role: true } }, status: true, scheduleId: true }
    });
  }
};
