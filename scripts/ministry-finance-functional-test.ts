import assert from "node:assert/strict";
import { FinancialEntryOrigin, FinancialEntryStatus, FinancialEntryType, FinancialPaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "../src/prisma/client";
import { dashboardRepository } from "../src/repositories/dashboard.repository";
import { financialEntryRepository } from "../src/repositories/financial-entry.repository";
import { ministryFinanceRepository } from "../src/repositories/ministry-finance.repository";
import { reportRepository } from "../src/repositories/report.repository";
import { financialEntryService } from "../src/services/financial-entry.service";
import type { FinancialAuthorization } from "../src/types/ministry-finance.types";

const expectedHost = "ep-twilight-haze-adynpvs9";
const fixture = `qa-ministry-finance-${Date.now()}`;
const created = { users: [] as string[], ministries: [] as string[], categories: [] as string[], entries: [] as string[] };

function assertDevelopmentDatasource() {
  for (const key of ["DATABASE_URL", "DIRECT_URL"] as const) {
    const value = process.env[key];
    assert(value, `${key} ausente`);
    const url = new URL(value);
    assert(url.hostname.startsWith(expectedHost), `${key} nao aponta para Neon Development`);
    assert.equal(url.pathname.slice(1), "ibe", `${key} deve usar database ibe`);
  }
}

function input(type: FinancialEntryType, categoryId: string, ministryId: string, amount: number) {
  return {
    type,
    memberId: null,
    categoryId,
    eventId: null,
    ministryId,
    amount,
    paymentMethod: FinancialPaymentMethod.PIX,
    status: FinancialEntryStatus.CONFIRMED,
    origin: FinancialEntryOrigin.MANUAL,
    anonymous: false,
    launchDate: new Date("2026-09-01T00:00:00.000Z"),
    referenceDate: new Date("2026-09-01T00:00:00.000Z"),
    observation: fixture
  };
}

function decimal(value: Prisma.Decimal | null) {
  return new Prisma.Decimal(value?.toString() ?? "0");
}

async function main() {
  assertDevelopmentDatasource();
  try {
    const [louvor, infantil] = await Promise.all([
      prisma.ministry.create({ data: { name: `${fixture}-Louvor`, slug: `${fixture}-louvor`, isActive: true } }),
      prisma.ministry.create({ data: { name: `${fixture}-Infantil`, slug: `${fixture}-infantil`, isActive: true } })
    ]);
    created.ministries.push(louvor.id, infantil.id);
    const apoio = await prisma.ministry.create({ data: { name: `${fixture}-Apoio`, slug: `${fixture}-apoio`, isActive: true } });
    created.ministries.push(apoio.id);
    const [incomeCategory, expenseCategory] = await Promise.all([
      prisma.financialCategory.create({ data: { name: `${fixture}-Receita`, type: FinancialEntryType.INCOME } }),
      prisma.financialCategory.create({ data: { name: `${fixture}-Despesa`, type: FinancialEntryType.EXPENSE } })
    ]);
    created.categories.push(incomeCategory.id, expenseCategory.id);
    const [userA, userB, admin] = await Promise.all([
      prisma.user.create({ data: { name: `${fixture}-A`, username: `${fixture}-a`, email: `${fixture}-a@example.test`, passwordHash: "fixture" } }),
      prisma.user.create({ data: { name: `${fixture}-B`, username: `${fixture}-b`, email: `${fixture}-b@example.test`, passwordHash: "fixture" } }),
      prisma.user.create({ data: { name: `${fixture}-Admin`, username: `${fixture}-admin`, email: `${fixture}-admin@example.test`, passwordHash: "fixture" } })
    ]);
    created.users.push(userA.id, userB.id, admin.id);
    await ministryFinanceRepository.replaceAccesses(userA.id, [louvor.id], admin.id);
    await ministryFinanceRepository.replaceAccesses(userB.id, [infantil.id], admin.id);

    const louvorAuth: FinancialAuthorization = { userId: userA.id, accessContext: { allMinistries: false, authorizedMinistryIds: [louvor.id] } };
    const infantilAuth: FinancialAuthorization = { userId: userB.id, accessContext: { allMinistries: false, authorizedMinistryIds: [infantil.id] } };
    const globalAuth: FinancialAuthorization = { userId: admin.id, accessContext: { allMinistries: true, authorizedMinistryIds: [] } };
    const dashboardReferenceDate = new Date("2026-09-30T12:00:00.000Z");
    const baselineTotal = await dashboardRepository.getTotalFinanceBalance(globalAuth.accessContext, dashboardReferenceDate);
    const baselineMonth = await dashboardRepository.getMonthlyFinanceSummary(globalAuth.accessContext, dashboardReferenceDate);
    for (const [payload, authorization] of [
      [input(FinancialEntryType.INCOME, incomeCategory.id, louvor.id, 1000), louvorAuth],
      [input(FinancialEntryType.EXPENSE, expenseCategory.id, louvor.id, 250), louvorAuth],
      [input(FinancialEntryType.INCOME, incomeCategory.id, infantil.id, 500), infantilAuth],
      [input(FinancialEntryType.EXPENSE, expenseCategory.id, infantil.id, 100), infantilAuth]
    ] as const) {
      const entry = await financialEntryService.create(payload, authorization);
      created.entries.push(entry.id);
    }
    const baselineAfterStandardTotal = await dashboardRepository.getTotalFinanceBalance(globalAuth.accessContext, dashboardReferenceDate);
    const baselineAfterStandardMonth = await dashboardRepository.getMonthlyFinanceSummary(globalAuth.accessContext, dashboardReferenceDate);

    for (const payload of [
      { ...input(FinancialEntryType.INCOME, incomeCategory.id, louvor.id, 800), launchDate: new Date("2026-08-31T00:00:00.000Z"), referenceDate: new Date("2026-08-31T00:00:00.000Z") },
      { ...input(FinancialEntryType.INCOME, incomeCategory.id, infantil.id, 100), launchDate: new Date("2026-09-01T00:00:00.000Z"), referenceDate: new Date("2026-09-01T00:00:00.000Z") },
      { ...input(FinancialEntryType.EXPENSE, expenseCategory.id, infantil.id, 45), launchDate: new Date("2026-09-01T00:00:00.000Z"), referenceDate: new Date("2026-09-01T00:00:00.000Z") }
    ]) {
      created.entries.push((await financialEntryService.create(payload, globalAuth)).id);
    }
    const historicalTotal = await dashboardRepository.getTotalFinanceBalance(globalAuth.accessContext, dashboardReferenceDate);
    const historicalMonthly = await dashboardRepository.getMonthlyFinanceSummary(globalAuth.accessContext, dashboardReferenceDate);
    const historicalDelta = decimal(historicalTotal.income).minus(decimal(historicalTotal.expense)).minus(decimal(baselineAfterStandardTotal.income).minus(decimal(baselineAfterStandardTotal.expense)));
    assert.equal(historicalDelta.toFixed(2), "855.00", "saldo geral inclui historico entre meses e movimentacoes ministeriais");
    assert.equal(decimal(historicalMonthly.monthlyIncome).minus(decimal(historicalMonthly.monthlyExpense)).minus(decimal(baselineAfterStandardMonth.monthlyIncome).minus(decimal(baselineAfterStandardMonth.monthlyExpense))).toFixed(2), "55.00", "resumo mensal permanece limitado ao mes de referencia");

    const listInput = { sortBy: "launchDate", sortDirection: "desc", page: 1, pageSize: 10 } as const;
    const louvorEntries = await financialEntryService.list(listInput, louvorAuth);
    assert.equal(louvorEntries.entries.length, 3, "usuario Louvor ve todas as tres movimentacoes autorizadas, incluindo historico");
    await assert.rejects(() => financialEntryService.list({ ...listInput, ministryId: infantil.id }, louvorAuth), /permissao/i);
    await assert.rejects(() => financialEntryService.getById(created.entries[2], louvorAuth), /nao encontrado/i);
    await assert.rejects(() => financialEntryService.update(created.entries[2], { observation: fixture }, louvorAuth), /nao encontrado/i);
    await assert.rejects(() => financialEntryService.cancel(created.entries[2], louvorAuth), /nao encontrado/i);
    await assert.rejects(() => financialEntryService.remove(created.entries[2], louvorAuth), /nao encontrado/i);
    await assert.rejects(() => financialEntryRepository.update(created.entries[2], { observation: fixture }, userA.id, louvorAuth.accessContext), (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "P2025");
    await assert.rejects(() => financialEntryService.create(input(FinancialEntryType.INCOME, incomeCategory.id, infantil.id, 1), louvorAuth), /permissao/i);
    await assert.rejects(() => financialEntryService.update(created.entries[0], { ministryId: infantil.id }, louvorAuth), /permissao/i);

    const louvorBalance = await dashboardRepository.getMinistryFinanceBalances(louvorAuth.accessContext);
    assert.deepEqual(louvorBalance.map((item) => [item.ministryId, item.balance]), [[louvor.id, "1550.00"]]);
    const allBalances = await dashboardRepository.getMinistryFinanceBalances(globalAuth.accessContext);
    const fixtures = allBalances.filter((item) => [louvor.id, infantil.id].includes(item.ministryId));
    assert.deepEqual(fixtures.map((item) => item.balance).sort(), ["1550.00", "455.00"]);
    const total = await dashboardRepository.getTotalFinanceBalance(globalAuth.accessContext, dashboardReferenceDate);
    const totalDelta = decimal(total.income).minus(decimal(total.expense)).minus(decimal(baselineTotal.income).minus(decimal(baselineTotal.expense)));
    assert.equal(totalDelta.toFixed(2), "2005.00", "movimentacoes ministeriais e historicas impactam saldo geral em 2005.00 exatos");
    const monthly = await dashboardRepository.getMonthlyFinanceSummary(globalAuth.accessContext, dashboardReferenceDate);
    assert.equal(decimal(monthly.monthlyIncome).minus(decimal(baselineMonth.monthlyIncome)).toFixed(2), "1600.00", "resumo mensal soma receitas das fixtures do mes de referencia");
    assert.equal(decimal(monthly.monthlyExpense).minus(decimal(baselineMonth.monthlyExpense)).toFixed(2), "395.00", "resumo mensal soma despesas das fixtures do mes de referencia");

    const report = await reportRepository.financial({ exportFormat: "view", page: 1, pageSize: 25, sortOrder: "desc", filters: { ministryId: louvor.id } }, louvorAuth.accessContext);
    assert.equal(report.total, 3);
    assert.equal(Number(report.income?.toString()) - Number(report.expense?.toString()), 1550);
    const expenseOnly = await reportRepository.financial({ exportFormat: "view", page: 1, pageSize: 1, sortOrder: "desc", filters: { ministryId: louvor.id, type: FinancialEntryType.EXPENSE, categoryId: expenseCategory.id, startDate: "2026-09-01", endDate: "2026-09-01" } }, louvorAuth.accessContext);
    assert.equal(expenseOnly.total, 1, "relatorio aplica filtros combinados antes da paginacao");
    assert.equal(expenseOnly.rows.length, 1);
    assert.equal(expenseOnly.income?.toString() ?? "0", "0");
    assert.equal(expenseOnly.expense?.toString(), "250");
    const paged = await reportRepository.financial({ exportFormat: "view", page: 1, pageSize: 1, sortOrder: "desc", filters: { ministryId: louvor.id } }, louvorAuth.accessContext);
    assert.equal(paged.rows.length, 1);
    assert.equal(paged.total, 3);
    assert.equal(Number(paged.income?.toString()) - Number(paged.expense?.toString()), 1550, "totais cobrem todo o filtro, nao somente a pagina");
    const unauthorizedReport = await reportRepository.financial({ exportFormat: "view", page: 1, pageSize: 25, sortOrder: "desc", filters: { ministryId: infantil.id } }, louvorAuth.accessContext);
    assert.equal(unauthorizedReport.total, 0, "filtro ministerial nao amplia o escopo do relatorio");

    const future = await financialEntryService.create({ ...input(FinancialEntryType.INCOME, incomeCategory.id, louvor.id, 999), launchDate: new Date("2099-01-10T00:00:00.000Z") }, louvorAuth);
    created.entries.push(future.id);
    const currentBalance = await dashboardRepository.getMinistryFinanceBalances(louvorAuth.accessContext);
    assert.equal(currentBalance.find((item) => item.ministryId === louvor.id)?.balance, "1550.00", "lancamento futuro nao entra no saldo atual");
    const zeroBalance = await dashboardRepository.getMinistryFinanceBalances({ allMinistries: false, authorizedMinistryIds: [louvor.id, infantil.id, apoio.id] });
    assert.equal(zeroBalance.find((item) => item.ministryId === apoio.id)?.balance, "0.00", "ministerio sem movimentacao aparece com saldo zero");
    const cancelled = await financialEntryService.cancel(created.entries[0], louvorAuth);
    assert.equal(cancelled.status, FinancialEntryStatus.CANCELED);
    assert.equal((await dashboardRepository.getMinistryFinanceBalances(louvorAuth.accessContext))[0].balance, "550.00", "cancelado nao soma no saldo");
    const negativeReport = await reportRepository.financial({ exportFormat: "view", page: 1, pageSize: 25, sortOrder: "desc", filters: { ministryId: louvor.id, endDate: "2026-09-15" } }, louvorAuth.accessContext);
    assert.equal(negativeReport.total, 2);
    assert.equal(Number(negativeReport.income?.toString() ?? "0") - Number(negativeReport.expense?.toString() ?? "0"), 550, "relatorio considera o historico confirmado junto ao status atual");
    const historicalStatuses = await reportRepository.financial({ exportFormat: "view", page: 1, pageSize: 25, sortOrder: "desc", filters: { ministryId: louvor.id, endDate: "2026-09-15", status: "" } }, louvorAuth.accessContext);
    assert.equal(historicalStatuses.total, 3, "filtro Todos preserva lancamentos cancelados no relatorio historico");
    assert.equal(Number(historicalStatuses.income?.toString() ?? "0") - Number(historicalStatuses.expense?.toString() ?? "0"), 1550, "totais usam o mesmo conjunto do filtro Todos");
    await financialEntryService.remove(created.entries[1], louvorAuth);
    assert.equal((await dashboardRepository.getMinistryFinanceBalances(louvorAuth.accessContext))[0].balance, "800.00", "soft deleted nao soma no saldo");

    await ministryFinanceRepository.replaceAccesses(userA.id, [], admin.id);
    const revoked = await financialEntryService.list(listInput, { userId: userA.id, accessContext: { allMinistries: false, authorizedMinistryIds: [] } });
    assert.equal(revoked.entries.length, 0, "revogacao remove acesso imediatamente");
    await ministryFinanceRepository.replaceAccesses(userA.id, [louvor.id, infantil.id], admin.id);
    const multiple = await financialEntryService.list(listInput, { userId: userA.id, accessContext: { allMinistries: false, authorizedMinistryIds: [louvor.id, infantil.id] } });
    assert.equal(multiple.entries.length, 7, "usuario com dois ministerios acessa apenas registros nao removidos de ambos");
    await prisma.ministry.update({ where: { id: louvor.id }, data: { isActive: false } });
    assert(!(await financialEntryRepository.listMinistries(louvorAuth.accessContext)).some((ministry) => ministry.id === louvor.id), "ministerio inativo nao aparece em novo lancamento");
    await assert.rejects(() => financialEntryService.create(input(FinancialEntryType.INCOME, incomeCategory.id, louvor.id, 1), louvorAuth), /nao encontrado/i);
    const historical = await financialEntryService.update(future.id, { observation: `${fixture}-historical` }, louvorAuth);
    assert.equal(historical.ministry?.id, louvor.id, "historico de ministerio inativo permanece editavel sem troca de destino");
    const concurrent = await Promise.all([
      financialEntryService.create(input(FinancialEntryType.INCOME, incomeCategory.id, apoio.id, 1), globalAuth),
      financialEntryService.create(input(FinancialEntryType.INCOME, incomeCategory.id, apoio.id, 1), globalAuth)
    ]);
    created.entries.push(...concurrent.map((entry) => entry.id));
    assert.notEqual(concurrent[0].entryNumber, concurrent[1].entryNumber, "criacoes concorrentes preservam numeracao unica");
    assert.equal((await dashboardRepository.getMinistryFinanceBalances({ allMinistries: false, authorizedMinistryIds: [apoio.id] }))[0].balance, "2.00");

    const generalIncome = await financialEntryService.create({ ...input(FinancialEntryType.INCOME, incomeCategory.id, apoio.id, 2000), ministryId: null }, globalAuth);
    const generalExpense = await financialEntryService.create({ ...input(FinancialEntryType.EXPENSE, expenseCategory.id, apoio.id, 500), ministryId: null }, globalAuth);
    created.entries.push(generalIncome.id, generalExpense.id);
    assert.equal((await financialEntryService.getById(generalIncome.id, globalAuth)).ministry, null, "lancamento geral nao possui ministerio");
    await assert.rejects(() => financialEntryService.getById(generalIncome.id, louvorAuth), /nao encontrado/i);
    await assert.rejects(() => financialEntryService.update(generalIncome.id, { ministryId: apoio.id }, louvorAuth), /nao encontrado/i);
    await assert.rejects(() => financialEntryService.cancel(generalIncome.id, louvorAuth), /nao encontrado/i);
    await assert.rejects(() => financialEntryService.remove(generalIncome.id, louvorAuth), /nao encontrado/i);
    const totalWithGeneral = await dashboardRepository.getTotalFinanceBalance(globalAuth.accessContext, dashboardReferenceDate);
    const generalDelta = decimal(totalWithGeneral.income).minus(decimal(totalWithGeneral.expense))
      .minus(decimal(baselineTotal.income).minus(decimal(baselineTotal.expense)));
    assert.equal(generalDelta.toFixed(2), "2757.00", "geral, ministerial e historico compartilham ledger canonico");
    assert.equal((await dashboardRepository.getMinistryFinanceBalances({ allMinistries: false, authorizedMinistryIds: [apoio.id] }))[0].balance, "2.00", "geral nao e alocado ao ministerio");
    const generalUpdated = await financialEntryService.update(generalIncome.id, { amount: 2100 }, globalAuth);
    assert.equal(new Prisma.Decimal(generalUpdated.amount).toFixed(2), "2100.00", "lancamento geral editado pelo fluxo oficial");
    await financialEntryService.cancel(generalIncome.id, globalAuth);
    assert.equal((await financialEntryService.getById(generalIncome.id, globalAuth)).status, FinancialEntryStatus.CANCELED);
    await financialEntryService.remove(generalExpense.id, globalAuth);
    await assert.rejects(() => financialEntryService.getById(generalExpense.id, globalAuth), /nao encontrado/i);

    const negativeMinistry = await prisma.ministry.create({ data: { name: `${fixture}-Negativo`, slug: `${fixture}-negativo`, isActive: true } });
    created.ministries.push(negativeMinistry.id);
    for (const [type, categoryId, amount] of [
      [FinancialEntryType.INCOME, incomeCategory.id, 100],
      [FinancialEntryType.EXPENSE, expenseCategory.id, 300]
    ] as const) {
      created.entries.push((await financialEntryService.create(input(type, categoryId, negativeMinistry.id, amount), globalAuth)).id);
    }
    assert.equal((await dashboardRepository.getMinistryFinanceBalances({ allMinistries: false, authorizedMinistryIds: [negativeMinistry.id] }))[0].balance, "-200.00", "saldo negativo independente");

    const centMinistry = await prisma.ministry.create({ data: { name: `${fixture}-Centavos`, slug: `${fixture}-centavos`, isActive: true } });
    created.ministries.push(centMinistry.id);
    for (const [type, categoryId, amount] of [
      [FinancialEntryType.INCOME, incomeCategory.id, 0.1],
      [FinancialEntryType.INCOME, incomeCategory.id, 0.2],
      [FinancialEntryType.EXPENSE, expenseCategory.id, 0.3]
    ] as const) {
      created.entries.push((await financialEntryService.create(input(type, categoryId, centMinistry.id, amount), globalAuth)).id);
    }
    assert.equal((await dashboardRepository.getMinistryFinanceBalances({ allMinistries: false, authorizedMinistryIds: [centMinistry.id] }))[0].balance, "0.00", "precisao decimal de centavos");

    const pageMinistry = await prisma.ministry.create({ data: { name: `${fixture}-Paginacao`, slug: `${fixture}-paginacao`, isActive: true } });
    created.ministries.push(pageMinistry.id);
    for (let index = 0; index < 11; index += 1) {
      created.entries.push((await financialEntryService.create(input(FinancialEntryType.INCOME, incomeCategory.id, pageMinistry.id, 1), globalAuth)).id);
    }
    const pageInput = { exportFormat: "view", pageSize: 5, sortOrder: "desc", filters: { ministryId: pageMinistry.id } } as const;
    const reportPages = await Promise.all([1, 2, 3].map((page) => reportRepository.financial({ ...pageInput, page }, globalAuth.accessContext)));
    assert.deepEqual(reportPages.map((page) => page.rows.length), [5, 5, 1], "relatorio pagina mais de uma pagina");
    assert(reportPages.every((page) => page.total === 11 && page.income?.toString() === "11"), "total e soma iguais em todas as paginas");
    assert.equal(new Set(reportPages.flatMap((page) => page.rows.map((row) => row.id))).size, 11, "paginacao sem duplicidade");

    const sameGrant = await Promise.allSettled([
      ministryFinanceRepository.replaceAccesses(userB.id, [infantil.id], admin.id),
      ministryFinanceRepository.replaceAccesses(userB.id, [infantil.id], admin.id)
    ]);
    assert(sameGrant.every((result) => result.status === "fulfilled"), "configuracao concorrente idempotente deve concluir sem erro");
    assert.equal(await prisma.ministryFinancialAccess.count({ where: { userId: userB.id, ministryId: infantil.id } }), 1, "concessao concorrente sem duplicidade");
    console.log("Ministry finance functional Development: extended Gate scenarios passed.");
  } finally {
    await prisma.financialEntry.deleteMany({ where: { observation: { startsWith: fixture } } });
    if (created.users.length) await prisma.ministryFinancialAccess.deleteMany({ where: { userId: { in: created.users } } });
    if (created.categories.length) await prisma.financialCategory.deleteMany({ where: { id: { in: created.categories } } });
    if (created.ministries.length) await prisma.ministry.deleteMany({ where: { id: { in: created.ministries } } });
    if (created.users.length) await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    const [entryResidues, accessResidues, ministryResidues] = await Promise.all([
      prisma.financialEntry.count({ where: { observation: { startsWith: fixture } } }),
      prisma.ministryFinancialAccess.count({ where: { userId: { in: created.users } } }),
      prisma.ministry.count({ where: { id: { in: created.ministries } } })
    ]);
    assert.equal(entryResidues + accessResidues + ministryResidues, 0, "fixtures removidos do Neon Development");
    await prisma.$disconnect();
  }
}

void main();
