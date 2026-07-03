import { FinancialEntryType } from "@prisma/client";
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

const financialCategoryBaseSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da categoria."),
  description: z.preprocess(emptyToNull, z.string().trim().nullable().optional()),
  type: z.enum(FinancialEntryType),
  displayOrder: z.coerce.number().int().min(0, "A ordem deve ser maior ou igual a zero."),
  showInMemberPortal: z.boolean(),
  isActive: z.boolean()
});

export const financialCategoryCreateSchema = financialCategoryBaseSchema.extend({
  displayOrder: z.coerce.number().int().min(0, "A ordem deve ser maior ou igual a zero.").default(0),
  showInMemberPortal: z.boolean().default(false),
  isActive: z.boolean().default(true)
});

export const financialCategoryUpdateSchema = financialCategoryBaseSchema.partial();

export const financialCategoryListQuerySchema = z.object({
  search: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  type: z.preprocess(emptyToUndefined, z.enum(FinancialEntryType).optional()),
  isActive: z.preprocess(emptyToUndefined, z.coerce.boolean().optional()),
  showInMemberPortal: z.preprocess(emptyToUndefined, z.coerce.boolean().optional()),
  sortBy: z.enum(["name", "type", "displayOrder", "createdAt", "updatedAt"]).default("displayOrder"),
  sortDirection: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(10)
});

export type FinancialCategoryCreateInput = z.infer<typeof financialCategoryCreateSchema>;
export type FinancialCategoryUpdateInput = z.infer<typeof financialCategoryUpdateSchema>;
export type FinancialCategoryListQueryInput = z.infer<typeof financialCategoryListQuerySchema>;
