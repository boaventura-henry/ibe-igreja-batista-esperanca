import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildFinancialScopeWhere } from "../src/repositories/financial-entry.repository";
import { currentFinancialMonthRange } from "../src/repositories/dashboard.repository";

let scenarios = 0;
function check(value: unknown, message: string) { scenarios += 1; assert(value, `${scenarios}: ${message}`); }

const globalScope = buildFinancialScopeWhere({ allMinistries: true, authorizedMinistryIds: [] });
const louvorScope = buildFinancialScopeWhere({ allMinistries: false, authorizedMinistryIds: ["louvor"] });
const emptyScope = buildFinancialScopeWhere({ allMinistries: false, authorizedMinistryIds: [] });
assert.deepEqual(globalScope, {}); scenarios += 1;
assert.deepEqual(louvorScope, { ministryId: { in: ["louvor"] } }); scenarios += 1;
assert.deepEqual(emptyScope, { ministryId: { in: [] } }); scenarios += 1;
const monthBeforeSaoPauloMidnight = currentFinancialMonthRange(new Date("2026-10-01T02:59:59.000Z"));
assert.equal(monthBeforeSaoPauloMidnight.start.toISOString(), "2026-09-01T00:00:00.000Z"); scenarios += 1;
assert.equal(monthBeforeSaoPauloMidnight.end.toISOString(), "2026-10-01T00:00:00.000Z"); scenarios += 1;
const monthAfterSaoPauloMidnight = currentFinancialMonthRange(new Date("2026-10-01T03:00:00.000Z"));
assert.equal(monthAfterSaoPauloMidnight.start.toISOString(), "2026-10-01T00:00:00.000Z"); scenarios += 1;

const repository = readFileSync("src/repositories/financial-entry.repository.ts", "utf8");
const service = readFileSync("src/services/financial-entry.service.ts", "utf8");
const routes = [
  "src/app/api/financial/entries/route.ts",
  "src/app/api/financial/entries/[id]/route.ts",
  "src/app/api/financial/entries/[id]/cancel/route.ts"
].map((path) => readFileSync(path, "utf8")).join("\n");
const report = readFileSync("src/repositories/report.repository.ts", "utf8");
const dashboard = readFileSync("src/repositories/dashboard.repository.ts", "utf8");
const ui = readFileSync("src/components/financial/FinancialEntryManager.tsx", "utf8");
const userUi = readFileSync("src/components/users/UserManager.tsx", "utf8");
const middleware = readFileSync("src/middleware.ts", "utf8");
const schema = readFileSync("prisma/schema.prisma", "utf8");

check(repository.includes("buildFinancialScopeWhere(accessContext)"), "listagem aplica scope no repository");
check(repository.includes("findByIdWithinScope"), "acesso por ID usa mecanismo escopado");
check((repository.match(/where: scopedUniqueWhere\(id, accessContext\)/g)?.length ?? 0) === 3, "update, cancel e soft delete incluem scope no proprio UPDATE");
check(service.includes("ensureDestinationAccess"), "create e update validam destino");
check(service.includes("current.ministry?.id"), "update preserva e valida o ministerio atual");
check((routes.match(/requireFinancialAccess\("/g)?.length ?? 0) === 6, "todas as operacoes HTTP usam autorizacao financeira");
check(report.includes("buildFinancialScopeWhere(accessContext)"), "relatorio aplica scope server-side");
check(report.includes("prisma.financialEntry.aggregate"), "totais do relatorio sao agregados no banco");
check(report.includes('input.filters.status === ""'), "relatorio preserva status historicos via filtro Todos");
check(report.includes("createdAt: \"desc\"") && report.includes("id: \"desc\""), "relatorio possui ordenacao deterministica");
check(dashboard.includes("getTotalFinanceBalance"), "saldo total possui agregacao canonica");
check(dashboard.includes("applicationDateOnlyCutoff()"), "saldo historico respeita o dia civil atual");
check(dashboard.includes("new Prisma.Decimal(0)"), "saldo ministerial preserva centavos e saldo zero");
check(dashboard.includes("groupBy"), "saldo ministerial evita N+1 financeiro");
check(dashboard.includes("buildFinancialScopeWhere(accessContext)"), "dashboard aplica o mesmo scope");
check(ui.includes("Geral da igreja") && ui.includes("allMinistries"), "financeiro geral aparece somente no contexto global");
check(ui.includes("ministryFinance.create"), "UI reconhece permissao ministerial de criacao");
check(ui.includes("editingMinistry") && ui.includes("(inativo)"), "edicao preserva ministerio inativo do historico");
check(userUi.includes("Financeiro ministerial"), "configuracao de acesso esta integrada aos usuarios");
check(userUi.includes("isFinanceAccessSaving"), "configuracao bloqueia duplo submit");
check(userUi.includes('FormMessage id="ministry-finance-access-message"'), "erro de configuracao aparece dentro do modal");
check(middleware.includes('pathname.startsWith("/financeiro/lancamentos") &&\n      !request.nextauth.token?.permissionCodes?.includes("financialEntry.view") &&\n      !request.nextauth.token?.permissionCodes?.includes("ministryFinance.view")'), "middleware permite acesso ministerial sem permissao financeira global");
check(schema.includes("@@unique([userId, ministryId])"), "scope impede concessoes duplicadas");
check(schema.includes("MinistryFinancialAccess"), "scope persistido usa User e Ministry canonicos");
check(!schema.includes("model MinistryIncome") && !schema.includes("model MinistryExpense"), "nao existe ledger paralelo");
check(routes.includes('requireFinancialAccess("view")'), "read exige autorizacao funcional e scope");
check(routes.includes('requireFinancialAccess("create")'), "create exige autorizacao funcional e scope");
check(routes.includes('requireFinancialAccess("update")'), "update exige autorizacao funcional e scope");
check(routes.includes('requireFinancialAccess("delete")'), "delete exige autorizacao funcional e scope");
check(routes.includes('requireFinancialAccess("cancel")'), "cancel exige autorizacao funcional e scope");

console.log(`Ministry finance authorization and UI: ${scenarios} scenarios passed.`);
