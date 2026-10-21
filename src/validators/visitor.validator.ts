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

export const visitorPrivacyRecordSchema = z.object({
  noticeVersion: z.string().trim().min(1).max(64),
  channel: z.enum(VisitorPrivacyChannel)
});

export type VisitorCreateInput = z.infer<typeof visitorCreateSchema>;
export type VisitorUpdateInput = z.infer<typeof visitorUpdateSchema>;
export type VisitorIdentityInput = z.infer<typeof visitorIdentitySchema>;
export type VisitorPrivacyRecordInput = z.infer<typeof visitorPrivacyRecordSchema>;
