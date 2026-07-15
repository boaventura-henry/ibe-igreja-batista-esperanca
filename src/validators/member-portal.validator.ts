import { z } from "zod";
import { onlyDigits } from "@/utils";

const emptyToNull = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
};

const optionalText = z.preprocess(emptyToNull, z.string().trim().nullable().optional());
const optionalEmail = z.preprocess(
  emptyToNull,
  z.string().trim().email("Informe um e-mail valido.").toLowerCase().nullable().optional()
);

const optionalPhone = z.preprocess(
  emptyToNull,
  z
    .string()
    .transform((value) => onlyDigits(value))
    .refine((value) => value.length >= 10, "Informe um telefone valido.")
    .nullable()
    .optional()
);

const optionalCep = z.preprocess(
  emptyToNull,
  z
    .string()
    .transform((value) => onlyDigits(value))
    .refine((value) => value.length === 8, "Informe um CEP valido.")
    .nullable()
    .optional()
);

export const memberPortalUpdateProfileSchema = z.object({
  nickname: z.preprocess(emptyToNull, z.string().trim().max(80, "O apelido deve ter no maximo 80 caracteres.").nullable().optional()),
  phone: optionalPhone,
  mobilePhone: optionalPhone,
  whatsapp: optionalPhone,
  email: optionalEmail,
  zipCode: optionalCep,
  street: optionalText,
  number: optionalText,
  complement: optionalText,
  district: optionalText,
  city: optionalText,
  state: z.preprocess(
    emptyToNull,
    z.string().trim().length(2, "Use a sigla do estado.").toUpperCase().nullable().optional()
  )
});

export type MemberPortalUpdateProfileInput = z.infer<typeof memberPortalUpdateProfileSchema>;
