export const dashboardWidgetCategories = ["MEMBERS", "MINISTRIES", "EVENTS", "SCALES", "FINANCE", "CONTRIBUTIONS", "ANNOUNCEMENTS", "NOTIFICATIONS", "SYSTEM"] as const;
export type DashboardWidgetCategory = (typeof dashboardWidgetCategories)[number];

export const dashboardWidgetSensitivities = ["PUBLIC", "INTERNAL", "RESTRICTED"] as const;
export type DashboardWidgetSensitivity = (typeof dashboardWidgetSensitivities)[number];

export const dashboardWidgetPriorities = ["LOW", "NORMAL", "HIGH", "CRITICAL"] as const;
export type DashboardWidgetPriority = (typeof dashboardWidgetPriorities)[number];

export const dashboardWidgetSizes = ["SMALL", "MEDIUM", "LARGE", "FULL"] as const;
export type DashboardWidgetSize = (typeof dashboardWidgetSizes)[number];

export const dashboardWidgetDevices = ["MOBILE", "TABLET", "DESKTOP"] as const;
export type DashboardWidgetDevice = (typeof dashboardWidgetDevices)[number];

export const dashboardWidgetBadgeTypes = ["INFO", "SUCCESS", "WARNING", "ERROR", "NEUTRAL"] as const;
export type DashboardWidgetBadgeType = (typeof dashboardWidgetBadgeTypes)[number];

export const dashboardLayoutModes = ["COMPACT", "BALANCED", "EXPANDED"] as const;
export type DashboardLayoutMode = (typeof dashboardLayoutModes)[number];

export const dashboardWidgetIconKeys = ["USERS", "CAKE", "CALENDAR", "MUSIC", "WALLET", "TRENDING_UP", "HAND_COINS", "MEGAPHONE", "BELL", "HEART_PULSE", "SERVER", "SHIELD"] as const;
export type DashboardWidgetIconKey = (typeof dashboardWidgetIconKeys)[number];

export const dashboardWidgetVisualVariants = ["DEFAULT", "INFO", "POSITIVE", "WARNING", "DANGER", "RESTRICTED"] as const;
export type DashboardWidgetVisualVariant = (typeof dashboardWidgetVisualVariants)[number];

export type DashboardWidgetBadge = { label: string; type: DashboardWidgetBadgeType };

export const defaultDashboardLayout = {
  mode: "BALANCED",
  desktopColumns: 3,
  tabletColumns: 2,
  mobileColumns: 1,
  showCategoryHeaders: true,
  allowCategoryCollapse: true
} as const satisfies DashboardLayoutConfiguration;

export type DashboardLayoutConfiguration = {
  mode: DashboardLayoutMode;
  desktopColumns: 1 | 2 | 3 | 4;
  tabletColumns: 1 | 2 | 3;
  mobileColumns: 1 | 2;
  showCategoryHeaders: boolean;
  allowCategoryCollapse: boolean;
};
