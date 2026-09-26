import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { FinancialPaymentMethod } from "@prisma/client";
import { dashboardWidgets } from "../src/config/dashboard-widgets";
import { formatFinancialPaymentMethod } from "../src/lib/financial-payment-method";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const entry = read("src/components/financial/FinancialEntryManager.tsx");
const portalContributions = read("src/components/portal/MemberContributionManager.tsx");
const reports = read("src/services/report.service.ts");
const modal = read("src/components/ui/Modal.tsx");
const renderer = read("src/components/dashboard/widgets/DashboardWidgetRenderer.tsx");
const migration = read("prisma/migrations/20260924120000_rename_finance_balance_dashboard_widget/migration.sql");

for (const [label, id] of [
  ["Tipo", "financial-entry-type"], ["Categoria", "financial-entry-category"], ["Valor", "financial-entry-amount"],
  ["Forma de pagamento", "financial-entry-payment-method"], ["Data do lançamento", "financial-entry-launch-date"],
  ["Data de referência", "financial-entry-reference-date"], ["Membro", "financial-entry-member"], ["Ministerio", "financial-entry-ministry"],
  ["Evento", "financial-entry-event"], ["Status", "financial-entry-status"], ["Observacao", "financial-entry-observation"]
]) {
  assert(entry.includes(`htmlFor=\"${id}\"`) && entry.includes(`id=\"${id}\"`) && entry.includes(`>${label}`), `${label} possui label visivel e associacao semantica`);
}
assert(entry.includes('htmlFor="financial-entry-anonymous"') && entry.includes('id="financial-entry-anonymous"'), "Anonimo permanece associado ao checkbox");
assert(entry.includes('method: editingId ? "PUT" : "POST"') && entry.includes('body: JSON.stringify(normalize(form))'), "submissao financeira preservada");
for (const [value, technicalValue, label] of [
  [FinancialPaymentMethod.CASH, "CASH", "Dinheiro"],
  [FinancialPaymentMethod.PIX, "PIX", "PIX"],
  [FinancialPaymentMethod.DEBIT_CARD, "DEBIT_CARD", "Cartão de débito"],
  [FinancialPaymentMethod.CREDIT_CARD, "CREDIT_CARD", "Cartão de crédito"],
  [FinancialPaymentMethod.BANK_TRANSFER, "BANK_TRANSFER", "Transferência bancária"],
  [FinancialPaymentMethod.CHECK, "CHECK", "Cheque"],
  [FinancialPaymentMethod.OTHER, "OTHER", "Outros"]
] as const) {
  assert.equal(formatFinancialPaymentMethod(value), label, `${value} usa o rotulo amigavel correto`);
  assert.equal(value, technicalValue, `${value} permanece o valor tecnico do contrato`);
}
assert.equal(formatFinancialPaymentMethod("UNKNOWN_METHOD"), "UNKNOWN_METHOD", "valor inesperado permanece visivel para diagnostico");
assert.equal(formatFinancialPaymentMethod(null), "Forma não informada", "valor ausente recebe apresentacao segura");
assert(entry.includes('value={form.paymentMethod}') && entry.includes('paymentMethod: entry.paymentMethod'), "edicao preserva o enum tecnico carregado");
assert(entry.includes('value={method}>{formatFinancialPaymentMethod(method)}</option>'), "dropdown separa value tecnico de label amigavel");
assert(portalContributions.includes('formatFinancialPaymentMethod(contribution.paymentMethod)'), "Portal reutiliza o formatter de forma de pagamento");
assert(reports.includes('option(formatFinancialPaymentMethod(value), value)') && reports.includes('paymentMethod: formatFinancialPaymentMethod(entry.paymentMethod)'), "relatorios e exportacoes usam labels amigaveis sem alterar filtros tecnicos");
assert(modal.includes('max-h-[calc(100dvh-1.5rem)]') && modal.includes('overflow-y-auto') && modal.includes('overscroll-contain') && modal.includes('w-full'), "modal limita viewport e preserva scroll vertical");
assert(modal.includes('role="dialog"') && modal.includes('aria-modal="true"') && modal.includes('aria-labelledby={titleId}'), "modal compartilhado possui semantica acessivel");
for (const file of ["src/components/financial/FinancialEntryManager.tsx", "src/components/financial/FinancialCategoryManager.tsx", "src/components/financial/FinancialClosingManager.tsx"]) {
  const source = read(file);
  assert(source.includes('import { Modal } from "@/components/ui/Modal"'), `${file} usa o modal compartilhado`);
  assert(!source.includes("function Modal("), `${file} nao mantem modal duplicado`);
}
assert.equal(dashboardWidgets.find((widget) => widget.code === "finance.balance")?.title, "Saldo geral", "catalogo nomeia o card historico como Saldo geral");
assert(renderer.includes('label="Saldo geral"') && renderer.includes('Historico de entradas menos saidas confirmadas'), "renderer preserva a semantica historica do saldo geral");
assert(migration.includes('UPDATE "DashboardWidget"') && migration.includes("'finance.balance'") && migration.includes("'Saldo geral'"), "migration atualiza somente o titulo persistido do widget");
assert(!migration.includes("DELETE") && !migration.includes("INSERT"), "migration e aditiva e idempotente");

console.log("Financial labels, responsive modal and general balance: 21 scenarios passed.");
