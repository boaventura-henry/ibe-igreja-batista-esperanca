import { Prisma, ScheduleInstrumentSource } from "@prisma/client";
import { prisma } from "@/prisma/client";
import type { InstrumentUsageHistoryQueryInput } from "@/validators";

const usageSelect = {
  id: true,
  startedAt: true,
  endedAt: true,
  changeReason: true,
  instrumentCategory: {
    select: { id: true, name: true }
  },
  scheduleMember: {
    select: {
      id: true,
      status: true,
      member: {
        select: { id: true, name: true, nickname: true }
      },
      schedule: {
        select: {
          id: true,
          title: true,
          date: true,
          deletedAt: true
        }
      }
    }
  }
} satisfies Prisma.ScheduleMemberInstrumentAssignmentSelect;

export type InstrumentUsageRecord =
  Prisma.ScheduleMemberInstrumentAssignmentGetPayload<{
    select: typeof usageSelect;
  }>;

export function buildInstrumentUsageHistoryWhere(
  instrumentId: string
): Prisma.ScheduleMemberInstrumentAssignmentWhereInput {
  return {
    instrumentId,
    source: ScheduleInstrumentSource.REGISTERED
  };
}

export const instrumentUsageHistoryRepository = {
  findInstrument(id: string) {
    return prisma.instrument.findFirst({
      where: { id, deletedAt: null },
      select: { id: true }
    });
  },

  async list(
    instrumentId: string,
    filters: InstrumentUsageHistoryQueryInput
  ) {
    const where = buildInstrumentUsageHistoryWhere(instrumentId);
    const skip = (filters.page - 1) * filters.pageSize;

    const [items, total] = await prisma.$transaction([
      prisma.scheduleMemberInstrumentAssignment.findMany({
        where,
        select: usageSelect,
        orderBy: [
          { scheduleMember: { schedule: { date: "desc" } } },
          { startedAt: "desc" },
          { id: "desc" }
        ],
        skip,
        take: filters.pageSize
      }),
      prisma.scheduleMemberInstrumentAssignment.count({ where })
    ]);

    return { items, total };
  }
};
