import {
  AnnouncementStatus,
  EventStatus,
  FinancialEntryStatus,
  FinancialEntryType,
  MemberStatus,
  Prisma,
  ScheduleStatus,
} from "@prisma/client";
import { prisma } from "@/prisma/client";
import { applicationDateOnlyCutoff, applicationDayStart, applicationToday } from "@/lib/application-time";
import { buildScheduleScopeWhere } from "@/repositories/schedule-access.repository";
import type { ScheduleAccessContext } from "@/types";
import type { FinancialAccessContext } from "@/types";
import { buildFinancialScopeWhere } from "@/repositories/financial-entry.repository";

const upcomingEventSelect = { id: true, title: true, startDate: true, startTime: true, location: true } satisfies Prisma.EventSelect;
const upcomingScheduleSelect = {
  id: true, title: true, date: true, startTime: true, endTime: true, location: true,
  ministry: { select: { id: true, name: true, color: true } }
} satisfies Prisma.ScheduleSelect;
const latestContributionSelect = {
  id: true, entryNumber: true, amount: true, launchDate: true,
  member: { select: { id: true, name: true, nickname: true } },
  category: { select: { id: true, name: true } }
} satisfies Prisma.FinancialEntrySelect;
const portalScheduleSelect = {
  id: true, status: true,
  roles: { select: { role: true } },
  instrumentAssignments: { where: { endedAt: null }, select: { instrumentCategory: { select: { id: true, name: true } } }, take: 1 },
  schedule: {
    select: {
      id: true, title: true, date: true, startTime: true, endTime: true, location: true,
      ministry: { select: { id: true, name: true, color: true } }
    }
  }
} satisfies Prisma.ScheduleMemberSelect;

export type AdminDashboardEventRecord = Prisma.EventGetPayload<{ select: typeof upcomingEventSelect }>;
export type AdminDashboardScheduleRecord = Prisma.ScheduleGetPayload<{ select: typeof upcomingScheduleSelect }>;
export type AdminDashboardContributionRecord = Prisma.FinancialEntryGetPayload<{ select: typeof latestContributionSelect }>;
export type PortalDashboardScheduleRecord = Prisma.ScheduleMemberGetPayload<{ select: typeof portalScheduleSelect }>;

export function buildUpcomingSchedulesWhere(
  accessContext: ScheduleAccessContext
): Prisma.ScheduleWhereInput {
  return {
    AND: [
      {
        deletedAt: null,
        status: { notIn: [ScheduleStatus.CANCELED, ScheduleStatus.COMPLETED] },
        date: { gte: startOfUtcDay() }
      },
      buildScheduleScopeWhere(accessContext)
    ]
  };
}

function startOfUtcDay(value = new Date()) {
  return applicationDateOnlyCutoff(value);
}

function currentMonthRange(value = new Date()) {
  return {
    start: new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1)),
    end: new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 1))
  };
}

export function currentFinancialMonthRange(value = new Date()) {
  const today = applicationToday(value);
  return {
    start: new Date(Date.UTC(today.year, today.month - 1, 1)),
    end: new Date(Date.UTC(today.year, today.month, 1))
  };
}

export const dashboardRepository = {
  listWidgetConfiguration(accessRoleId: string | null | undefined) {
    return prisma.dashboardWidget.findMany({
      where: { isEnabled: true },
      select: {
        code: true,
        title: true,
        description: true,
        defaultOrder: true,
        category: true,
        sensitivity: true,
        priority: true,
        defaultSize: true,
        defaultVisibleOnMobile: true,
        defaultVisibleOnTablet: true,
        defaultVisibleOnDesktop: true,
        iconKey: true,
        visualVariant: true,
        permission: { select: { code: true, isActive: true } },
        accessRoles: {
          where: { accessRoleId: accessRoleId ?? "__no_access_role__" },
          select: { isVisible: true, sortOrder: true, size: true, visibleOnMobile: true, visibleOnTablet: true, visibleOnDesktop: true },
          take: 1
        }
      },
      orderBy: { defaultOrder: "asc" }
    });
  },

  findRoleDashboardLayout(accessRoleId: string | null | undefined) {
    if (!accessRoleId) return null;
    return prisma.accessRoleDashboardLayout.findUnique({
      where: { accessRoleId },
      select: { layoutMode: true, desktopColumns: true, tabletColumns: true, mobileColumns: true, showCategoryHeaders: true, allowCategoryCollapse: true }
    });
  },

  async getMembersSummary() {
    const month = currentMonthRange();
    const [activeMembers, newMembersThisMonth] = await prisma.$transaction([
      prisma.member.count({ where: { deletedAt: null, status: MemberStatus.ACTIVE } }),
      prisma.member.count({ where: { deletedAt: null, createdAt: { gte: month.start, lt: month.end } } })
    ]);
    return { activeMembers, newMembersThisMonth };
  },

  getUpcomingEvents() {
    return prisma.event.findMany({
      where: { deletedAt: null, status: EventStatus.PUBLISHED, startDate: { gte: startOfUtcDay() } },
      select: upcomingEventSelect,
      orderBy: [{ startDate: "asc" }, { startTime: "asc" }],
      take: 5
    });
  },

  getUpcomingSchedules(accessContext: ScheduleAccessContext) {
    return prisma.schedule.findMany({
      where: buildUpcomingSchedulesWhere(accessContext),
      select: upcomingScheduleSelect,
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: 5
    });
  },

  getMonthlyIncome(accessContext: FinancialAccessContext) {
    const month = currentFinancialMonthRange();
    return prisma.financialEntry.aggregate({
      where: { AND: [{
        deletedAt: null,
        status: FinancialEntryStatus.CONFIRMED,
        type: FinancialEntryType.INCOME,
        launchDate: { gte: month.start, lt: month.end }
      }, buildFinancialScopeWhere(accessContext)] },
      _sum: { amount: true }
    });
  },

  async getMonthlyFinanceSummary(accessContext: FinancialAccessContext) {
    const month = currentFinancialMonthRange();
    const where: Prisma.FinancialEntryWhereInput = { AND: [{ deletedAt: null, status: FinancialEntryStatus.CONFIRMED, launchDate: { gte: month.start, lt: month.end } }, buildFinancialScopeWhere(accessContext)] };
    const [income, expense] = await prisma.$transaction([
      prisma.financialEntry.aggregate({ where: { ...where, type: FinancialEntryType.INCOME }, _sum: { amount: true } }),
      prisma.financialEntry.aggregate({ where: { ...where, type: FinancialEntryType.EXPENSE }, _sum: { amount: true } })
    ]);
    return { monthlyIncome: income._sum.amount, monthlyExpense: expense._sum.amount };
  },

  async getTotalFinanceBalance(accessContext: FinancialAccessContext) {
    const base: Prisma.FinancialEntryWhereInput = { AND: [{ deletedAt: null, status: FinancialEntryStatus.CONFIRMED, launchDate: { lte: applicationDateOnlyCutoff() } }, buildFinancialScopeWhere(accessContext)] };
    const [income, expense] = await prisma.$transaction([
      prisma.financialEntry.aggregate({ where: { AND: [base, { type: FinancialEntryType.INCOME }] }, _sum: { amount: true } }),
      prisma.financialEntry.aggregate({ where: { AND: [base, { type: FinancialEntryType.EXPENSE }] }, _sum: { amount: true } })
    ]);
    return { income: income._sum.amount, expense: expense._sum.amount };
  },

  async getMinistryFinanceBalances(accessContext: FinancialAccessContext) {
    const rows = await prisma.financialEntry.groupBy({
      by: ["ministryId", "type"],
      where: { AND: [{ deletedAt: null, status: FinancialEntryStatus.CONFIRMED, launchDate: { lte: applicationDateOnlyCutoff() }, ministryId: { not: null } }, buildFinancialScopeWhere(accessContext)] },
      _sum: { amount: true }
    });
    const ministries = await prisma.ministry.findMany({
      where: { deletedAt: null, ...(accessContext.allMinistries ? {} : { id: { in: [...accessContext.authorizedMinistryIds] } }) },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    });
    const values = new Map<string, Prisma.Decimal>();
    for (const row of rows) {
      if (!row.ministryId) continue;
      const amount = row._sum.amount ?? new Prisma.Decimal(0);
      const current = values.get(row.ministryId) ?? new Prisma.Decimal(0);
      values.set(row.ministryId, row.type === FinancialEntryType.INCOME ? current.plus(amount) : current.minus(amount));
    }
    return ministries.map((ministry) => ({ ministryId: ministry.id, ministryName: ministry.name, balance: (values.get(ministry.id) ?? new Prisma.Decimal(0)).toFixed(2) }));
  },

  getLatestContributions() {
    return prisma.financialEntry.findMany({
      where: { deletedAt: null, type: FinancialEntryType.INCOME, status: FinancialEntryStatus.CONFIRMED },
      select: latestContributionSelect,
      orderBy: [{ launchDate: "desc" }, { createdAt: "desc" }],
      take: 5
    });
  },

  async getAnnouncementSummary() {
    const now = new Date();
    const published = { deletedAt: null, status: AnnouncementStatus.PUBLISHED };
    const active = { ...published, OR: [{ publishAt: null }, { publishAt: { lte: now } }], AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gte: applicationDayStart(now) } }] }] };
    const [publishedAnnouncements, activeAnnouncements, pinnedAnnouncements] = await prisma.$transaction([
      prisma.announcement.count({ where: published }),
      prisma.announcement.count({ where: active }),
      prisma.announcement.count({ where: { ...active, isPinned: true } })
    ]);
    return { publishedAnnouncements, activeAnnouncements, pinnedAnnouncements };
  },

  findNextScheduleForMember(memberId: string) {
    return prisma.scheduleMember.findFirst({
      where: { memberId, deletedAt: null, schedule: { deletedAt: null, status: { notIn: [ScheduleStatus.CANCELED, ScheduleStatus.COMPLETED] }, date: { gte: startOfUtcDay() } } },
      select: portalScheduleSelect,
      orderBy: [{ schedule: { date: "asc" } }, { schedule: { startTime: "asc" } }]
    });
  },

  findNextPublicEvent() {
    return prisma.event.findFirst({
      where: { deletedAt: null, isPublic: true, status: EventStatus.PUBLISHED, startDate: { gte: startOfUtcDay() } },
      select: upcomingEventSelect,
      orderBy: [{ startDate: "asc" }, { startTime: "asc" }]
    });
  }
};
