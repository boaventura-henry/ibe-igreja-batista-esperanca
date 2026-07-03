import type { Prisma } from "@prisma/client";
import { prisma } from "@/prisma/client";
import type {
  FinancialClosingCreateInput,
  FinancialClosingListQueryInput,
  FinancialClosingUpdateInput
} from "@/validators";

const financialClosingSelect = {
  id: true,
  date: true,
  openingBalance: true,
  closingBalance: true,
  observation: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.FinancialClosingSelect;

export type FinancialClosingRecord = Prisma.FinancialClosingGetPayload<{ select: typeof financialClosingSelect }>;

function dateOnly(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function buildWhere(filters: FinancialClosingListQueryInput): Prisma.FinancialClosingWhereInput {
  const and: Prisma.FinancialClosingWhereInput[] = [{ deletedAt: null }];

  if (filters.search) {
    and.push({ observation: { contains: filters.search, mode: "insensitive" } });
  }

  if (filters.startDate) and.push({ date: { gte: dateOnly(filters.startDate) } });
  if (filters.endDate) and.push({ date: { lte: dateOnly(filters.endDate) } });

  return { AND: and };
}

export const financialClosingRepository = {
  async list(filters: FinancialClosingListQueryInput) {
    const where = buildWhere(filters);
    const skip = (filters.page - 1) * filters.pageSize;
    const orderBy = { [filters.sortBy]: filters.sortDirection } satisfies Prisma.FinancialClosingOrderByWithRelationInput;

    const [closings, total] = await prisma.$transaction([
      prisma.financialClosing.findMany({ where, select: financialClosingSelect, orderBy, skip, take: filters.pageSize }),
      prisma.financialClosing.count({ where })
    ]);

    return { closings, total };
  },

  findById(id: string) {
    return prisma.financialClosing.findFirst({ where: { id, deletedAt: null }, select: financialClosingSelect });
  },

  findByDate(date: Date) {
    return prisma.financialClosing.findUnique({ where: { date: dateOnly(date) }, select: { id: true, deletedAt: true } });
  },

  create(data: FinancialClosingCreateInput, userId: string) {
    return prisma.financialClosing.create({
      data: {
        ...data,
        date: dateOnly(data.date),
        openedById: userId,
        closedById: userId
      },
      select: financialClosingSelect
    });
  },

  update(id: string, data: FinancialClosingUpdateInput, userId: string) {
    return prisma.financialClosing.update({
      where: { id },
      data: {
        ...data,
        date: data.date ? dateOnly(data.date) : undefined,
        closedById: userId
      },
      select: financialClosingSelect
    });
  },

  softDelete(id: string) {
    return prisma.financialClosing.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: { id: true, deletedAt: true }
    });
  }
};
