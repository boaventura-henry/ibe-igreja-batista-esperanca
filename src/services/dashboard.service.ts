import { announcementRepository, dashboardRepository } from "@/repositories";
import type {
  AdminDashboardContribution,
  AdminDashboardData,
  AdminDashboardEvent,
  AdminDashboardSchedule,
  PortalDashboardData,
  PortalDashboardEvent,
  PortalDashboardNotice,
  PortalDashboardSchedule
} from "@/types";

function decimalToString(value: { toString(): string } | null | undefined) {
  return value?.toString() ?? "0";
}

function serializeEvent(event: {
  id: string;
  title: string;
  startDate: Date;
  startTime: string | null;
  location: string | null;
}): AdminDashboardEvent {
  return {
    id: event.id,
    title: event.title,
    startDate: event.startDate.toISOString(),
    startTime: event.startTime,
    location: event.location
  };
}

function serializeSchedule(schedule: {
  id: string;
  title: string;
  date: Date;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  ministry: { id: string; name: string; color: string };
}): AdminDashboardSchedule {
  return {
    id: schedule.id,
    title: schedule.title,
    date: schedule.date.toISOString(),
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    location: schedule.location,
    ministry: schedule.ministry
  };
}

function serializeContribution(contribution: {
  id: string;
  entryNumber: number;
  amount: { toString(): string };
  launchDate: Date;
  member: { id: string; name: string } | null;
  category: { id: string; name: string };
}): AdminDashboardContribution {
  return {
    id: contribution.id,
    entryNumber: contribution.entryNumber,
    amount: contribution.amount.toString(),
    launchDate: contribution.launchDate.toISOString(),
    member: contribution.member,
    category: contribution.category
  };
}

function serializePortalSchedule(schedule: {
  id: string;
  role: string;
  status: string;
  schedule: {
    id: string;
    title: string;
    date: Date;
    startTime: string | null;
    endTime: string | null;
    location: string | null;
    ministry: { id: string; name: string; color: string };
  };
}): PortalDashboardSchedule {
  return {
    id: schedule.schedule.id,
    scheduleMemberId: schedule.id,
    title: schedule.schedule.title,
    date: schedule.schedule.date.toISOString(),
    startTime: schedule.schedule.startTime,
    endTime: schedule.schedule.endTime,
    location: schedule.schedule.location,
    role: schedule.role,
    status: schedule.status,
    ministry: schedule.schedule.ministry
  };
}

function serializePortalEvent(event: AdminDashboardEvent): PortalDashboardEvent {
  return event;
}

function serializePortalNotice(notice: {
  id: string;
  title: string;
  content: string;
  publishAt: Date | null;
  isPinned: boolean;
  reads: Array<{ readAt: Date }>;
}): PortalDashboardNotice {
  return {
    id: notice.id,
    title: notice.title,
    content: notice.content,
    publishAt: notice.publishAt?.toISOString() ?? null,
    isPinned: notice.isPinned,
    readAt: notice.reads[0]?.readAt.toISOString() ?? null
  };
}

export const dashboardService = {
  async getAdminDashboard(): Promise<AdminDashboardData> {
    const data = await dashboardRepository.getAdminDashboardData();
    const monthlyIncome = Number(decimalToString(data.monthlyIncome));
    const monthlyExpense = Number(decimalToString(data.monthlyExpense));

    return {
      activeMembers: data.activeMembers,
      newMembersThisMonth: data.newMembersThisMonth,
      publishedAnnouncements: data.publishedAnnouncements,
      activeAnnouncements: data.activeAnnouncements,
      pinnedAnnouncements: data.pinnedAnnouncements,
      upcomingEvents: data.upcomingEvents.map(serializeEvent),
      upcomingSchedules: data.upcomingSchedules.map(serializeSchedule),
      monthlyIncome: monthlyIncome.toFixed(2),
      monthlyExpense: monthlyExpense.toFixed(2),
      monthlyBalance: (monthlyIncome - monthlyExpense).toFixed(2),
      latestContributions: data.latestContributions.map(serializeContribution)
    };
  },

  async getPortalDashboard(userId: string, memberId: string | null | undefined): Promise<PortalDashboardData> {
    const nextEvent = await dashboardRepository.findNextPublicEvent();
    const notices = await announcementRepository.listPortalAnnouncements(userId, memberId);

    if (!memberId) {
      return {
        userWithoutMember: true,
        nextSchedule: null,
        nextEvent: nextEvent ? serializePortalEvent(serializeEvent(nextEvent)) : null,
        notices: notices.slice(0, 3).map(serializePortalNotice)
      };
    }

    const nextSchedule = await dashboardRepository.findNextScheduleForMember(memberId);

    return {
      userWithoutMember: false,
      nextSchedule: nextSchedule ? serializePortalSchedule(nextSchedule) : null,
      nextEvent: nextEvent ? serializePortalEvent(serializeEvent(nextEvent)) : null,
      notices: notices.slice(0, 3).map(serializePortalNotice)
    };
  }
};
