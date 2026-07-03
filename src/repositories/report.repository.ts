import {
  EventStatus,
  FinancialEntryType,
  MemberStatus,
  Prisma,
  ScheduleStatus,
  WeekDay
} from "@prisma/client";
import { endOfDate, parseDate } from "@/lib/report";
import { prisma } from "@/prisma/client";
import type {
  EventReportInput,
  FinancialReportInput,
  MemberReportInput,
  MinistryReportInput,
  ScheduleReportInput
} from "@/validators";

const EXPORT_ROW_LIMIT = 5000;

function paginate(input: { page: number; pageSize: number; exportFormat: string }): { skip?: number; take?: number } {
  if (input.exportFormat !== "view") {
    return { take: EXPORT_ROW_LIMIT };
  }

  return {
    skip: (input.page - 1) * input.pageSize,
    take: input.pageSize
  };
}

function sortBy<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return value && allowed.includes(value as T) ? (value as T) : fallback;
}

export const reportRepository = {
  async members(input: MemberReportInput) {
    const where: Prisma.MemberWhereInput = {
      deletedAt: null,
      ...(input.filters.name ? { name: { contains: input.filters.name, mode: "insensitive" } } : {}),
      ...(input.filters.status ? { status: input.filters.status as MemberStatus } : {}),
      ...(input.filters.city ? { city: { contains: input.filters.city, mode: "insensitive" } } : {}),
      ...(input.filters.ministryId
        ? {
            memberMinistries: {
              some: { ministryId: input.filters.ministryId, status: "ACTIVE", deletedAt: null }
            }
          }
        : {}),
      ...((input.filters.createdFrom || input.filters.createdTo)
        ? {
            createdAt: {
              gte: parseDate(input.filters.createdFrom),
              lte: endOfDate(input.filters.createdTo)
            }
          }
        : {})
    };
    const orderBy = {
      [sortBy(input.sortBy, ["name", "cpf", "email", "city", "status", "createdAt"], "name")]: input.sortOrder
    } satisfies Prisma.MemberOrderByWithRelationInput;

    const [rows, total] = await prisma.$transaction([
      prisma.member.findMany({
        where,
        select: {
          id: true,
          name: true,
          cpf: true,
          email: true,
          city: true,
          state: true,
          status: true,
          createdAt: true,
          memberMinistries: {
            where: { deletedAt: null, status: "ACTIVE" },
            select: { ministry: { select: { name: true } } },
            orderBy: { ministry: { name: "asc" } }
          }
        },
        orderBy,
        ...paginate(input)
      }),
      prisma.member.count({ where })
    ]);

    return { rows, total };
  },

  async ministries(input: MinistryReportInput) {
    const where: Prisma.MinistryWhereInput = {
      deletedAt: null,
      ...(input.filters.status === "ACTIVE" ? { isActive: true } : {}),
      ...(input.filters.status === "INACTIVE" ? { isActive: false } : {}),
      ...(input.filters.leaderMemberId
        ? {
            OR: [
              { leaderMemberId: input.filters.leaderMemberId },
              { viceLeaderMemberId: input.filters.leaderMemberId }
            ]
          }
        : {}),
      ...(input.filters.meetingDay ? { meetingDay: input.filters.meetingDay as WeekDay } : {})
    };
    const orderBy = {
      [sortBy(input.sortBy, ["name", "isActive", "meetingDay", "displayOrder"], "displayOrder")]: input.sortOrder
    } satisfies Prisma.MinistryOrderByWithRelationInput;

    const [rows, total] = await prisma.$transaction([
      prisma.ministry.findMany({
        where,
        select: {
          id: true,
          name: true,
          isActive: true,
          leaderMember: { select: { name: true } },
          viceLeaderMember: { select: { name: true } },
          meetingDay: true,
          meetingTime: true,
          location: true,
          displayOrder: true
        },
        orderBy,
        ...paginate(input)
      }),
      prisma.ministry.count({ where })
    ]);

    return { rows, total };
  },

  async schedules(input: ScheduleReportInput) {
    const where: Prisma.ScheduleWhereInput = {
      deletedAt: null,
      ...(input.filters.ministryId ? { ministryId: input.filters.ministryId } : {}),
      ...(input.filters.status ? { status: input.filters.status as ScheduleStatus } : {}),
      ...(input.filters.memberId
        ? { members: { some: { memberId: input.filters.memberId, deletedAt: null } } }
        : {}),
      ...((input.filters.startDate || input.filters.endDate)
        ? {
            date: {
              gte: parseDate(input.filters.startDate),
              lte: endOfDate(input.filters.endDate)
            }
          }
        : {})
    };
    const orderBy = {
      [sortBy(input.sortBy, ["title", "date", "status", "createdAt"], "date")]: input.sortOrder
    } satisfies Prisma.ScheduleOrderByWithRelationInput;

    const [rows, total] = await prisma.$transaction([
      prisma.schedule.findMany({
        where,
        select: {
          id: true,
          title: true,
          date: true,
          startTime: true,
          endTime: true,
          status: true,
          ministry: { select: { name: true } },
          members: {
            where: { deletedAt: null },
            select: { member: { select: { name: true } } },
            orderBy: { member: { name: "asc" } }
          }
        },
        orderBy,
        ...paginate(input)
      }),
      prisma.schedule.count({ where })
    ]);

    return { rows, total };
  },

  async events(input: EventReportInput) {
    const where: Prisma.EventWhereInput = {
      deletedAt: null,
      ...(input.filters.type ? { type: input.filters.type as never } : {}),
      ...(input.filters.status ? { status: input.filters.status as EventStatus } : {}),
      ...(input.filters.ministryId ? { ministryId: input.filters.ministryId } : {}),
      ...((input.filters.startDate || input.filters.endDate)
        ? {
            startDate: {
              gte: parseDate(input.filters.startDate),
              lte: endOfDate(input.filters.endDate)
            }
          }
        : {})
    };
    const orderBy = {
      [sortBy(input.sortBy, ["title", "type", "status", "startDate", "isPublic", "createdAt"], "startDate")]: input.sortOrder
    } satisfies Prisma.EventOrderByWithRelationInput;

    const [rows, total] = await prisma.$transaction([
      prisma.event.findMany({
        where,
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          startDate: true,
          startTime: true,
          ministry: { select: { name: true } },
          location: true,
          isPublic: true
        },
        orderBy,
        ...paginate(input)
      }),
      prisma.event.count({ where })
    ]);

    return { rows, total };
  },

  async financial(input: FinancialReportInput) {
    const where: Prisma.FinancialEntryWhereInput = {
      deletedAt: null,
      ...(input.filters.categoryId ? { categoryId: input.filters.categoryId } : {}),
      ...(input.filters.type ? { type: input.filters.type as FinancialEntryType } : {}),
      ...(input.filters.paymentMethod ? { paymentMethod: input.filters.paymentMethod as never } : {}),
      ...(input.filters.ministryId ? { ministryId: input.filters.ministryId } : {}),
      ...(input.filters.eventId ? { eventId: input.filters.eventId } : {}),
      ...(input.filters.memberId ? { memberId: input.filters.memberId } : {}),
      ...((input.filters.startDate || input.filters.endDate)
        ? {
            launchDate: {
              gte: parseDate(input.filters.startDate),
              lte: endOfDate(input.filters.endDate)
            }
          }
        : {})
    };
    const orderBy = {
      [sortBy(input.sortBy, ["entryNumber", "type", "launchDate", "amount", "paymentMethod", "status"], "launchDate")]: input.sortOrder
    } satisfies Prisma.FinancialEntryOrderByWithRelationInput;

    const [rows, total] = await prisma.$transaction([
      prisma.financialEntry.findMany({
        where,
        select: {
          id: true,
          entryNumber: true,
          type: true,
          launchDate: true,
          category: { select: { name: true } },
          amount: true,
          paymentMethod: true,
          status: true,
          member: { select: { name: true } },
          ministry: { select: { name: true } },
          event: { select: { title: true } }
        },
        orderBy,
        ...paginate(input)
      }),
      prisma.financialEntry.count({ where })
    ]);

    return { rows, total };
  },

  portalContributions(memberId: string) {
    return prisma.financialEntry.findMany({
      where: {
        memberId,
        deletedAt: null,
        anonymous: false,
        type: FinancialEntryType.INCOME,
        status: "CONFIRMED",
        category: { deletedAt: null, showInMemberPortal: true }
      },
      select: {
        id: true,
        launchDate: true,
        category: { select: { name: true } },
        amount: true,
        paymentMethod: true,
        status: true
      },
      orderBy: [{ launchDate: "desc" }, { entryNumber: "desc" }]
    });
  },

  listFilterOptions() {
    return prisma.$transaction([
      prisma.ministry.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" }
      }),
      prisma.member.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
        take: 500
      }),
      prisma.financialCategory.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, type: true },
        orderBy: [{ type: "asc" }, { displayOrder: "asc" }, { name: "asc" }]
      }),
      prisma.event.findMany({
        where: { deletedAt: null },
        select: { id: true, title: true },
        orderBy: { startDate: "desc" },
        take: 300
      })
    ]);
  }
};
