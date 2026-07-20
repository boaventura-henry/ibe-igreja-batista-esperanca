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
