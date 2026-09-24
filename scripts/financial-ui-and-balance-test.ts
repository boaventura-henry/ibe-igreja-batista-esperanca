import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { dashboardWidgets } from "../src/config/dashboard-widgets";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const entry = read("src/components/financial/FinancialEntryManager.tsx");
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
