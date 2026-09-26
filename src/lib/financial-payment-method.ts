import type { FinancialPaymentMethod } from "@prisma/client";

export const financialPaymentMethodLabels: Readonly<Record<FinancialPaymentMethod, string>> = {
  CASH: "Dinheiro",
  PIX: "PIX",
  DEBIT_CARD: "Cartão de débito",
  CREDIT_CARD: "Cartão de crédito",
  BANK_TRANSFER: "Transferência bancária",
  CHECK: "Cheque",
  OTHER: "Outros"
};

export function formatFinancialPaymentMethod(value: FinancialPaymentMethod | string | null | undefined) {
  if (typeof value !== "string") return "Forma não informada";
  return financialPaymentMethodLabels[value as FinancialPaymentMethod] ?? value;
}
