import type { DashboardWidgetCategory, DashboardWidgetIconKey, DashboardWidgetSensitivity } from "./dashboard-widget-enums";

export type DashboardWidgetCategoryDefinition = {
  code: DashboardWidgetCategory;
  title: string;
  description: string;
  iconKey: DashboardWidgetIconKey;
  defaultOrder: number;
  collapsible: boolean;
  defaultCollapsed: boolean;
  sensitivity: DashboardWidgetSensitivity;
};

export const dashboardWidgetCategoryCatalog = [
  { code: "MEMBERS", title: "Pessoas", description: "Indicadores e datas importantes dos membros.", iconKey: "USERS", defaultOrder: 10, collapsible: true, defaultCollapsed: false, sensitivity: "INTERNAL" },
  { code: "MINISTRIES", title: "Ministerios", description: "Indicadores dos ministerios.", iconKey: "MUSIC", defaultOrder: 15, collapsible: true, defaultCollapsed: false, sensitivity: "INTERNAL" },
  { code: "EVENTS", title: "Agenda", description: "Eventos e compromissos futuros.", iconKey: "CALENDAR", defaultOrder: 20, collapsible: true, defaultCollapsed: false, sensitivity: "INTERNAL" },
  { code: "SCALES", title: "Escalas", description: "Organizacao das proximas escalas.", iconKey: "MUSIC", defaultOrder: 30, collapsible: true, defaultCollapsed: false, sensitivity: "INTERNAL" },
  { code: "FINANCE", title: "Financeiro", description: "Indicadores financeiros restritos.", iconKey: "WALLET", defaultOrder: 50, collapsible: true, defaultCollapsed: false, sensitivity: "RESTRICTED" },
  { code: "CONTRIBUTIONS", title: "Contribuicoes", description: "Informacoes restritas sobre contribuicoes.", iconKey: "HAND_COINS", defaultOrder: 60, collapsible: true, defaultCollapsed: false, sensitivity: "RESTRICTED" },
  { code: "ANNOUNCEMENTS", title: "Comunicacao", description: "Indicadores de comunicados publicados.", iconKey: "MEGAPHONE", defaultOrder: 70, collapsible: true, defaultCollapsed: false, sensitivity: "INTERNAL" },
  { code: "NOTIFICATIONS", title: "Notificacoes", description: "Saude operacional das notificacoes.", iconKey: "HEART_PULSE", defaultOrder: 80, collapsible: true, defaultCollapsed: false, sensitivity: "RESTRICTED" },
  { code: "SYSTEM", title: "Sistema", description: "Indicadores tecnicos do sistema.", iconKey: "SERVER", defaultOrder: 90, collapsible: true, defaultCollapsed: false, sensitivity: "RESTRICTED" }
] as const satisfies readonly DashboardWidgetCategoryDefinition[];

export const dashboardWidgetCategoryByCode = new Map(dashboardWidgetCategoryCatalog.map((category) => [category.code, category]));
