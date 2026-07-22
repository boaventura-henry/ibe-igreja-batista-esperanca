import assert from "node:assert/strict";
import packageJson from "../package.json";
import { appFeatures } from "../src/config/app-features";
import { appReleases } from "../src/config/app-releases";
import { dashboardWidgetCategoryByCode } from "../src/config/dashboard-widget-categories";
import { dashboardWidgetIconKeys, defaultDashboardLayout } from "../src/config/dashboard-widget-enums";
import { dashboardWidgets, type DashboardWidgetCode } from "../src/config/dashboard-widgets";
import { dashboardWidgetSizeClasses } from "../src/components/dashboard/widgets/dashboard-layout";
import { APP_VERSION, getAppVersionInfo, shortCommitHash } from "../src/lib/app-version";
import {
  getDashboardQueryPlan,
  groupAuthorizedDashboardWidgets,
  resolveAuthorizedWidgetConfigurations,
  resolveDashboardLayout
} from "../src/services/dashboard.service";
import { accessRoleCreateSchema } from "../src/validators/access-role.validator";

type Configurations = Parameters<typeof resolveAuthorizedWidgetConfigurations>[0];
type RoleOverride = Configurations[number]["accessRoles"][number];

function configurations(options?: { hidden?: DashboardWidgetCode[]; disabled?: DashboardWidgetCode[] }) {
  return dashboardWidgets
    .filter((widget) => !(options?.disabled ?? []).includes(widget.code))
    .map((widget) => ({
      code: widget.code,
      title: widget.title,
      description: widget.description,
      category: widget.category,
      sensitivity: widget.sensitivity,
      priority: widget.priority,
      defaultSize: widget.defaultSize,
      defaultVisibleOnMobile: widget.defaultVisibleOnMobile,
      defaultVisibleOnTablet: widget.defaultVisibleOnTablet,
      defaultVisibleOnDesktop: widget.defaultVisibleOnDesktop,
      iconKey: widget.iconKey,
      visualVariant: widget.visualVariant,
      defaultOrder: widget.defaultOrder,
      permission: { code: widget.permissionCode, isActive: true },
      accessRoles: (options?.hidden ?? []).includes(widget.code)
        ? [{ isVisible: false, sortOrder: null, size: null, visibleOnMobile: null, visibleOnTablet: null, visibleOnDesktop: null }]
        : []
    })) as Configurations;
}

function withOverride(source: Configurations, code: DashboardWidgetCode, override: Partial<RoleOverride>) {
  return source.map((item) => item.code === code
    ? { ...item, accessRoles: [{ isVisible: true, sortOrder: null, size: null, visibleOnMobile: null, visibleOnTablet: null, visibleOnDesktop: null, ...override }] }
    : item) as Configurations;
}

function resolved(permissionCodes: string[], source = configurations()) {
  return resolveAuthorizedWidgetConfigurations(source, permissionCodes);
}

function resolvedCodes(permissionCodes: string[], source = configurations()) {
  return resolved(permissionCodes, source).map((item) => item.definition.code);
}

const allPermissions = dashboardWidgets.map((widget) => widget.permissionCode);
const financeCodes = dashboardWidgets.filter((widget) => widget.sensitivity === "RESTRICTED").map((widget) => widget.code);
const louvorPermissions = ["dashboard.members.birthdays", "dashboard.members.summary", "dashboard.events.upcoming", "dashboard.scales.upcoming"];
const treasuryPermissions = ["dashboard.finance.revenue", "dashboard.finance.balance", "dashboard.finance.summary", "dashboard.contributions.recent"];

assert.deepEqual(resolvedCodes(allPermissions), dashboardWidgets.slice().sort((a, b) => a.defaultOrder - b.defaultOrder).map((widget) => widget.code), "1: administrador recebe todos os widgets");
const louvor = resolvedCodes(louvorPermissions);
assert(louvor.includes("events.upcoming") && louvor.includes("scales.upcoming") && louvor.includes("members.birthdays") && financeCodes.every((code) => !louvor.includes(code)), "2: louvor nao recebe dados restritos");
const treasury = resolvedCodes(treasuryPermissions);
assert(treasury.includes("finance.balance") && !treasury.includes("members.summary"), "3: tesouraria recebe somente widgets concedidos");
assert.deepEqual(resolvedCodes([]), [], "4: perfil sem widgets recebe lista vazia");
assert(!resolvedCodes(allPermissions, configurations({ hidden: ["finance.balance"] })).includes("finance.balance"), "5: isVisible=false oculta widget permitido");
assert(!resolvedCodes([], withOverride(configurations(), "finance.balance", { isVisible: true })).includes("finance.balance"), "6: isVisible=true nao concede permissao");
assert(!resolvedCodes(allPermissions, configurations({ disabled: ["events.upcoming"] })).includes("events.upcoming"), "7: widget globalmente desabilitado nao aparece");
assert(!resolvedCodes(louvorPermissions.concat("finance.balance.requested-by-client")).includes("finance.balance"), "8: codigo injetado pelo cliente nao concede widget");

assert.deepEqual(resolveDashboardLayout(null), defaultDashboardLayout, "9: ausencia de layout usa defaults sem alterar autorizacao");
const customLayout = resolveDashboardLayout({ layoutMode: "BALANCED", desktopColumns: 2, tabletColumns: 2, mobileColumns: 1, showCategoryHeaders: true, allowCategoryCollapse: true });
assert.equal(customLayout.desktopColumns, 2, "10: layout personalizado retorna duas colunas");
const fullWidget = resolved(allPermissions, withOverride(configurations(), "members.birthdays", { size: "FULL" })).find((item) => item.definition.code === "members.birthdays");
assert.equal(fullWidget?.size, "FULL", "11: tamanho personalizado e resolvido");
assert.equal(dashboardWidgetSizeClasses.FULL, "col-span-full", "11: tamanho FULL usa classe fechada e segura");
const mobileHidden = resolved(allPermissions, withOverride(configurations(), "members.birthdays", { visibleOnMobile: false })).find((item) => item.definition.code === "members.birthdays");
assert.equal(mobileHidden?.visibleOnMobile, false, "12: widget permitido pode ser oculto no celular");
assert(!resolvedCodes([], withOverride(configurations(), "members.birthdays", { visibleOnMobile: true })).includes("members.birthdays"), "12: dispositivo nao prevalece sobre permissao ausente");
const desktopOnly = resolved(allPermissions, withOverride(configurations(), "members.birthdays", { visibleOnMobile: false, visibleOnTablet: false, visibleOnDesktop: true }))[0];
assert.equal(desktopOnly.visibleOnMobile || desktopOnly.visibleOnTablet || !desktopOnly.visibleOnDesktop, false, "13: widget somente desktop e resolvido corretamente");
let prioritySource = configurations().map((item) => ["members.birthdays", "members.summary"].includes(item.code) ? { ...item, defaultOrder: 10 } : item) as Configurations;
assert.equal(resolved(allPermissions, prioritySource)[0].definition.code, "members.birthdays", "14: prioridade desempata a ordem padrao");
prioritySource = withOverride(withOverride(prioritySource, "members.summary", { sortOrder: 1 }), "members.birthdays", { sortOrder: 2 });
assert.equal(resolved(allPermissions, prioritySource)[0].definition.code, "members.summary", "14: sortOrder explicito prevalece sobre prioridade");
assert.deepEqual(groupAuthorizedDashboardWidgets([]), [], "15: categoria sem widgets autorizados nao aparece");
const tamperedIcon = configurations().map((item) => item.code === "members.birthdays" ? { ...item, iconKey: "ARBITRARY_IMPORT" } : item) as unknown as Configurations;
const safeDefinition = resolved(allPermissions, tamperedIcon).find((item) => item.definition.code === "members.birthdays")?.definition;
assert(safeDefinition && dashboardWidgetIconKeys.includes(safeDefinition.iconKey) && dashboardWidgetCategoryByCode.has(safeDefinition.category), "16: renderer usa iconKey do catalogo fechado");
assert.equal(accessRoleCreateSchema.safeParse({ name: "Teste", dashboardWidgets: [{ code: "members.birthdays", isVisible: true, size: "GIANT" }] }).success, false, "17: tamanho desconhecido e rejeitado antes da persistencia");
const versionInfo = getAppVersionInfo();
assert.equal(APP_VERSION, packageJson.version, "18: package.json e a fonte unica da versao");
assert(/^\d+\.\d+\.\d+/.test(APP_VERSION) && shortCommitHash("ABCDEF123456") === "abcdef1" && versionInfo.commitHash?.length !== 40, "18: SemVer e hash curto nao expõem revisao completa");
assert(appReleases.some((release) => release.version === APP_VERSION && release.status === "UNRELEASED" && release.type === "MINOR"), "18: entrega planejada nao finge publicacao");
assert.equal(appFeatures.find((feature) => feature.code === "dashboard.widget-rbac")?.introducedIn, APP_VERSION, "19: feature RBAC identifica a versao planejada");
const nonFinancialPlan = getDashboardQueryPlan(new Set<DashboardWidgetCode>(["members.summary", "events.upcoming"]));
assert.equal(nonFinancialPlan.financeSummary || nonFinancialPlan.incomeOnly || nonFinancialPlan.contributions, false, "20: perfil sem permissao financeira nao agenda consulta financeira");

console.log("Dashboard widget authorization, layout and versioning: 20 scenarios passed.");
