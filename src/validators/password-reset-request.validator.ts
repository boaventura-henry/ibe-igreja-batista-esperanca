import { PasswordResetRequestStatus } from "@prisma/client";
import { z } from "zod";
import { isValidCpf, normalizeOptionalDigits } from "@/utils";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
};

export const passwordResetRequestCreateSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(10, "Informe telefone ou CPF.")
    .max(30, "Informe telefone ou CPF valido.")
    .transform((value) => normalizeOptionalDigits(value) ?? "")
    .refine((value) => value.length === 10 || value.length === 11, "Informe telefone ou CPF valido.")
    .refine((value) => value.length !== 11 || isValidCpf(value) || /^[1-9]{2}9?\d{8}$/.test(value), "Informe telefone ou CPF valido."),
  name: z.preprocess(emptyToUndefined, z.string().trim().min(2, "Informe seu nome.").optional()),
  email: z.preprocess(emptyToUndefined, z.email("Informe um e-mail valido.").trim().toLowerCase().optional()),
  phone: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  cpf: z.preprocess(emptyToUndefined, z.string().trim().optional())
});

export const passwordResetRequestListQuerySchema = z.object({
  search: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  status: z.enum(PasswordResetRequestStatus).optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "identifier", "status"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(10)
});

export const passwordResetRequestRejectSchema = z.object({
  reason: z.string().trim().min(3, "Informe o motivo da rejeicao.")
});

export type PasswordResetRequestCreateInput = z.infer<typeof passwordResetRequestCreateSchema>;
export type PasswordResetRequestListQueryInput = z.infer<typeof passwordResetRequestListQuerySchema>;
export type PasswordResetRequestRejectInput = z.infer<typeof passwordResetRequestRejectSchema>;
