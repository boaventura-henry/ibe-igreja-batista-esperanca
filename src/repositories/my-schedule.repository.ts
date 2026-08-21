import { Prisma, ScheduleMemberStatus, ScheduleStatus } from "@prisma/client";
import type { ScheduleDatabase } from "@/repositories/schedule.repository";
import { prisma } from "@/prisma/client";
import { applicationDateOnlyCutoff } from "@/lib/application-time";
import type { MyScheduleListQueryInput } from "@/validators";

const myScheduleMemberSelect = {
  id: true,
  role: true,
  status: true,
  confirmedAt: true,
  declinedAt: true,
  declineReason: true,
  observations: true,
  createdAt: true,
  updatedAt: true,
  instrumentAssignments: {
    where: { endedAt: null },
    select: { instrumentCategory: { select: { id: true, name: true } } },
    take: 1
  },
  replacedByMember: {
    select: { id: true, name: true, nickname: true, status: true }
  },
  schedule: {
    select: {
      id: true,
      title: true,
      description: true,
      date: true,
      startTime: true,
      endTime: true,
      location: true,
      status: true,
      observations: true,
      ministry: {
        select: {
          id: true,
          name: true,
          color: true,
          leaderMember: {
            select: {
              id: true,
              name: true,
              phone: true,
              mobilePhone: true
            }
          }
        }
      },
      members: {
        where: { deletedAt: null },
        select: {
          id: true,
          role: true,
          status: true,
          instrumentAssignments: {
            where: { endedAt: null },
            select: { instrumentCategory: { select: { id: true, name: true } } },
            take: 1
          },
          member: {
            select: { id: true, name: true, nickname: true, status: true }
          },
          replacedByMember: {
            select: { id: true, name: true, nickname: true, status: true }
          }
        },
        orderBy: [{ role: "asc" }, { member: { name: "asc" } }]
      }
    }
  }
} satisfies Prisma.ScheduleMemberSelect;

export type MyScheduleRecord = Prisma.ScheduleMemberGetPayload<{ select: typeof myScheduleMemberSelect }>;

export function buildMyScheduleWhere(
  memberId: string,
  filters: MyScheduleListQueryInput
): Prisma.ScheduleMemberWhereInput {
  return {
    OR: [{ memberId }, { replacedByMemberId: memberId }],
    deletedAt: null,
    schedule: {
      deletedAt: null,
      ...(filters.includeCompleted
        ? {}
        : {
            date: { gte: applicationDateOnlyCutoff() },
            status: { notIn: [ScheduleStatus.COMPLETED, ScheduleStatus.CANCELED] }
          })
    }
  };
}

export const myScheduleRepository = {
  listByMemberId(memberId: string, filters: MyScheduleListQueryInput) {
    return prisma.scheduleMember.findMany({
      where: buildMyScheduleWhere(memberId, filters),
      select: myScheduleMemberSelect,
      orderBy: [{ schedule: { date: "asc" } }, { status: "asc" }]
    });
  },

  findByIdForMember(id: string, memberId: string) {
    return prisma.scheduleMember.findFirst({
      where: {
        id,
        OR: [{ memberId }, { replacedByMemberId: memberId }],
        deletedAt: null,
        schedule: { deletedAt: null }
      },
      select: myScheduleMemberSelect
    });
  },

  findInstrumentChangeScheduleForMember(id: string, memberId: string) {
    return prisma.scheduleMember.findFirst({
      where: { id, memberId, deletedAt: null, schedule: { deletedAt: null } },
      select: { scheduleId: true }
    });
  },
  findInstrumentChangeForMember(id: string, memberId: string, database: ScheduleDatabase = prisma) {
    return database.scheduleMember.findFirst({
      where: { id, memberId, deletedAt: null, schedule: { deletedAt: null } },
      select: {
        id: true, memberId: true, role: true, status: true,
        schedule: { select: { id: true, status: true, date: true, startTime: true, endTime: true, deletedAt: true } },
        instrumentAssignments: {
          where: { endedAt: null }, orderBy: { startedAt: "desc" }, take: 1,
          select: { id: true, source: true, changeReason: true, instrumentCategory: { select: { id: true, name: true, isActive: true, deletedAt: true } }, instrument: { select: { id: true, name: true, status: true, deletedAt: true } } }
        }
      }
    });
  },
  async lockInstrumentChangeForMember(id: string, memberId: string, database: ScheduleDatabase) {
    await database.$queryRaw`SELECT "id" FROM "ScheduleMember" WHERE "id" = ${id} AND "memberId" = ${memberId} AND "deletedAt" IS NULL FOR UPDATE`;
    return this.findInstrumentChangeForMember(id, memberId, database);
  },
  findRepertoireForMember(id: string, memberId: string) {
    return prisma.scheduleMember.findFirst({
      where: {
        id,
        OR: [{ memberId }, { replacedByMemberId: memberId }],
        deletedAt: null,
        schedule: { deletedAt: null }
      },
      select: {
        schedule: {
          select: {
            songs: {
              where: { deletedAt: null, song: { deletedAt: null, isActive: true } },
              select: {
                id: true, position: true, referenceKey: true, performanceKey: true, useSimplifiedVersion: true,
                youtubeUrlOverride: true, resourceUrlOverride: true, notes: true,
                song: { select: { title: true, artist: true, youtubeUrl: true, resourceUrl: true, simplifiedResourceUrl: true } },
            leadMember: { select: { id: true, name: true, nickname: true } }
              },
              orderBy: { position: "asc" }
            }
          }
        }
      }
    });
  },

  confirm(id: string, userId: string) {
    return prisma.scheduleMember.update({
      where: { id },
      data: {
        status: ScheduleMemberStatus.CONFIRMED,
        confirmedAt: new Date(),
        declinedAt: null,
        declineReason: null,
        updatedById: userId
      },
      select: myScheduleMemberSelect
    });
  },

  decline(id: string, userId: string, declineReason: string | null) {
    return prisma.scheduleMember.update({
      where: { id },
      data: {
        status: ScheduleMemberStatus.DECLINED,
        declinedAt: new Date(),
        declineReason,
        confirmedAt: null,
        updatedById: userId
      },
      select: myScheduleMemberSelect
    });
  }
};
