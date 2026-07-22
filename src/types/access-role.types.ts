import type { DashboardWidgetCode } from "@/config/dashboard-widgets";
import type { DashboardLayoutConfiguration, DashboardWidgetIconKey, DashboardWidgetPriority, DashboardWidgetSensitivity, DashboardWidgetSize, DashboardWidgetVisualVariant } from "@/config/dashboard-widget-enums";
import type { PermissionCode } from "@/lib/permissions";

export type AccessRoleDashboardWidgetSetting = {
  code: DashboardWidgetCode;
  isVisible: boolean;
  sortOrder: number | null;
  size: DashboardWidgetSize | null;
  visibleOnMobile: boolean | null;
  visibleOnTablet: boolean | null;
  visibleOnDesktop: boolean | null;
};

export type AccessRoleFormValues = {
  name: string;
  description?: string;
  permissions: PermissionCode[];
  isActive: boolean;
  confirmSystemChange?: boolean;
  dashboardWidgets: AccessRoleDashboardWidgetSetting[];
  dashboardLayout: DashboardLayoutConfiguration;
};

export type AccessRoleSummary = {
  id: string;
  name: string;
  description: string | null;
  permissions: Array<{ id: string; code: string; name: string; label: string; module: string }>;
  isSystem: boolean;
  isActive: boolean;
  usersCount: number;
  membersCount: number;
  updatedAt: string;
  dashboardWidgets: AccessRoleDashboardWidgetSetting[];
  dashboardLayout: DashboardLayoutConfiguration;
};

export type AccessRoleListResult = {
  accessRoles: AccessRoleSummary[];
  availablePermissions: Array<{ id: string; code: string; name: string; label: string; module: string; description: string | null }>;
  availableDashboardWidgets: Array<{
    code: DashboardWidgetCode;
    title: string;
    description: string | null;
    category: string;
    permissionCode: string;
    defaultOrder: number;
    isEnabled: boolean;
    sensitivity: DashboardWidgetSensitivity;
    priority: DashboardWidgetPriority;
    defaultSize: DashboardWidgetSize;
    defaultVisibleOnMobile: boolean;
    defaultVisibleOnTablet: boolean;
    defaultVisibleOnDesktop: boolean;
    iconKey: DashboardWidgetIconKey;
    visualVariant: DashboardWidgetVisualVariant;
  }>;
};
