import { z } from "zod";
import { normalizeUsername } from "@/utils";

export const usernameSchema = z
  .string()
  .trim()
  .min(4, "Informe um usuario com pelo menos 4 caracteres.")
  .max(30, "Informe um usuario com no maximo 30 caracteres.")
  .regex(/^[A-Za-z0-9_.]+$/, "Use apenas letras, numeros, ponto e underline.")
  .transform(normalizeUsername);

export const loginSchema = z.object({
  username: usernameSchema,
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
  username: usernameSchema,
  name: z.string().trim().min(1, "ADMIN_NAME is required."),
  email: z.email("ADMIN_EMAIL must be a valid email.").trim().toLowerCase(),
  password: strongPasswordSchema
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SeedAdminInput = z.infer<typeof seedAdminSchema>;
