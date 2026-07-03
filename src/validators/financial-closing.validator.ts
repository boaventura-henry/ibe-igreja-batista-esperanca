import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
};

const emptyToNull = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
};

export const financialClosingCreateSchema = z.object({
  date: z.coerce.date({ message: "Informe a data do fechamento." }),
  openingBalance: z.coerce.number(),
  closingBalance: z.coerce.number(),
  observation: z.preprocess(emptyToNull, z.string().trim().nullable().optional())
});

export const financialClosingUpdateSchema = financialClosingCreateSchema.partial();

export const financialClosingListQuerySchema = z.object({
  search: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  startDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  endDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  sortBy: z.enum(["date", "openingBalance", "closingBalance", "createdAt", "updatedAt"]).default("date"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(10)
});

export type FinancialClosingCreateInput = z.infer<typeof financialClosingCreateSchema>;
export type FinancialClosingUpdateInput = z.infer<typeof financialClosingUpdateSchema>;
export type FinancialClosingListQueryInput = z.infer<typeof financialClosingListQuerySchema>;
