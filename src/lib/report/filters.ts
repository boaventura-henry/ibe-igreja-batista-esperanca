export function parseDate(value: string | null | undefined) {
  return value ? new Date(`${value}T00:00:00.000Z`) : undefined;
}

export function endOfDate(value: string | null | undefined) {
  return value ? new Date(`${value}T23:59:59.999Z`) : undefined;
}
