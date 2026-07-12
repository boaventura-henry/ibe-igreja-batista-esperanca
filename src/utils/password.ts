import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const SALT_ROUNDS = 12;
const TEMPORARY_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%";

export function hashPassword(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function generateTemporaryPassword(length = 12) {
  const bytes = randomBytes(length);

  return Array.from(bytes, (byte) => TEMPORARY_PASSWORD_ALPHABET[byte % TEMPORARY_PASSWORD_ALPHABET.length]).join("");
}
