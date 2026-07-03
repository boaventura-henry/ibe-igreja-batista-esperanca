import {
  FinancialEntryOrigin,
  FinancialEntryStatus,
  FinancialEntryType,
  FinancialPaymentMethod
} from "@prisma/client";
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

const optionalCuid = z.preprocess(emptyToNull, z.string().cuid().nullable().optional());
const optionalFilterCuid = z.preprocess(emptyToUndefined, z.string().cuid().optional());

const financialEntryBaseSchema = z.object({
  type: z.enum(FinancialEntryType),
  memberId: optionalCuid,
  categoryId: z.string().cuid("Informe a categoria."),
  eventId: optionalCuid,
  ministryId: optionalCuid,
  amount: z.coerce.number().positive("O valor deve ser maior que zero."),
  paymentMethod: z.enum(FinancialPaymentMethod),
  status: z.enum(FinancialEntryStatus),
  origin: z.enum(FinancialEntryOrigin),
  anonymous: z.boolean(),
  launchDate: z.coerce.date({ message: "Informe a data do lancamento." }),
  referenceDate: z.coerce.date({ message: "Informe a data de referencia." }),
  observation: z.preprocess(emptyToNull, z.string().trim().nullable().optional())
});

function validateMemberVisibility(data: { anonymous?: boolean; memberId?: string | null }, context: z.RefinementCtx) {
  if (data.anonymous && data.memberId) {
    context.addIssue({
      code: "custom",
      message: "Lancamento anonimo nao pode estar vinculado a membro.",
      path: ["memberId"]
    });
  }
}

export const financialEntryCreateSchema = financialEntryBaseSchema.extend({
  paymentMethod: z.enum(FinancialPaymentMethod).default(FinancialPaymentMethod.OTHER),
  status: z.enum(FinancialEntryStatus).default(FinancialEntryStatus.CONFIRMED),
  origin: z.enum(FinancialEntryOrigin).default(FinancialEntryOrigin.MANUAL),
  anonymous: z.boolean().default(false)
}).superRefine(validateMemberVisibility);

export const financialEntryUpdateSchema = financialEntryBaseSchema.partial().superRefine(validateMemberVisibility);

export const financialEntryListQuerySchema = z.object({
  search: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  type: z.preprocess(emptyToUndefined, z.enum(FinancialEntryType).optional()),
  status: z.preprocess(emptyToUndefined, z.enum(FinancialEntryStatus).optional()),
  paymentMethod: z.preprocess(emptyToUndefined, z.enum(FinancialPaymentMethod).optional()),
  categoryId: optionalFilterCuid,
  memberId: optionalFilterCuid,
  eventId: optionalFilterCuid,
  ministryId: optionalFilterCuid,
  startDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  endDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  sortBy: z.enum(["entryNumber", "launchDate", "referenceDate", "amount", "createdAt", "updatedAt"]).default("launchDate"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(10)
});

export type FinancialEntryCreateInput = z.infer<typeof financialEntryCreateSchema>;
export type FinancialEntryUpdateInput = z.infer<typeof financialEntryUpdateSchema>;
export type FinancialEntryListQueryInput = z.infer<typeof financialEntryListQuerySchema>;
