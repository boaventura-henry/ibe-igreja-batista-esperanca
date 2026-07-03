import { AppError } from "@/lib/errors";
import { financialCategoryRepository, type FinancialCategoryRecord } from "@/repositories/financial-category.repository";
import type { FinancialCategoryListResult, FinancialCategorySummary } from "@/types";
import type {
  FinancialCategoryCreateInput,
  FinancialCategoryListQueryInput,
  FinancialCategoryUpdateInput
} from "@/validators";

function serialize(category: FinancialCategoryRecord): FinancialCategorySummary {
  return {
    ...category,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString()
  };
}

async function ensureUniqueName(data: FinancialCategoryCreateInput | FinancialCategoryUpdateInput, currentId?: string) {
  if (!data.name || !data.type) {
    return;
  }

  const existing = await financialCategoryRepository.findByNameAndType(data.name, data.type);

  if (existing && existing.id !== currentId) {
    throw new AppError("Ja existe categoria financeira com este nome e tipo.", 409, "FINANCIAL_CATEGORY_DUPLICATE");
  }
}

export const financialCategoryService = {
  async list(filters: FinancialCategoryListQueryInput): Promise<FinancialCategoryListResult> {
    const result = await financialCategoryRepository.list(filters);

    return {
      categories: result.categories.map(serialize),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / filters.pageSize))
      }
    };
  },

  async listActive() {
    return (await financialCategoryRepository.listActive()).map(serialize);
  },

  async getById(id: string) {
    const category = await financialCategoryRepository.findById(id);

    if (!category) {
      throw new AppError("Categoria financeira nao encontrada.", 404, "FINANCIAL_CATEGORY_NOT_FOUND");
    }

    return serialize(category);
  },

  async create(data: FinancialCategoryCreateInput, userId: string) {
    await ensureUniqueName(data);

    return serialize(await financialCategoryRepository.create(data, userId));
  },

  async update(id: string, data: FinancialCategoryUpdateInput, userId: string) {
    const current = await this.getById(id);
    await ensureUniqueName({ ...current, ...data }, id);

    return serialize(await financialCategoryRepository.update(id, data, userId));
  },

  async remove(id: string, userId: string) {
    const current = await this.getById(id);

    if (current.isSystem) {
      throw new AppError("Categoria do sistema nao pode ser excluida.", 409, "FINANCIAL_CATEGORY_SYSTEM");
    }

    const activeEntries = await financialCategoryRepository.countActiveEntries(id);

    if (activeEntries > 0) {
      throw new AppError("Categoria com lancamentos ativos nao pode ser excluida.", 409, "FINANCIAL_CATEGORY_IN_USE");
    }

    return financialCategoryRepository.softDelete(id, userId);
  }
};
