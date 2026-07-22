import { dashboardWidgetByCode, isDashboardWidgetCode, type DashboardWidgetCode } from "@/config/dashboard-widgets";
import { dashboardWidgetCategoryByCode } from "@/config/dashboard-widget-categories";
import { defaultDashboardLayout, type DashboardLayoutConfiguration, type DashboardWidgetPriority } from "@/config/dashboard-widget-enums";
import { APP_VERSION } from "@/lib/app-version";
import { announcementRepository, dashboardRepository, pushNotificationLogRepository } from "@/repositories";
import { birthdayService } from "@/services/birthday.service";
import type {
  AdminDashboardContribution,
  AdminDashboardEvent,
  AdminDashboardResponse,
  AdminDashboardSchedule,
  AuthorizedDashboardWidget,
  PortalDashboardData,
  PortalDashboardEvent,
  PortalDashboardNotice,
  PortalDashboardSchedule
} from "@/types";
import { getMemberDisplayName } from "@/utils";

type WidgetConfigurationRecord = Awaited<ReturnType<typeof dashboardRepository.listWidgetConfiguration>>[number];
type LayoutRecord = Awaited<ReturnType<typeof dashboardRepository.findRoleDashboardLayout>>;

const priorityOrder: Record<DashboardWidgetPriority, number> = { CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 };

export function getDashboardQueryPlan(codes: ReadonlySet<DashboardWidgetCode>) {
  const needsFinanceSummary = codes.has("finance.balance") || codes.has("finance.summary");
  return {
    members: codes.has("members.summary"),
    birthdays: codes.has("members.birthdays"),
    events: codes.has("events.upcoming"),
    schedules: codes.has("scales.upcoming"),
    financeSummary: needsFinanceSummary,
    incomeOnly: codes.has("finance.revenue") && !needsFinanceSummary,
    contributions: codes.has("contributions.recent"),
    announcements: codes.has("announcements.summary"),
    notifications: codes.has("notifications.health")
  };
}

export function groupAuthorizedDashboardWidgets(widgets: AuthorizedDashboardWidget[]): AdminDashboardResponse["categories"] {
  return [...new Set(widgets.map((widget) => widget.category))]
    .flatMap((code) => {
      const category = dashboardWidgetCategoryByCode.get(code);
      if (!category) return [];
      return [{ ...category, widgets: widgets.filter((widget) => widget.category === code) }];
    })
    .sort((left, right) => left.defaultOrder - right.defaultOrder)
    .map(({ defaultOrder, ...category }) => ({ ...category, order: defaultOrder }));
}

export function resolveDashboardLayout(layout: LayoutRecord): DashboardLayoutConfiguration {
  if (!layout) return { ...defaultDashboardLayout };
  return {
    mode: layout.layoutMode,
    desktopColumns: ([1, 2, 3, 4].includes(layout.desktopColumns) ? layout.desktopColumns : 3) as 1 | 2 | 3 | 4,
    tabletColumns: ([1, 2, 3].includes(layout.tabletColumns) ? layout.tabletColumns : 2) as 1 | 2 | 3,
    mobileColumns: ([1, 2].includes(layout.mobileColumns) ? layout.mobileColumns : 1) as 1 | 2,
    showCategoryHeaders: layout.showCategoryHeaders,
    allowCategoryCollapse: layout.allowCategoryCollapse
  };
}

function decimalToString(value: { toString(): string } | null | undefined) {
  return value?.toString() ?? "0";
}

function serializeEvent(event: { id: string; title: string; startDate: Date; startTime: string | null; location: string | null }): AdminDashboardEvent {
  return { ...event, startDate: event.startDate.toISOString() };
}

function serializeSchedule(schedule: { id: string; title: string; date: Date; startTime: string | null; endTime: string | null; location: string | null; ministry: { id: string; name: string; color: string } }): AdminDashboardSchedule {
  return { ...schedule, date: schedule.date.toISOString() };
}

function serializeContribution(contribution: { id: string; entryNumber: number; amount: { toString(): string }; launchDate: Date; member: { id: string; name: string; nickname: string | null } | null; category: { id: string; name: string } }): AdminDashboardContribution {
  return {
    ...contribution,
    amount: contribution.amount.toString(),
    launchDate: contribution.launchDate.toISOString(),
    member: contribution.member ? { ...contribution.member, displayName: getMemberDisplayName(contribution.member) } : null
  };
}

export function resolveAuthorizedWidgetConfigurations(configurations: WidgetConfigurationRecord[], permissionCodes: readonly string[]) {
  const permissions = new Set(permissionCodes);

  return configurations
    .filter((configuration) => {
      if (!isDashboardWidgetCode(configuration.code) || !configuration.permission.isActive) return false;
      const definition = dashboardWidgetByCode.get(configuration.code);
      const roleConfiguration = configuration.accessRoles[0];
      return Boolean(definition?.enabled && permissions.has(configuration.permission.code) && roleConfiguration?.isVisible !== false);
    })
    .map((configuration) => {
      const roleConfiguration = configuration.accessRoles[0];
      const definition = dashboardWidgetByCode.get(configuration.code as DashboardWidgetCode)!;
      return {
        configuration,
        definition,
        order: roleConfiguration?.sortOrder ?? configuration.defaultOrder,
        size: roleConfiguration?.size ?? configuration.defaultSize,
        visibleOnMobile: roleConfiguration?.visibleOnMobile ?? configuration.defaultVisibleOnMobile,
        visibleOnTablet: roleConfiguration?.visibleOnTablet ?? configuration.defaultVisibleOnTablet,
        visibleOnDesktop: roleConfiguration?.visibleOnDesktop ?? configuration.defaultVisibleOnDesktop
      };
    })
    .sort((left, right) => left.order - right.order || priorityOrder[left.configuration.priority] - priorityOrder[right.configuration.priority] || left.configuration.code.localeCompare(right.configuration.code));
}

function serializePortalSchedule(schedule: { id: string; role: string; status: string; schedule: { id: string; title: string; date: Date; startTime: string | null; endTime: string | null; location: string | null; ministry: { id: string; name: string; color: string } } }): PortalDashboardSchedule {
  return { id: schedule.schedule.id, scheduleMemberId: schedule.id, title: schedule.schedule.title, date: schedule.schedule.date.toISOString(), startTime: schedule.schedule.startTime, endTime: schedule.schedule.endTime, location: schedule.schedule.location, role: schedule.role, status: schedule.status, ministry: schedule.schedule.ministry };
}

function serializePortalEvent(event: AdminDashboardEvent): PortalDashboardEvent { return event; }

function serializePortalNotice(notice: { id: string; title: string; content: string; publishAt: Date | null; isPinned: boolean; reads: Array<{ readAt: Date }> }): PortalDashboardNotice {
  return { id: notice.id, title: notice.title, content: notice.content, publishAt: notice.publishAt?.toISOString() ?? null, isPinned: notice.isPinned, readAt: notice.reads[0]?.readAt.toISOString() ?? null };
}

export const dashboardService = {
  async getAdminDashboardForUser(input: { permissionCodes: readonly string[]; accessRoleId?: string | null }): Promise<AdminDashboardResponse> {
    const [configurations, storedLayout] = await Promise.all([
      dashboardRepository.listWidgetConfiguration(input.accessRoleId),
      dashboardRepository.findRoleDashboardLayout(input.accessRoleId)
    ]);
    const layout = resolveDashboardLayout(storedLayout);
    const authorized = resolveAuthorizedWidgetConfigurations(configurations, input.permissionCodes);
    const codes = new Set(authorized.map((item) => item.definition.code));
    const queryPlan = getDashboardQueryPlan(codes);

    const members = queryPlan.members ? dashboardRepository.getMembersSummary() : null;
    const birthdays = queryPlan.birthdays ? birthdayService.getDashboard() : null;
    const events = queryPlan.events ? dashboardRepository.getUpcomingEvents() : null;
    const schedules = queryPlan.schedules ? dashboardRepository.getUpcomingSchedules() : null;
    const financeSummary = queryPlan.financeSummary ? dashboardRepository.getMonthlyFinanceSummary() : null;
    const incomeOnly = queryPlan.incomeOnly ? dashboardRepository.getMonthlyIncome() : null;
    const contributions = queryPlan.contributions ? dashboardRepository.getLatestContributions() : null;
    const announcements = queryPlan.announcements ? dashboardRepository.getAnnouncementSummary() : null;
    const notifications = queryPlan.notifications ? pushNotificationLogRepository.getDashboardMetrics() : null;
    const widgets: AuthorizedDashboardWidget[] = [];

    for (const item of authorized) {
      const base = { code: item.definition.code, title: item.configuration.title, description: item.configuration.description, componentKey: item.definition.componentKey, sensitivity: item.configuration.sensitivity, category: item.configuration.category, priority: item.configuration.priority, size: item.size, visibleOnMobile: item.visibleOnMobile, visibleOnTablet: item.visibleOnTablet, visibleOnDesktop: item.visibleOnDesktop, iconKey: item.definition.iconKey, visualVariant: item.definition.visualVariant, badge: item.definition.badge ?? null, order: item.order };
      switch (item.definition.code) {
        case "members.birthdays":
          widgets.push({ ...base, code: "members.birthdays", componentKey: "MEMBERS_BIRTHDAYS", data: await birthdays! });
          break;
        case "members.summary":
          widgets.push({ ...base, code: "members.summary", componentKey: "MEMBERS_SUMMARY", data: await members! });
          break;
        case "events.upcoming":
          widgets.push({ ...base, code: "events.upcoming", componentKey: "EVENTS_UPCOMING", data: { events: (await events!).map(serializeEvent) } });
          break;
        case "scales.upcoming":
          widgets.push({ ...base, code: "scales.upcoming", componentKey: "SCALES_UPCOMING", data: { schedules: (await schedules!).map(serializeSchedule) } });
          break;
        case "finance.revenue": {
          const monthlyIncome = financeSummary ? (await financeSummary).monthlyIncome : (await incomeOnly!)._sum.amount;
          widgets.push({ ...base, code: "finance.revenue", componentKey: "FINANCE_REVENUE", data: { monthlyIncome: decimalToString(monthlyIncome) } });
          break;
        }
        case "finance.balance":
        case "finance.summary": {
          const data = await financeSummary!;
          const income = Number(decimalToString(data.monthlyIncome));
          const expense = Number(decimalToString(data.monthlyExpense));
          const financialData = { monthlyIncome: income.toFixed(2), monthlyExpense: expense.toFixed(2), monthlyBalance: (income - expense).toFixed(2) };
          if (item.definition.code === "finance.balance") widgets.push({ ...base, code: "finance.balance", componentKey: "FINANCE_BALANCE", data: { monthlyBalance: financialData.monthlyBalance } });
          else widgets.push({ ...base, code: "finance.summary", componentKey: "FINANCE_SUMMARY", data: financialData });
          break;
        }
        case "contributions.recent":
          widgets.push({ ...base, code: "contributions.recent", componentKey: "CONTRIBUTIONS_RECENT", data: { contributions: (await contributions!).map(serializeContribution) } });
          break;
        case "announcements.summary":
          widgets.push({ ...base, code: "announcements.summary", componentKey: "ANNOUNCEMENTS_SUMMARY", data: await announcements! });
          break;
        case "notifications.health": {
          const data = await notifications!;
          widgets.push({ ...base, code: "notifications.health", componentKey: "NOTIFICATIONS_HEALTH", data: { pushNotificationsSentToday: data.sentToday, pushNotificationSuccessRate: data.successRate, activePushDevices: data.activeDevices, expiredPushDevices: data.expiredDevices, pushFailuresLast24h: data.failuresLast24h, pushRetriesExecuted: data.retriesExecuted, pushRecoveredDevices: data.recoveredDevices, pushFinalSuccessRate: data.successRate } });
          break;
        }
      }
    }

    const categories = groupAuthorizedDashboardWidgets(widgets);

    return { version: APP_VERSION, layout, categories, allowedWidgetCodes: widgets.map((widget) => widget.code) };
  },

  async getPortalDashboard(userId: string, memberId: string | null | undefined): Promise<PortalDashboardData> {
    const nextEvent = await dashboardRepository.findNextPublicEvent();
    const notices = await announcementRepository.listPortalAnnouncements(userId, memberId);
    if (!memberId) return { userWithoutMember: true, nextSchedule: null, nextEvent: nextEvent ? serializePortalEvent(serializeEvent(nextEvent)) : null, notices: notices.slice(0, 3).map(serializePortalNotice) };
    const nextSchedule = await dashboardRepository.findNextScheduleForMember(memberId);
    return { userWithoutMember: false, nextSchedule: nextSchedule ? serializePortalSchedule(nextSchedule) : null, nextEvent: nextEvent ? serializePortalEvent(serializeEvent(nextEvent)) : null, notices: notices.slice(0, 3).map(serializePortalNotice) };
  }
};
