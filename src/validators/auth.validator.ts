import { z } from "zod";
import { normalizeLoginIdentifier, normalizeUsername } from "@/utils";

export const usernameSchema = z
  .string()
  .trim()
  .min(4, "Informe um usuario com pelo menos 4 caracteres.")
  .max(30, "Informe um usuario com no maximo 30 caracteres.")
  .regex(/^[A-Za-z0-9_.]+$/, "Use apenas letras, numeros, ponto e underline.")
  .transform(normalizeUsername);

export const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(4, "Informe telefone ou CPF.")
    .max(30, "Informe telefone ou CPF valido.")
    .transform(normalizeLoginIdentifier),
  password: z.string().min(6, "Informe uma senha com pelo menos 6 caracteres.")
});

const strongPasswordSchema = z
  .string()
  .min(6, "ADMIN_PASSWORD must have at least 6 characters.");

export const seedAdminSchema = z.object({
  username: usernameSchema,
  name: z.string().trim().min(1, "ADMIN_NAME is required."),
  email: z.email("ADMIN_EMAIL must be a valid email.").trim().toLowerCase(),
  password: strongPasswordSchema
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SeedAdminInput = z.infer<typeof seedAdminSchema>;
