import { FinancialEntryStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { financialCategoryService } from "@/services/financial-category.service";
import { financialEntryRepository, type FinancialEntryRecord } from "@/repositories/financial-entry.repository";
import type { FinancialEntryListResult, FinancialEntrySummary } from "@/types";
import type { FinancialEntryCreateInput, FinancialEntryListQueryInput, FinancialEntryUpdateInput } from "@/validators";
import { getMemberDisplayName } from "@/utils";

function serialize(entry: FinancialEntryRecord): FinancialEntrySummary {
  return {
    ...entry,
    member: entry.member ? { ...entry.member, displayName: getMemberDisplayName(entry.member) } : null,
    amount: entry.amount.toString(),
    category: {
      ...entry.category,
      createdAt: entry.category.createdAt.toISOString(),
      updatedAt: entry.category.updatedAt.toISOString()
    },
    launchDate: entry.launchDate.toISOString(),
    referenceDate: entry.referenceDate.toISOString(),
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString()
  };
}

async function ensureReferences(data: FinancialEntryCreateInput | FinancialEntryUpdateInput, current?: FinancialEntrySummary) {
  const categoryId = data.categoryId ?? current?.category.id;
  const entryType = data.type ?? current?.type;

  if (categoryId) {
    const category = await financialEntryRepository.findCategoryById(categoryId);

    if (!category) {
      throw new AppError("Categoria financeira nao encontrada.", 404, "FINANCIAL_CATEGORY_NOT_FOUND");
    }

    if (!category.isActive) {
      throw new AppError("Categoria financeira inativa nao pode receber lancamento.", 409, "FINANCIAL_CATEGORY_INACTIVE");
    }

    if (entryType && entryType !== category.type) {
      throw new AppError("Tipo do lancamento deve ser igual ao tipo da categoria.", 400, "FINANCIAL_ENTRY_TYPE_MISMATCH");
    }
  }

  if (data.memberId && !(await financialEntryRepository.findMemberById(data.memberId))) {
    throw new AppError("Membro nao encontrado.", 404, "MEMBER_NOT_FOUND");
  }

  if (data.eventId && !(await financialEntryRepository.findEventById(data.eventId))) {
    throw new AppError("Evento nao encontrado.", 404, "EVENT_NOT_FOUND");
  }

  if (data.ministryId && !(await financialEntryRepository.findMinistryById(data.ministryId))) {
    throw new AppError("Ministerio nao encontrado.", 404, "MINISTRY_NOT_FOUND");
  }
}

function ensureAnonymousRule(data: FinancialEntryCreateInput | FinancialEntryUpdateInput, current?: FinancialEntrySummary) {
  const anonymous = data.anonymous ?? current?.anonymous ?? false;
  const memberId = data.memberId === undefined ? current?.member?.id ?? null : data.memberId;

  if (anonymous && memberId) {
    throw new AppError("Lancamento anonimo nao pode estar vinculado a membro.", 400, "FINANCIAL_ENTRY_ANONYMOUS_MEMBER");
  }
}

export const financialEntryService = {
  async list(filters: FinancialEntryListQueryInput): Promise<FinancialEntryListResult> {
    const [result, categories, members, events, ministries] = await Promise.all([
      financialEntryRepository.list(filters),
      financialCategoryService.listActive(),
      financialEntryRepository.listMembers(),
      financialEntryRepository.listEvents(),
      financialEntryRepository.listMinistries()
    ]);

    return {
      entries: result.entries.map(serialize),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / filters.pageSize))
      },
      filters: { categories, members, events, ministries }
    };
  },

  async getById(id: string) {
    const entry = await financialEntryRepository.findById(id);

    if (!entry) {
      throw new AppError("Lancamento financeiro nao encontrado.", 404, "FINANCIAL_ENTRY_NOT_FOUND");
    }

    return serialize(entry);
  },

  async create(data: FinancialEntryCreateInput, userId: string) {
    ensureAnonymousRule(data);
    await ensureReferences(data);
    const entryNumber = await financialEntryRepository.nextEntryNumber();

    return serialize(await financialEntryRepository.create(data, entryNumber, userId));
  },

  async update(id: string, data: FinancialEntryUpdateInput, userId: string) {
    const current = await this.getById(id);
    ensureAnonymousRule(data, current);
    await ensureReferences(data, current);

    return serialize(await financialEntryRepository.update(id, data, userId));
  },

  async cancel(id: string, userId: string) {
    const current = await this.getById(id);

    if (current.status === FinancialEntryStatus.CANCELED) {
      throw new AppError("Lancamento ja cancelado.", 409, "FINANCIAL_ENTRY_ALREADY_CANCELED");
    }

    return serialize(await financialEntryRepository.cancel(id, userId));
  },

  async remove(id: string, userId: string) {
    await this.getById(id);

    return financialEntryRepository.softDelete(id, userId);
  }
};
