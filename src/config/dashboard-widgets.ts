import type { PermissionCode } from "@/lib/permissions";
import type { DashboardWidgetBadge, DashboardWidgetCategory, DashboardWidgetIconKey, DashboardWidgetPriority, DashboardWidgetSensitivity, DashboardWidgetSize, DashboardWidgetVisualVariant } from "./dashboard-widget-enums";

export const dashboardWidgetCodes = [
  "members.birthdays",
  "members.summary",
  "events.upcoming",
  "scales.upcoming",
  "finance.revenue",
  "finance.balance",
  "finance.summary",
  "contributions.recent",
  "announcements.summary",
  "notifications.health"
] as const;

export type DashboardWidgetCode = (typeof dashboardWidgetCodes)[number];
export type DashboardWidgetComponentKey = "MEMBERS_BIRTHDAYS" | "MEMBERS_SUMMARY" | "EVENTS_UPCOMING" | "SCALES_UPCOMING" | "FINANCE_REVENUE" | "FINANCE_BALANCE" | "FINANCE_SUMMARY" | "CONTRIBUTIONS_RECENT" | "ANNOUNCEMENTS_SUMMARY" | "NOTIFICATIONS_HEALTH";

export type DashboardWidgetDefinition = {
  code: DashboardWidgetCode;
  title: string;
  description: string;
  category: DashboardWidgetCategory;
  permissionCode: PermissionCode;
  defaultOrder: number;
  componentKey: DashboardWidgetComponentKey;
  sensitivity: DashboardWidgetSensitivity;
  priority: DashboardWidgetPriority;
  defaultSize: DashboardWidgetSize;
  defaultVisibleOnMobile: boolean;
  defaultVisibleOnTablet: boolean;
  defaultVisibleOnDesktop: boolean;
  iconKey: DashboardWidgetIconKey;
  visualVariant: DashboardWidgetVisualVariant;
  badge?: DashboardWidgetBadge;
  enabled: boolean;
};

export const dashboardWidgets = [
  { code: "members.birthdays", title: "Aniversariantes", description: "Aniversariantes do dia, da semana e do mes.", category: "MEMBERS", permissionCode: "dashboard.members.birthdays", defaultOrder: 10, componentKey: "MEMBERS_BIRTHDAYS", sensitivity: "INTERNAL", priority: "HIGH", defaultSize: "FULL", defaultVisibleOnMobile: true, defaultVisibleOnTablet: true, defaultVisibleOnDesktop: true, iconKey: "CAKE", visualVariant: "INFO", enabled: true },
  { code: "members.summary", title: "Resumo de membros", description: "Membros ativos e novos membros no mes.", category: "MEMBERS", permissionCode: "dashboard.members.summary", defaultOrder: 20, componentKey: "MEMBERS_SUMMARY", sensitivity: "INTERNAL", priority: "NORMAL", defaultSize: "MEDIUM", defaultVisibleOnMobile: true, defaultVisibleOnTablet: true, defaultVisibleOnDesktop: true, iconKey: "USERS", visualVariant: "DEFAULT", enabled: true },
  { code: "finance.revenue", title: "Receitas do mes", description: "Total de entradas confirmadas no mes.", category: "FINANCE", permissionCode: "dashboard.finance.revenue", defaultOrder: 30, componentKey: "FINANCE_REVENUE", sensitivity: "RESTRICTED", priority: "HIGH", defaultSize: "SMALL", defaultVisibleOnMobile: false, defaultVisibleOnTablet: true, defaultVisibleOnDesktop: true, iconKey: "TRENDING_UP", visualVariant: "POSITIVE", badge: { label: "Restrito", type: "NEUTRAL" }, enabled: true },
  { code: "finance.balance", title: "Saldo do mes", description: "Saldo financeiro consolidado do mes.", category: "FINANCE", permissionCode: "dashboard.finance.balance", defaultOrder: 40, componentKey: "FINANCE_BALANCE", sensitivity: "RESTRICTED", priority: "HIGH", defaultSize: "SMALL", defaultVisibleOnMobile: false, defaultVisibleOnTablet: true, defaultVisibleOnDesktop: true, iconKey: "WALLET", visualVariant: "RESTRICTED", badge: { label: "Restrito", type: "NEUTRAL" }, enabled: true },
  { code: "announcements.summary", title: "Resumo de comunicados", description: "Indicadores dos comunicados publicados no portal.", category: "ANNOUNCEMENTS", permissionCode: "dashboard.announcements.summary", defaultOrder: 50, componentKey: "ANNOUNCEMENTS_SUMMARY", sensitivity: "INTERNAL", priority: "NORMAL", defaultSize: "MEDIUM", defaultVisibleOnMobile: true, defaultVisibleOnTablet: true, defaultVisibleOnDesktop: true, iconKey: "MEGAPHONE", visualVariant: "INFO", enabled: true },
  { code: "notifications.health", title: "Saude das notificacoes", description: "Metricas de envio, falha e recuperacao de notificacoes push.", category: "NOTIFICATIONS", permissionCode: "dashboard.notifications.health", defaultOrder: 60, componentKey: "NOTIFICATIONS_HEALTH", sensitivity: "RESTRICTED", priority: "HIGH", defaultSize: "FULL", defaultVisibleOnMobile: false, defaultVisibleOnTablet: true, defaultVisibleOnDesktop: true, iconKey: "HEART_PULSE", visualVariant: "WARNING", badge: { label: "Restrito", type: "NEUTRAL" }, enabled: true },
  { code: "events.upcoming", title: "Proximos eventos", description: "Lista dos proximos eventos publicados.", category: "EVENTS", permissionCode: "dashboard.events.upcoming", defaultOrder: 70, componentKey: "EVENTS_UPCOMING", sensitivity: "INTERNAL", priority: "HIGH", defaultSize: "MEDIUM", defaultVisibleOnMobile: true, defaultVisibleOnTablet: true, defaultVisibleOnDesktop: true, iconKey: "CALENDAR", visualVariant: "DEFAULT", enabled: true },
  { code: "scales.upcoming", title: "Proximas escalas", description: "Lista das proximas escalas ministeriais.", category: "SCALES", permissionCode: "dashboard.scales.upcoming", defaultOrder: 80, componentKey: "SCALES_UPCOMING", sensitivity: "INTERNAL", priority: "HIGH", defaultSize: "MEDIUM", defaultVisibleOnMobile: true, defaultVisibleOnTablet: true, defaultVisibleOnDesktop: true, iconKey: "MUSIC", visualVariant: "DEFAULT", enabled: true },
  { code: "finance.summary", title: "Resumo financeiro do mes", description: "Receitas, despesas e saldo financeiro do mes.", category: "FINANCE", permissionCode: "dashboard.finance.summary", defaultOrder: 90, componentKey: "FINANCE_SUMMARY", sensitivity: "RESTRICTED", priority: "NORMAL", defaultSize: "MEDIUM", defaultVisibleOnMobile: false, defaultVisibleOnTablet: true, defaultVisibleOnDesktop: true, iconKey: "WALLET", visualVariant: "RESTRICTED", badge: { label: "Restrito", type: "NEUTRAL" }, enabled: true },
  { code: "contributions.recent", title: "Ultimas contribuicoes", description: "Entradas recentes confirmadas e seus contribuintes.", category: "CONTRIBUTIONS", permissionCode: "dashboard.contributions.recent", defaultOrder: 100, componentKey: "CONTRIBUTIONS_RECENT", sensitivity: "RESTRICTED", priority: "NORMAL", defaultSize: "MEDIUM", defaultVisibleOnMobile: false, defaultVisibleOnTablet: true, defaultVisibleOnDesktop: true, iconKey: "HAND_COINS", visualVariant: "RESTRICTED", badge: { label: "Restrito", type: "NEUTRAL" }, enabled: true }
] as const satisfies readonly DashboardWidgetDefinition[];

const codes = new Set(dashboardWidgets.map((widget) => widget.code));
const orders = new Set(dashboardWidgets.map((widget) => widget.defaultOrder));
if (codes.size !== dashboardWidgets.length || orders.size !== dashboardWidgets.length) {
  throw new Error("O catalogo de widgets do dashboard possui codigos ou ordens duplicados.");
}

export const dashboardWidgetByCode = new Map<DashboardWidgetCode, DashboardWidgetDefinition>(dashboardWidgets.map((widget) => [widget.code, widget]));

export function isDashboardWidgetCode(value: string): value is DashboardWidgetCode {
  return codes.has(value as DashboardWidgetCode);
}
