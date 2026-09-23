import { FinancialEntryStatus, Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { financialCategoryService } from "@/services/financial-category.service";
import { financialEntryRepository, type FinancialEntryRecord } from "@/repositories/financial-entry.repository";
import type { FinancialEntryListResult, FinancialEntrySummary } from "@/types";
import type { FinancialAuthorization } from "@/types";
import type { FinancialEntryCreateInput, FinancialEntryListQueryInput, FinancialEntryUpdateInput } from "@/validators";
import { getMemberDisplayName } from "@/utils";

const ENTRY_NUMBER_CREATE_ATTEMPTS = 3;

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

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

  const ministryChanged = data.ministryId !== undefined && data.ministryId !== current?.ministry?.id;
  if (data.ministryId && !(await financialEntryRepository.findMinistryById(data.ministryId, !current || ministryChanged))) {
    throw new AppError("Ministerio nao encontrado.", 404, "MINISTRY_NOT_FOUND");
  }
}

function isRecordNotFoundError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

async function runScopedMutation<T>(mutation: () => Promise<T>): Promise<T> {
  try {
    return await mutation();
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      throw new AppError("Lancamento financeiro nao encontrado.", 404, "FINANCIAL_ENTRY_NOT_FOUND");
    }
    throw error;
  }
}

function ensureDestinationAccess(ministryId: string | null | undefined, authorization: FinancialAuthorization) {
  if (authorization.accessContext.allMinistries) return;
  if (!ministryId || !authorization.accessContext.authorizedMinistryIds.includes(ministryId)) {
    throw new AppError("Voce nao tem permissao para este financeiro ministerial.", 403, "FINANCIAL_MINISTRY_FORBIDDEN");
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
  async list(filters: FinancialEntryListQueryInput, authorization: FinancialAuthorization): Promise<FinancialEntryListResult> {
    if (filters.ministryId) ensureDestinationAccess(filters.ministryId, authorization);
    const [result, categories, members, events, ministries] = await Promise.all([
      financialEntryRepository.list(filters, authorization.accessContext),
      financialCategoryService.listActive(),
      financialEntryRepository.listMembers(),
      financialEntryRepository.listEvents(),
      financialEntryRepository.listMinistries(authorization.accessContext)
    ]);

    return {
      entries: result.entries.map(serialize),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / filters.pageSize))
      },
      filters: { categories, members, events, ministries },
      scope: { allMinistries: authorization.accessContext.allMinistries }
    };
  },

  async getById(id: string, authorization: FinancialAuthorization) {
    const entry = await financialEntryRepository.findByIdWithinScope(id, authorization.accessContext);

    if (!entry) {
      throw new AppError("Lancamento financeiro nao encontrado.", 404, "FINANCIAL_ENTRY_NOT_FOUND");
    }

    return serialize(entry);
  },

  async create(data: FinancialEntryCreateInput, authorization: FinancialAuthorization) {
    ensureDestinationAccess(data.ministryId, authorization);
    ensureAnonymousRule(data);
    await ensureReferences(data);

    for (let attempt = 1; attempt <= ENTRY_NUMBER_CREATE_ATTEMPTS; attempt += 1) {
      const entryNumber = await financialEntryRepository.nextEntryNumber();

      try {
        return serialize(await financialEntryRepository.create(data, entryNumber, authorization.userId));
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error;
        }

        if (attempt === ENTRY_NUMBER_CREATE_ATTEMPTS) {
          throw new AppError("Nao foi possivel numerar o lancamento.", 409, "FINANCIAL_ENTRY_NUMBER_CONFLICT");
        }
      }
    }

    throw new AppError("Nao foi possivel criar o lancamento.", 409, "FINANCIAL_ENTRY_CREATE_CONFLICT");
  },

  async update(id: string, data: FinancialEntryUpdateInput, authorization: FinancialAuthorization) {
    const current = await this.getById(id, authorization);
    ensureDestinationAccess(data.ministryId === undefined ? current.ministry?.id : data.ministryId, authorization);
    ensureAnonymousRule(data, current);
    await ensureReferences(data, current);

    return serialize(await runScopedMutation(() => financialEntryRepository.update(id, data, authorization.userId, authorization.accessContext)));
  },

  async cancel(id: string, authorization: FinancialAuthorization) {
    const current = await this.getById(id, authorization);

    if (current.status === FinancialEntryStatus.CANCELED) {
      throw new AppError("Lancamento ja cancelado.", 409, "FINANCIAL_ENTRY_ALREADY_CANCELED");
    }

    return serialize(await runScopedMutation(() => financialEntryRepository.cancel(id, authorization.userId, authorization.accessContext)));
  },

  async remove(id: string, authorization: FinancialAuthorization) {
    await this.getById(id, authorization);

    return runScopedMutation(() => financialEntryRepository.softDelete(id, authorization.userId, authorization.accessContext));
  }
};
