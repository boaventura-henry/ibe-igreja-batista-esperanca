import { UserAccessRequestStatus } from "@prisma/client";
import { z } from "zod";
import { isValidCpf, normalizeLoginIdentifier, normalizeOptionalDigits, normalizeRg } from "@/utils";
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

  return normalizeOptionalDigits(value);
};

export const accessRequestCreateSchema = z
  .object({
    name: z.string().trim().min(2, "Informe seu nome completo."),
    email: z.preprocess(emptyToUndefined, z.email("Informe um e-mail valido.").trim().toLowerCase().optional()),
    phone: z.preprocess(digitsOnly, z.string().min(10, "Informe um telefone valido.").max(11, "Informe um telefone valido.")),
    cpf: z
      .preprocess(digitsOnly, z.string().length(11, "Informe um CPF valido.").optional())
      .refine((value) => !value || isValidCpf(value), "Informe um CPF valido."),
    rg: z.preprocess((value) => (typeof value === "string" ? normalizeRg(value) : value), z.string().max(30).optional()),
    birthDate: z.preprocess(emptyToUndefined, z.coerce.date({ message: "Informe sua data de nascimento." })),
    password: strongPasswordSchema,
    confirmPassword: z.string().min(1, "Confirme sua senha.")
  })
  .transform((data) => ({
    ...data,
    username: normalizeLoginIdentifier(data.phone)
  }))
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
