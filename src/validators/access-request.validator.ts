import { UserAccessRequestStatus } from "@prisma/client";
import { z } from "zod";
import { usernameSchema } from "./auth.validator";
import { strongPasswordSchema } from "./user.validator";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
};

const digitsOnly = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const digits = value.replace(/\D/g, "");

  return digits.length > 0 ? digits : undefined;
};

export const accessRequestCreateSchema = z
  .object({
    name: z.string().trim().min(2, "Informe seu nome completo."),
    username: usernameSchema,
    email: z.email("Informe um e-mail valido.").trim().toLowerCase(),
    phone: z.preprocess(digitsOnly, z.string().min(10, "Informe um telefone valido.").max(11).optional()),
    cpf: z.preprocess(digitsOnly, z.string().length(11, "Informe um CPF valido.").optional()),
    birthDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    password: strongPasswordSchema,
    confirmPassword: z.string().min(1, "Confirme sua senha.")
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas nao conferem.",
    path: ["confirmPassword"]
  });

export const accessRequestListQuerySchema = z.object({
  search: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  status: z.enum(UserAccessRequestStatus).optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "name", "username", "email", "status"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(10)
});

export const accessRequestApproveSchema = z.object({
  memberId: z.string().cuid("Selecione um membro valido."),
  mustChangePassword: z.boolean().default(false)
});

export const accessRequestRejectSchema = z.object({
  reason: z.string().trim().min(3, "Informe o motivo da rejeicao.").max(500, "O motivo deve ter no maximo 500 caracteres.")
});

export type AccessRequestCreateInput = z.infer<typeof accessRequestCreateSchema>;
export type AccessRequestListQueryInput = z.infer<typeof accessRequestListQuerySchema>;
export type AccessRequestApproveInput = z.infer<typeof accessRequestApproveSchema>;
export type AccessRequestRejectInput = z.infer<typeof accessRequestRejectSchema>;
