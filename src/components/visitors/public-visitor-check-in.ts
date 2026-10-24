export type VisitorPrivacyNoticePublic = {
  version: string;
  status: "DRAFT" | "APPROVED";
  text: string | null;
};

export type VisitorAddressForm = {
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
};

export function isPublicVisitorRegistrationAvailable(notice: VisitorPrivacyNoticePublic) {
  return notice.status === "APPROVED" && Boolean(notice.text?.trim());
}

export function optionalAddress(address: VisitorAddressForm) {
  const entries = Object.entries(address).map(([key, value]) => [key, value.trim() || undefined]);
  const result = Object.fromEntries(entries) as Partial<VisitorAddressForm>;
  return Object.values(result).some(Boolean) ? result : undefined;
}

export function visitorRequestError(status: number, code?: string, retryAfter?: string | null) {
  if (status === 429) {
    const seconds = Number(retryAfter);
    return Number.isSafeInteger(seconds) && seconds > 0
      ? `Muitas tentativas. Aguarde cerca de ${seconds} segundos antes de tentar novamente.`
      : "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.";
  }
  if (status === 503) return "O servico esta temporariamente indisponivel. Tente novamente em alguns instantes.";
  if (code === "HUMAN_VERIFICATION_FAILED") return "Conclua uma nova verificacao antes de continuar.";
  if (code === "FLOW_EXPIRED") return "Seu cadastro precisa ser reiniciado para continuar com seguranca.";
  if (status === 403 || status === 413 || status === 415 || status === 400) return "Revise os dados informados e tente novamente.";
  return "Nao foi possivel processar a solicitacao. Tente novamente.";
}
