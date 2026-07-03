import type { Prisma } from "@prisma/client";
import { prisma } from "@/prisma/client";
import type {
  FinancialCategoryCreateInput,
  FinancialCategoryListQueryInput,
  FinancialCategoryUpdateInput
} from "@/validators";

const financialCategorySelect = {
  id: true,
  name: true,
  description: true,
  type: true,
  displayOrder: true,
  showInMemberPortal: true,
  isSystem: true,
  isActive: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.FinancialCategorySelect;

export type FinancialCategoryRecord = Prisma.FinancialCategoryGetPayload<{ select: typeof financialCategorySelect }>;

function buildWhere(filters: FinancialCategoryListQueryInput): Prisma.FinancialCategoryWhereInput {
  const and: Prisma.FinancialCategoryWhereInput[] = [{ deletedAt: null }];

  if (filters.search) {
    and.push({
      OR: [
        { name: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } }
      ]
    });
  }

  if (filters.type) {
    and.push({ type: filters.type });
  }

  if (filters.isActive !== undefined) {
    and.push({ isActive: filters.isActive });
  }

  if (filters.showInMemberPortal !== undefined) {
    and.push({ showInMemberPortal: filters.showInMemberPortal });
  }

  return { AND: and };
}

export const financialCategoryRepository = {
  async list(filters: FinancialCategoryListQueryInput) {
    const where = buildWhere(filters);
    const skip = (filters.page - 1) * filters.pageSize;
    const orderBy = { [filters.sortBy]: filters.sortDirection } satisfies Prisma.FinancialCategoryOrderByWithRelationInput;

    const [categories, total] = await prisma.$transaction([
      prisma.financialCategory.findMany({ where, select: financialCategorySelect, orderBy, skip, take: filters.pageSize }),
      prisma.financialCategory.count({ where })
    ]);

    return { categories, total };
  },

  findById(id: string) {
    return prisma.financialCategory.findFirst({
      where: { id, deletedAt: null },
      select: financialCategorySelect
    });
  },

  findByNameAndType(name: string, type: FinancialCategoryCreateInput["type"]) {
    return prisma.financialCategory.findUnique({
      where: { name_type: { name, type } },
      select: { id: true }
    });
  },

  countActiveEntries(id: string) {
    return prisma.financialEntry.count({
      where: { categoryId: id, deletedAt: null }
    });
  },

  create(data: FinancialCategoryCreateInput, userId: string) {
    return prisma.financialCategory.create({
      data: {
        ...data,
        createdById: userId,
        updatedById: userId
      },
      select: financialCategorySelect
    });
  },

  update(id: string, data: FinancialCategoryUpdateInput, userId: string) {
    return prisma.financialCategory.update({
      where: { id },
      data: {
        ...data,
        updatedById: userId
      },
      select: financialCategorySelect
    });
  },

  softDelete(id: string, userId: string) {
    return prisma.financialCategory.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
        updatedById: userId
      },
      select: { id: true, deletedAt: true }
    });
  },

  listActive() {
    return prisma.financialCategory.findMany({
      where: { deletedAt: null, isActive: true },
      select: financialCategorySelect,
      orderBy: [{ type: "asc" }, { displayOrder: "asc" }, { name: "asc" }]
    });
  }
};
