import { onlyDigits } from "./member-format";

export function normalizeLoginIdentifier(value: string) {
  const trimmed = value.trim();
  const digits = onlyDigits(trimmed);

  return digits.length >= 10 ? digits : trimmed.toUpperCase();
}

export function normalizeOptionalDigits(value: string | null | undefined) {
  const digits = onlyDigits(value);

  return digits.length > 0 ? digits : undefined;
}

export function normalizeRg(value: string | null | undefined) {
  const normalized = value?.trim().replace(/\s+/g, " ").toUpperCase() ?? "";

  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeNameForMatch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

export function isValidCpf(value: string | null | undefined) {
  const cpf = onlyDigits(value);

  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  const calculateDigit = (base: string, factor: number) => {
    const total = base
      .split("")
      .reduce((sum, digit) => sum + Number(digit) * factor--, 0);
    const remainder = (total * 10) % 11;

    return remainder === 10 ? 0 : remainder;
  };

  const firstDigit = calculateDigit(cpf.slice(0, 9), 10);
  const secondDigit = calculateDigit(cpf.slice(0, 10), 11);

  return firstDigit === Number(cpf[9]) && secondDigit === Number(cpf[10]);
}

export function buildFallbackEmail(identifier: string) {
  return `${identifier.toLowerCase()}@ibe.local`;
}
