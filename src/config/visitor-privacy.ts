export type VisitorPrivacyStatus = "DRAFT" | "APPROVED";

export const visitorPrivacyNotice = {
  version: "visitor-privacy-draft-1",
  status: "DRAFT" as VisitorPrivacyStatus,
  text: null
} as const;
