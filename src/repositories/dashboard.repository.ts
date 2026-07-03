import {
  AnnouncementStatus,
  EventStatus,
  FinancialEntryStatus,
  FinancialEntryType,
  MemberStatus,
  ScheduleStatus,
  type Prisma
} from "@prisma/client";
import { prisma } from "@/prisma/client";

const upcomingEventSelect = {
  id: true,
  title: true,
  startDate: true,
  startTime: true,
  location: true
} satisfies Prisma.EventSelect;

const upcomingScheduleSelect = {
  id: true,
  title: true,
  date: true,
  startTime: true,
  endTime: true,
  location: true,
  ministry: {
    select: {
      id: true,
      name: true,
      color: true
    }
  }
} satisfies Prisma.ScheduleSelect;

const latestContributionSelect = {
  id: true,
  entryNumber: true,
  amount: true,
  launchDate: true,
  member: {
    select: {
      id: true,
      name: true
    }
  },
  category: {
    select: {
      id: true,
      name: true
    }
  }
} satisfies Prisma.FinancialEntrySelect;

const portalScheduleSelect = {
  id: true,
  role: true,
  status: true,
  schedule: {
    select: {
      id: true,
      title: true,
      date: true,
      startTime: true,
      endTime: true,
      location: true,
      ministry: {
        select: {
          id: true,
          name: true,
          color: true
        }
      }
    }
  }
} satisfies Prisma.ScheduleMemberSelect;

export type AdminDashboardEventRecord = Prisma.EventGetPayload<{ select: typeof upcomingEventSelect }>;
export type AdminDashboardScheduleRecord = Prisma.ScheduleGetPayload<{ select: typeof upcomingScheduleSelect }>;
export type AdminDashboardContributionRecord = Prisma.FinancialEntryGetPayload<{
  select: typeof latestContributionSelect;
}>;
export type PortalDashboardScheduleRecord = Prisma.ScheduleMemberGetPayload<{ select: typeof portalScheduleSelect }>;

function startOfUtcDay(value = new Date()) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function currentMonthRange(value = new Date()) {
  const start = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
  const end = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 1));

  return { start, end };
}

export const dashboardRepository = {
  async getAdminDashboardData() {
    const today = startOfUtcDay();
    const month = currentMonthRange();

    const [
      activeMembers,
      newMembersThisMonth,
      upcomingEvents,
      upcomingSchedules,
      monthlyIncome,
      monthlyExpense,
      latestContributions,
      publishedAnnouncements,
      activeAnnouncements,
      pinnedAnnouncements
    ] = await prisma.$transaction([
      prisma.member.count({
        where: {
          deletedAt: null,
          status: MemberStatus.ACTIVE
        }
      }),
      prisma.member.count({
        where: {
          deletedAt: null,
          createdAt: {
            gte: month.start,
            lt: month.end
          }
        }
      }),
      prisma.event.findMany({
        where: {
          deletedAt: null,
          status: EventStatus.PUBLISHED,
          startDate: { gte: today }
        },
        select: upcomingEventSelect,
        orderBy: [{ startDate: "asc" }, { startTime: "asc" }],
        take: 5
      }),
      prisma.schedule.findMany({
        where: {
          deletedAt: null,
          status: { not: ScheduleStatus.CANCELED },
          date: { gte: today }
        },
        select: upcomingScheduleSelect,
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        take: 5
      }),
      prisma.financialEntry.aggregate({
        where: {
          deletedAt: null,
          type: FinancialEntryType.INCOME,
          status: FinancialEntryStatus.CONFIRMED,
          launchDate: {
            gte: month.start,
            lt: month.end
          }
        },
        _sum: { amount: true }
      }),
      prisma.financialEntry.aggregate({
        where: {
          deletedAt: null,
          type: FinancialEntryType.EXPENSE,
          status: FinancialEntryStatus.CONFIRMED,
          launchDate: {
            gte: month.start,
            lt: month.end
          }
        },
        _sum: { amount: true }
      }),
      prisma.financialEntry.findMany({
        where: {
          deletedAt: null,
          type: FinancialEntryType.INCOME,
          status: FinancialEntryStatus.CONFIRMED
        },
        select: latestContributionSelect,
        orderBy: [{ launchDate: "desc" }, { createdAt: "desc" }],
        take: 5
      }),
      prisma.announcement.count({
        where: {
          deletedAt: null,
          status: AnnouncementStatus.PUBLISHED
        }
      }),
      prisma.announcement.count({
        where: {
          deletedAt: null,
          status: AnnouncementStatus.PUBLISHED,
          OR: [{ publishAt: null }, { publishAt: { lte: new Date() } }],
          AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }]
        }
      }),
      prisma.announcement.count({
        where: {
          deletedAt: null,
          status: AnnouncementStatus.PUBLISHED,
          isPinned: true,
          OR: [{ publishAt: null }, { publishAt: { lte: new Date() } }],
          AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }]
        }
      })
    ]);

    return {
      activeMembers,
      newMembersThisMonth,
      upcomingEvents,
      upcomingSchedules,
      monthlyIncome: monthlyIncome._sum.amount,
      monthlyExpense: monthlyExpense._sum.amount,
      latestContributions,
      publishedAnnouncements,
      activeAnnouncements,
      pinnedAnnouncements
    };
  },

  findNextScheduleForMember(memberId: string) {
    return prisma.scheduleMember.findFirst({
      where: {
        memberId,
        deletedAt: null,
        schedule: {
          deletedAt: null,
          status: { not: ScheduleStatus.CANCELED },
          date: { gte: startOfUtcDay() }
        }
      },
      select: portalScheduleSelect,
      orderBy: [{ schedule: { date: "asc" } }, { schedule: { startTime: "asc" } }]
    });
  },

  findNextPublicEvent() {
    return prisma.event.findFirst({
      where: {
        deletedAt: null,
        isPublic: true,
        status: EventStatus.PUBLISHED,
        startDate: { gte: startOfUtcDay() }
      },
      select: upcomingEventSelect,
      orderBy: [{ startDate: "asc" }, { startTime: "asc" }]
    });
  }
};
