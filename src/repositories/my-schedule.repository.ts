import { Prisma, ScheduleMemberStatus } from "@prisma/client";
import { prisma } from "@/prisma/client";

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
  replacedByMember: {
    select: { id: true, name: true, status: true }
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
          member: {
            select: { id: true, name: true, status: true }
          },
          replacedByMember: {
            select: { id: true, name: true, status: true }
          }
        },
        orderBy: [{ role: "asc" }, { member: { name: "asc" } }]
      }
    }
  }
} satisfies Prisma.ScheduleMemberSelect;

export type MyScheduleRecord = Prisma.ScheduleMemberGetPayload<{ select: typeof myScheduleMemberSelect }>;

export const myScheduleRepository = {
  listByMemberId(memberId: string) {
    return prisma.scheduleMember.findMany({
      where: {
        memberId,
        deletedAt: null,
        schedule: { deletedAt: null }
      },
      select: myScheduleMemberSelect,
      orderBy: [{ schedule: { date: "asc" } }, { status: "asc" }]
    });
  },

  findByIdForMember(id: string, memberId: string) {
    return prisma.scheduleMember.findFirst({
      where: {
        id,
        memberId,
        deletedAt: null,
        schedule: { deletedAt: null }
      },
      select: myScheduleMemberSelect
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
