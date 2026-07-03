import { AppError } from "@/lib/errors";
import { financialClosingRepository, type FinancialClosingRecord } from "@/repositories/financial-closing.repository";
import type { FinancialClosingListResult, FinancialClosingSummary } from "@/types";
import type { FinancialClosingCreateInput, FinancialClosingListQueryInput, FinancialClosingUpdateInput } from "@/validators";

function serialize(closing: FinancialClosingRecord): FinancialClosingSummary {
  return {
    ...closing,
    openingBalance: closing.openingBalance.toString(),
    closingBalance: closing.closingBalance.toString(),
    date: closing.date.toISOString(),
    createdAt: closing.createdAt.toISOString(),
    updatedAt: closing.updatedAt.toISOString()
  };
}

async function ensureUniqueDate(date: Date | undefined, currentId?: string) {
  if (!date) {
    return;
  }

  const existing = await financialClosingRepository.findByDate(date);

  if (existing && existing.id !== currentId) {
    throw new AppError("Ja existe fechamento para esta data.", 409, "FINANCIAL_CLOSING_DUPLICATE");
  }
}

export const financialClosingService = {
  async list(filters: FinancialClosingListQueryInput): Promise<FinancialClosingListResult> {
    const result = await financialClosingRepository.list(filters);

    return {
      closings: result.closings.map(serialize),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / filters.pageSize))
      }
    };
  },

  async getById(id: string) {
    const closing = await financialClosingRepository.findById(id);

    if (!closing) {
      throw new AppError("Fechamento financeiro nao encontrado.", 404, "FINANCIAL_CLOSING_NOT_FOUND");
    }

    return serialize(closing);
  },

  async create(data: FinancialClosingCreateInput, userId: string) {
    await ensureUniqueDate(data.date);

    return serialize(await financialClosingRepository.create(data, userId));
  },

  async update(id: string, data: FinancialClosingUpdateInput, userId: string) {
    await this.getById(id);
    await ensureUniqueDate(data.date, id);

    return serialize(await financialClosingRepository.update(id, data, userId));
  },

  async remove(id: string) {
    await this.getById(id);

    return financialClosingRepository.softDelete(id);
  }
};
