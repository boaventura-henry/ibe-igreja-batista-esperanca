import { z } from "zod";
import { permissionCodes } from "@/lib/permissions";

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
};

export const accessRoleCreateSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do perfil."),
  description: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  permissions: z.array(z.enum(permissionCodes)).default([]),
  isActive: z.boolean().default(true)
});

export const accessRoleUpdateSchema = accessRoleCreateSchema.partial().extend({
  confirmSystemChange: z.boolean().optional()
});

export type AccessRoleCreateInput = z.infer<typeof accessRoleCreateSchema>;
export type AccessRoleUpdateInput = z.infer<typeof accessRoleUpdateSchema>;
