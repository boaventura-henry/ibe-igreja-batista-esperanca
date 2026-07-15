import { FinancialEntryStatus, FinancialEntryType, type Prisma } from "@prisma/client";
import { prisma } from "@/prisma/client";
import type { FinancialEntryCreateInput, FinancialEntryListQueryInput, FinancialEntryUpdateInput } from "@/validators";

const financialEntrySelect = {
  id: true,
  entryNumber: true,
  type: true,
  member: { select: { id: true, name: true, nickname: true } },
  category: {
    select: {
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
    }
  },
  event: { select: { id: true, title: true } },
  ministry: { select: { id: true, name: true } },
  amount: true,
  paymentMethod: true,
  status: true,
  origin: true,
  anonymous: true,
  launchDate: true,
  referenceDate: true,
  observation: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.FinancialEntrySelect;

export type FinancialEntryRecord = Prisma.FinancialEntryGetPayload<{ select: typeof financialEntrySelect }>;

function dateOnly(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function buildWhere(filters: FinancialEntryListQueryInput): Prisma.FinancialEntryWhereInput {
  const and: Prisma.FinancialEntryWhereInput[] = [{ deletedAt: null }];

  if (filters.search) {
    const number = Number(filters.search);
    and.push({
      OR: [
        Number.isFinite(number) ? { entryNumber: number } : {},
        { observation: { contains: filters.search, mode: "insensitive" } },
        { category: { name: { contains: filters.search, mode: "insensitive" } } },
        { member: { name: { contains: filters.search, mode: "insensitive" } } },
        { member: { nickname: { contains: filters.search, mode: "insensitive" } } },
        { ministry: { name: { contains: filters.search, mode: "insensitive" } } },
        { event: { title: { contains: filters.search, mode: "insensitive" } } }
      ]
    });
  }

  if (filters.type) and.push({ type: filters.type });
  if (filters.status) and.push({ status: filters.status });
  if (filters.paymentMethod) and.push({ paymentMethod: filters.paymentMethod });
  if (filters.categoryId) and.push({ categoryId: filters.categoryId });
  if (filters.memberId) and.push({ memberId: filters.memberId });
  if (filters.eventId) and.push({ eventId: filters.eventId });
  if (filters.ministryId) and.push({ ministryId: filters.ministryId });
  if (filters.startDate) and.push({ launchDate: { gte: dateOnly(filters.startDate) } });
  if (filters.endDate) and.push({ launchDate: { lte: dateOnly(filters.endDate) } });

  return { AND: and };
}

function createData(data: FinancialEntryCreateInput, entryNumber: number, userId: string): Prisma.FinancialEntryUncheckedCreateInput {
  return {
    ...data,
    entryNumber,
    memberId: data.anonymous ? null : data.memberId,
    launchDate: dateOnly(data.launchDate),
    referenceDate: dateOnly(data.referenceDate),
    createdById: userId,
    updatedById: userId
  };
}

function updateData(data: FinancialEntryUpdateInput): Prisma.FinancialEntryUncheckedUpdateInput {
  return {
    ...data,
    memberId: data.anonymous ? null : data.memberId,
    launchDate: data.launchDate ? dateOnly(data.launchDate) : undefined,
    referenceDate: data.referenceDate ? dateOnly(data.referenceDate) : undefined
  };
}

export const financialEntryRepository = {
  async list(filters: FinancialEntryListQueryInput) {
    const where = buildWhere(filters);
    const skip = (filters.page - 1) * filters.pageSize;
    const orderBy = { [filters.sortBy]: filters.sortDirection } satisfies Prisma.FinancialEntryOrderByWithRelationInput;

    const [entries, total] = await prisma.$transaction([
      prisma.financialEntry.findMany({ where, select: financialEntrySelect, orderBy, skip, take: filters.pageSize }),
      prisma.financialEntry.count({ where })
    ]);

    return { entries, total };
  },

  findById(id: string) {
    return prisma.financialEntry.findFirst({ where: { id, deletedAt: null }, select: financialEntrySelect });
  },

  async nextEntryNumber() {
    const last = await prisma.financialEntry.findFirst({ orderBy: { entryNumber: "desc" }, select: { entryNumber: true } });
    return (last?.entryNumber ?? 0) + 1;
  },

  findCategoryById(id: string) {
    return prisma.financialCategory.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, type: true, isActive: true, showInMemberPortal: true }
    });
  },

  findMemberById(id: string) {
    return prisma.member.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
  },

  findEventById(id: string) {
    return prisma.event.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
  },

  findMinistryById(id: string) {
    return prisma.ministry.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
  },

  create(data: FinancialEntryCreateInput, entryNumber: number, userId: string) {
    return prisma.financialEntry.create({ data: createData(data, entryNumber, userId), select: financialEntrySelect });
  },

  update(id: string, data: FinancialEntryUpdateInput, userId: string) {
    return prisma.financialEntry.update({
      where: { id },
      data: { ...updateData(data), updatedById: userId },
      select: financialEntrySelect
    });
  },

  cancel(id: string, userId: string) {
    return prisma.financialEntry.update({
      where: { id },
      data: { status: FinancialEntryStatus.CANCELED, updatedById: userId },
      select: financialEntrySelect
    });
  },

  softDelete(id: string, userId: string) {
    return prisma.financialEntry.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: userId },
      select: { id: true, deletedAt: true }
    });
  },

  listMembers() {
    return prisma.member.findMany({ where: { deletedAt: null }, select: { id: true, name: true, nickname: true }, orderBy: { name: "asc" } });
  },

  listEvents() {
    return prisma.event.findMany({ where: { deletedAt: null }, select: { id: true, title: true }, orderBy: { startDate: "desc" }, take: 100 });
  },

  listMinistries() {
    return prisma.ministry.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  },

  listPortalContributions(memberId: string) {
    return prisma.financialEntry.findMany({
      where: {
        memberId,
        type: FinancialEntryType.INCOME,
        status: FinancialEntryStatus.CONFIRMED,
        anonymous: false,
        deletedAt: null,
        category: { deletedAt: null, showInMemberPortal: true }
      },
      select: financialEntrySelect,
      orderBy: [{ launchDate: "desc" }, { entryNumber: "desc" }]
    });
  }
};
