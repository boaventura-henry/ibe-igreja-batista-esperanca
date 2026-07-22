import type { DashboardLayoutConfiguration, DashboardWidgetSize, DashboardWidgetVisualVariant } from "@/config/dashboard-widget-enums";

const mobileColumns = { 1: "grid-cols-1", 2: "grid-cols-2" } as const;
const tabletColumns = { 1: "md:grid-cols-1", 2: "md:grid-cols-2", 3: "md:grid-cols-3" } as const;
const desktopColumns = { 1: "xl:grid-cols-1", 2: "xl:grid-cols-2", 3: "xl:grid-cols-3", 4: "xl:grid-cols-4" } as const;

export function dashboardGridClass(layout: DashboardLayoutConfiguration) {
  return `grid gap-4 ${mobileColumns[layout.mobileColumns]} ${tabletColumns[layout.tabletColumns]} ${desktopColumns[layout.desktopColumns]}`;
}

export const dashboardWidgetSizeClasses: Record<DashboardWidgetSize, string> = {
  SMALL: "col-span-1",
  MEDIUM: "col-span-1 md:col-span-2",
  LARGE: "col-span-1 md:col-span-2 xl:col-span-3",
  FULL: "col-span-full"
};

export const dashboardWidgetVariantClasses: Record<DashboardWidgetVisualVariant, string> = {
  DEFAULT: "",
  INFO: "rounded-md ring-1 ring-sky-100",
  POSITIVE: "rounded-md ring-1 ring-emerald-100",
  WARNING: "rounded-md ring-1 ring-amber-100",
  DANGER: "rounded-md ring-1 ring-red-200",
  RESTRICTED: "rounded-md ring-1 ring-red-100"
};

export function dashboardDeviceVisibilityClass(mobile: boolean, tablet: boolean, desktop: boolean) {
  const key = `${Number(mobile)}${Number(tablet)}${Number(desktop)}`;
  const classes: Record<string, string> = {
    "111": "",
    "011": "hidden md:block",
    "001": "hidden xl:block",
    "100": "block md:hidden",
    "110": "block xl:hidden",
    "101": "block md:hidden xl:block",
    "010": "hidden md:block xl:hidden",
    "000": "hidden"
  };
  return classes[key] ?? "hidden";
}
