import { MemberSex, MemberStatus } from "@prisma/client";
import { z } from "zod";
import { onlyDigits } from "@/utils";
import { isSafeExternalUrl } from "@/utils/url";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
};

const emptyToNull = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const optionalText = z.preprocess(emptyToUndefined, z.string().trim().optional());
const optionalUrl = z.preprocess(
  emptyToUndefined,
  z.string().trim().max(2048).refine(isSafeExternalUrl, "Informe uma URL HTTP ou HTTPS valida.").optional()
);
const optionalEmail = z.preprocess(
  emptyToUndefined,
  z.string().trim().email("Informe um e-mail valido.").optional()
);
const optionalDate = z.preprocess(emptyToUndefined, z.string().date().optional());

function isValidCpf(value: string) {
  const cpf = onlyDigits(value);

  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) {
    return false;
  }

  const calculateDigit = (base: string, factor: number) => {
    const total = base
      .split("")
      .reduce((sum, digit) => sum + Number(digit) * factor--, 0);
    const rest = (total * 10) % 11;

    return rest === 10 ? 0 : rest;
  };

  return (
    calculateDigit(cpf.slice(0, 9), 10) === Number(cpf[9]) &&
    calculateDigit(cpf.slice(0, 10), 11) === Number(cpf[10])
  );
}

const cpfSchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .transform((value) => onlyDigits(value))
    .refine((value) => value.length === 11, "Informe um CPF com 11 digitos.")
    .refine(isValidCpf, "Informe um CPF valido.")
    .optional()
);

const phoneSchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .transform((value) => onlyDigits(value))
    .refine((value) => value.length >= 10, "Informe um telefone valido.")
    .optional()
);

const cepSchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .transform((value) => onlyDigits(value))
    .refine((value) => value.length === 8, "Informe um CEP valido.")
    .optional()
);

export const memberCreateSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome completo."),
  nickname: z.preprocess(emptyToNull, z.string().trim().max(80, "O apelido deve ter no maximo 80 caracteres.").nullable().optional()),
  cpf: cpfSchema,
  rg: optionalText,
  birthDate: optionalDate,
  sex: z.enum(MemberSex).default(MemberSex.NOT_INFORMED),
  maritalStatus: optionalText,
  phone: phoneSchema,
  mobilePhone: phoneSchema,
  whatsapp: phoneSchema,
  email: optionalEmail,
  zipCode: cepSchema,
  street: optionalText,
  number: optionalText,
  complement: optionalText,
  district: optionalText,
  city: optionalText,
  state: z.preprocess(
    emptyToUndefined,
    z.string().trim().length(2, "Use a sigla do estado.").toUpperCase().optional()
  ),
  baptismDate: optionalDate,
  joinedAt: optionalDate,
  status: z.enum(MemberStatus).default(MemberStatus.ACTIVE),
  notes: optionalText,
  photoUrl: optionalUrl,
  ministryIds: z.array(z.string().cuid()).default([])
});

export const memberUpdateSchema = memberCreateSchema.partial().extend({
  ministryIds: z.array(z.string().cuid()).optional()
});

export const memberListQuerySchema = z.object({
  search: optionalText,
  name: optionalText,
  cpf: z.preprocess(emptyToUndefined, z.string().transform((value) => onlyDigits(value)).optional()),
  city: optionalText,
  status: z.enum(MemberStatus).optional(),
  ministryId: z.preprocess(emptyToUndefined, z.string().cuid().optional()),
  sortBy: z
    .enum(["name", "createdAt", "updatedAt", "joinedAt", "city", "status"])
    .default("name"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(10)
});

export type MemberCreateInput = z.infer<typeof memberCreateSchema>;
export type MemberUpdateInput = z.infer<typeof memberUpdateSchema>;
export type MemberListQueryInput = z.infer<typeof memberListQuerySchema>;
