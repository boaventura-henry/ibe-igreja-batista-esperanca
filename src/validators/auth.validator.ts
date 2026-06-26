import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Informe um email valido.").trim().toLowerCase(),
  password: z.string().min(8, "Informe uma senha com pelo menos 8 caracteres.")
});

const strongPasswordSchema = z
  .string()
  .min(12, "ADMIN_PASSWORD must have at least 12 characters.")
  .regex(/[a-z]/, "ADMIN_PASSWORD must include a lowercase letter.")
  .regex(/[A-Z]/, "ADMIN_PASSWORD must include an uppercase letter.")
  .regex(/[0-9]/, "ADMIN_PASSWORD must include a number.")
  .regex(/[^A-Za-z0-9]/, "ADMIN_PASSWORD must include a symbol.");

export const seedAdminSchema = z.object({
  name: z.string().trim().min(1, "ADMIN_NAME is required."),
  email: z.email("ADMIN_EMAIL must be a valid email.").trim().toLowerCase(),
  password: strongPasswordSchema
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SeedAdminInput = z.infer<typeof seedAdminSchema>;
