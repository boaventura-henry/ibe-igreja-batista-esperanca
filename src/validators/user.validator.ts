import { UserRole } from "@prisma/client";
import { z } from "zod";
import { usernameSchema } from "./auth.validator";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
};

export const strongPasswordSchema = z
  .string()
  .min(12, "A senha deve ter pelo menos 12 caracteres.")
  .regex(/[a-z]/, "A senha deve incluir uma letra minuscula.")
  .regex(/[A-Z]/, "A senha deve incluir uma letra maiuscula.")
  .regex(/[0-9]/, "A senha deve incluir um numero.")
  .regex(/[^A-Za-z0-9]/, "A senha deve incluir um simbolo.");

export const userCreateSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do usuario."),
  username: usernameSchema,
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
