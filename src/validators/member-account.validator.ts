import { z } from "zod";
import { onlyDigits } from "@/utils";

const emptyToNull = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
};

const optionalPhone = z.preprocess(
  emptyToNull,
  z
    .string()
    .transform((value) => onlyDigits(value))
    .refine((value) => value.length >= 10 && value.length <= 11, "Informe um telefone valido.")
    .nullable()
    .optional()
);

const optionalEmail = z.preprocess(
  emptyToNull,
  z.string().trim().email("Informe um e-mail valido.").toLowerCase().nullable().optional()
);

export const memberAccountUpdateSchema = z
  .object({
    phone: optionalPhone,
    email: optionalEmail
  })
  .strict();

export const memberAccountChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual."),
    newPassword: z.string().min(6, "A nova senha deve ter pelo menos 6 caracteres."),
    confirmPassword: z.string().min(1, "Confirme a nova senha.")
  })
  .strict()
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "A confirmacao da senha nao corresponde.",
    path: ["confirmPassword"]
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "A nova senha deve ser diferente da senha atual.",
    path: ["newPassword"]
  });

export type MemberAccountUpdateInput = z.infer<typeof memberAccountUpdateSchema>;
export type MemberAccountChangePasswordInput = z.infer<typeof memberAccountChangePasswordSchema>;
