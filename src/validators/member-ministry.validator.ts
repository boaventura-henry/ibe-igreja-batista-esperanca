import { MemberMinistryRole, MemberMinistryStatus } from "@prisma/client";
import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
};

const optionalText = z.preprocess(emptyToUndefined, z.string().trim().optional());
const optionalDate = z.preprocess(emptyToUndefined, z.string().date().optional());

function validateStatusAndDates<T extends { status?: MemberMinistryStatus; entryDate?: string; exitDate?: string }>(
  data: T,
  context: z.RefinementCtx
) {
  if (data.status === MemberMinistryStatus.ACTIVE && data.exitDate) {
    context.addIssue({
      code: "custom",
      path: ["exitDate"],
      message: "Vinculo ativo nao pode ter data de saida."
    });
  }

  if (data.status && data.status !== MemberMinistryStatus.ACTIVE && !data.exitDate) {
    context.addIssue({
      code: "custom",
      path: ["exitDate"],
      message: "Informe a data de saida para encerrar a participacao."
    });
  }

  if (data.entryDate && data.exitDate && data.exitDate < data.entryDate) {
    context.addIssue({
      code: "custom",
      path: ["exitDate"],
      message: "A data de saida nao pode ser anterior a data de entrada."
    });
  }
}

const memberMinistryBaseSchema = z.object({
  memberId: z.string().cuid("Informe um membro valido."),
  ministryId: z.string().cuid("Informe um ministerio valido."),
  role: z.enum(MemberMinistryRole).default(MemberMinistryRole.MEMBER),
  status: z.enum(MemberMinistryStatus).default(MemberMinistryStatus.ACTIVE),
  entryDate: z.string().date("Informe uma data de entrada valida."),
  exitDate: optionalDate,
  observations: optionalText
});

export const memberMinistryCreateSchema = memberMinistryBaseSchema.superRefine(validateStatusAndDates);

export const memberMinistryUpdateSchema = memberMinistryBaseSchema.partial().superRefine(validateStatusAndDates);

export const memberMinistryListQuerySchema = z.object({
  memberId: z.preprocess(emptyToUndefined, z.string().cuid().optional()),
  ministryId: z.preprocess(emptyToUndefined, z.string().cuid().optional()),
  status: z.enum(MemberMinistryStatus).optional(),
  role: z.enum(MemberMinistryRole).optional(),
  activeOnly: z.preprocess((value) => value === "true" || value === true, z.boolean().optional()),
  search: optionalText,
  sortBy: z
    .enum(["memberName", "ministryName", "role", "status", "entryDate", "exitDate", "createdAt", "updatedAt"])
    .default("entryDate"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(10)
});

export type MemberMinistryCreateInput = z.infer<typeof memberMinistryCreateSchema>;
export type MemberMinistryUpdateInput = z.infer<typeof memberMinistryUpdateSchema>;
export type MemberMinistryListQueryInput = z.infer<typeof memberMinistryListQuerySchema>;
