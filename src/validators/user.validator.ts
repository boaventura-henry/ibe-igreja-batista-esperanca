import { UserRole } from "@prisma/client";
import { z } from "zod";
import { isValidCpf, normalizeLoginIdentifier } from "@/utils";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
};

export const strongPasswordSchema = z
  .string()
  .min(6, "A senha deve ter pelo menos 6 caracteres.");

export const loginIdentifierSchema = z
  .string()
  .trim()
  .min(4, "Informe telefone ou CPF.")
  .max(30, "Informe telefone ou CPF valido.")
  .transform(normalizeLoginIdentifier)
  .refine((value) => {
    if (/^\d{11}$/.test(value) && !isValidCpf(value)) {
      return true;
    }

    return /^[A-Z0-9_.]+$/.test(value);
  }, "Informe telefone ou CPF valido.");

export const userCreateSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do usuario."),
  username: loginIdentifierSchema,
  email: z.email("Informe um e-mail valido.").trim().toLowerCase(),
  password: strongPasswordSchema,
  role: z.enum(UserRole).default(UserRole.LEADER),
  memberId: z.preprocess(emptyToUndefined, z.string().cuid().optional()),
  accessRoleId: z.string().cuid(),
  isActive: z.boolean().default(true),
  mustChangePassword: z.boolean().default(true)
});

export const userUpdateSchema = userCreateSchema.omit({ password: true }).partial().extend({
  accessRoleId: z.preprocess(emptyToUndefined, z.string().cuid().optional())
});

export const userResetPasswordSchema = z.object({
  password: strongPasswordSchema
});

export const userListQuerySchema = z.object({
  search: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  status: z.enum(["ACTIVE", "INACTIVE", "LOCKED", "MUST_CHANGE_PASSWORD"]).optional(),
  accessRoleId: z.preprocess(emptyToUndefined, z.string().cuid().optional()),
  sortBy: z
    .enum(["name", "username", "email", "createdAt", "updatedAt", "lastLoginAt", "failedLoginAttempts"])
    .default("name"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(10)
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type UserResetPasswordInput = z.infer<typeof userResetPasswordSchema>;
export type UserListQueryInput = z.infer<typeof userListQuerySchema>;
