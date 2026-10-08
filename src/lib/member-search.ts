export function normalizeMemberSearch(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function memberSearchMatches(query: string, fields: readonly (string | null | undefined)[]) {
  const normalizedQuery = normalizeMemberSearch(query);

  return !normalizedQuery || fields.some((field) => normalizeMemberSearch(field).includes(normalizedQuery));
}

export const memberLabelCollator = new Intl.Collator("pt-BR", { sensitivity: "base" });
