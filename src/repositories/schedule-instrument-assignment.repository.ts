import { InstrumentStatus, Prisma } from "@prisma/client";
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

export const scheduleInstrumentAssignmentRepository = {
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

  findParticipant(id: string, scheduleId: string, database: ScheduleDatabase = prisma) {
    return database.scheduleMember.findFirst({
      where: { id, scheduleId, deletedAt: null },
      select: { id: true, role: true, status: true, scheduleId: true }
    });
  }
};