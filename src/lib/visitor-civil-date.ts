import { applicationDateInputValue } from "@/lib/application-time";

const CIVIL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseVisitorCivilDate(value: string, now = new Date()) {
  if (!CIVIL_DATE_PATTERN.test(value)) return null;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    value > applicationDateInputValue(now)
  ) {
    return null;
  }

  return date;
}

export function visitorCivilDate(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}
