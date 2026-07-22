import type { DashboardWidgetCode, DashboardWidgetComponentKey } from "@/config/dashboard-widgets";
import type { DashboardLayoutConfiguration, DashboardWidgetBadge, DashboardWidgetCategory, DashboardWidgetIconKey, DashboardWidgetPriority, DashboardWidgetSensitivity, DashboardWidgetSize, DashboardWidgetVisualVariant } from "@/config/dashboard-widget-enums";
import type { BirthdayDashboardData } from "./birthday.types";

export type AdminDashboardMetric = {
  label: string;
  value: string;
  detail: string;
};

export type AdminDashboardEvent = {
  id: string;
  title: string;
  startDate: string;
  startTime: string | null;
  location: string | null;
};

export type AdminDashboardSchedule = {
  id: string;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  ministry: {
    id: string;
    name: string;
    color: string;
  };
};

export type AdminDashboardContribution = {
  id: string;
  entryNumber: number;
  amount: string;
  launchDate: string;
  member: {
    id: string;
    name: string;
    nickname: string | null;
    displayName: string;
  } | null;
  category: {
    id: string;
    name: string;
  };
};

export type AdminDashboardData = {
  activeMembers: number;
  newMembersThisMonth: number;
  publishedAnnouncements: number;
  activeAnnouncements: number;
  pinnedAnnouncements: number;
  pushNotificationsSentToday: number;
  pushNotificationSuccessRate: number;
  activePushDevices: number;
  expiredPushDevices: number;
  pushFailuresLast24h: number;
  pushRetriesExecuted: number;
  pushRecoveredDevices: number;
  pushFinalSuccessRate: number;
  upcomingEvents: AdminDashboardEvent[];
  upcomingSchedules: AdminDashboardSchedule[];
  monthlyIncome: string;
  monthlyExpense: string;
  monthlyBalance: string;
  latestContributions: AdminDashboardContribution[];
};

type AuthorizedWidgetBase<TCode extends DashboardWidgetCode, TComponent extends DashboardWidgetComponentKey, TData> = {
  code: TCode;
  title: string;
  description: string | null;
  componentKey: TComponent;
  sensitivity: DashboardWidgetSensitivity;
  category: DashboardWidgetCategory;
  priority: DashboardWidgetPriority;
  size: DashboardWidgetSize;
  visibleOnMobile: boolean;
  visibleOnTablet: boolean;
  visibleOnDesktop: boolean;
  iconKey: DashboardWidgetIconKey;
  visualVariant: DashboardWidgetVisualVariant;
  badge: DashboardWidgetBadge | null;
  order: number;
  data: TData;
};

export type AuthorizedDashboardWidget =
  | AuthorizedWidgetBase<"members.birthdays", "MEMBERS_BIRTHDAYS", BirthdayDashboardData>
  | AuthorizedWidgetBase<"members.summary", "MEMBERS_SUMMARY", { activeMembers: number; newMembersThisMonth: number }>
  | AuthorizedWidgetBase<"events.upcoming", "EVENTS_UPCOMING", { events: AdminDashboardEvent[] }>
  | AuthorizedWidgetBase<"scales.upcoming", "SCALES_UPCOMING", { schedules: AdminDashboardSchedule[] }>
  | AuthorizedWidgetBase<"finance.revenue", "FINANCE_REVENUE", { monthlyIncome: string }>
  | AuthorizedWidgetBase<"finance.balance", "FINANCE_BALANCE", { monthlyBalance: string }>
  | AuthorizedWidgetBase<"finance.summary", "FINANCE_SUMMARY", { monthlyIncome: string; monthlyExpense: string; monthlyBalance: string }>
  | AuthorizedWidgetBase<"contributions.recent", "CONTRIBUTIONS_RECENT", { contributions: AdminDashboardContribution[] }>
  | AuthorizedWidgetBase<"announcements.summary", "ANNOUNCEMENTS_SUMMARY", { publishedAnnouncements: number; activeAnnouncements: number; pinnedAnnouncements: number }>
  | AuthorizedWidgetBase<"notifications.health", "NOTIFICATIONS_HEALTH", { pushNotificationsSentToday: number; pushNotificationSuccessRate: number; activePushDevices: number; expiredPushDevices: number; pushFailuresLast24h: number; pushRetriesExecuted: number; pushRecoveredDevices: number; pushFinalSuccessRate: number }>;

export type AdminDashboardResponse = {
  version: string;
  layout: DashboardLayoutConfiguration;
  categories: Array<{
    code: DashboardWidgetCategory;
    title: string;
    description: string;
    iconKey: DashboardWidgetIconKey;
    order: number;
    collapsible: boolean;
    defaultCollapsed: boolean;
    sensitivity: DashboardWidgetSensitivity;
    widgets: AuthorizedDashboardWidget[];
  }>;
  allowedWidgetCodes: DashboardWidgetCode[];
};

export type PortalDashboardSchedule = {
  id: string;
  scheduleMemberId: string;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  role: string;
  status: string;
  ministry: {
    id: string;
    name: string;
    color: string;
  };
};

export type PortalDashboardEvent = {
  id: string;
  title: string;
  startDate: string;
  startTime: string | null;
  location: string | null;
};

export type PortalDashboardNotice = {
  id: string;
  title: string;
  content: string;
  publishAt: string | null;
  isPinned: boolean;
  readAt: string | null;
};

export type PortalDashboardData = {
  userWithoutMember: boolean;
  nextSchedule: PortalDashboardSchedule | null;
  nextEvent: PortalDashboardEvent | null;
  notices: PortalDashboardNotice[];
};
