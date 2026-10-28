import { VisitorPrivacyChannel, VisitorStatus } from "@prisma/client";
import { z } from "zod";
import { parseVisitorCivilDate } from "@/lib/visitor-civil-date";
import { onlyDigits } from "@/utils";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const optionalText = (max: number) => z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());
const optionalAdminText = (max: number) => z
  .union([z.string().trim().max(max), z.null()])
  .optional()
  .transform((value) => value === "" ? null : value);

export const visitorPhoneSchema = z
  .string()
  .trim()
  .min(1, "Informe um telefone.")
  .refine((value) => /^[\d\s()+-]+$/.test(value), "Informe um telefone brasileiro valido.")
  .transform((value) => onlyDigits(value))
  .refine((value) => value.length === 10 || value.length === 11, "Informe um telefone brasileiro com 10 ou 11 digitos.");

export const visitorBirthDateSchema = z
  .string()
  .refine((value) => parseVisitorCivilDate(value) !== null, "Informe uma data de nascimento valida e nao futura.")
  .transform((value) => parseVisitorCivilDate(value)!);

export const visitorIdentitySchema = z.object({
  phone: visitorPhoneSchema,
  birthDate: visitorBirthDateSchema
});

const visitorAddressSchema = {
  street: optionalText(160),
  number: optionalText(40),
  complement: optionalText(120),
  district: optionalText(120),
  city: optionalText(120),
  state: z.preprocess(emptyToUndefined, z.string().trim().length(2).transform((value) => value.toUpperCase()).optional())
};

export const visitorCreateSchema = visitorIdentitySchema.extend({
  name: z.string().trim().min(3, "Informe o nome do visitante.").max(160),
  ...visitorAddressSchema,
  status: z.enum(VisitorStatus).default(VisitorStatus.ACTIVE)
});

export const visitorUpdateSchema = visitorCreateSchema.partial().extend({
  status: z.enum(VisitorStatus).optional()
});

const visitorAdminFields = {
  name: z.string().trim().min(3, "Informe o nome do visitante.").max(160),
  phone: visitorPhoneSchema,
  birthDate: visitorBirthDateSchema,
  street: optionalAdminText(160),
  number: optionalAdminText(40),
  complement: optionalAdminText(120),
  district: optionalAdminText(120),
  city: optionalAdminText(120),
  state: z
    .union([z.string().trim().length(2).transform((value) => value.toUpperCase()), z.literal(""), z.null()])
    .optional()
    .transform((value) => value === "" ? null : value),
  status: z.enum([VisitorStatus.ACTIVE, VisitorStatus.INACTIVE])
};

export const visitorAdminUpdateSchema = z
  .object(visitorAdminFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo para atualizar.");

export const visitorListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(5).max(100).default(20),
    search: z.preprocess(emptyToUndefined, z.string().trim().max(160).optional()),
    status: z.enum(VisitorStatus).optional(),
    sortBy: z.enum(["name", "createdAt", "updatedAt"]).default("name"),
    sortOrder: z.enum(["asc", "desc"]).default("asc")
  })
  .strict();

export const visitorPrivacyRecordSchema = z.object({
  noticeVersion: z.string().trim().min(1).max(64),
  channel: z.enum(VisitorPrivacyChannel)
});

export type VisitorCreateInput = z.infer<typeof visitorCreateSchema>;
export type VisitorUpdateInput = z.infer<typeof visitorUpdateSchema>;
export type VisitorAdminUpdateInput = z.infer<typeof visitorAdminUpdateSchema>;
export type VisitorIdentityInput = z.infer<typeof visitorIdentitySchema>;
export type VisitorPrivacyRecordInput = z.infer<typeof visitorPrivacyRecordSchema>;
export type VisitorListQueryInput = z.infer<typeof visitorListQuerySchema>;
