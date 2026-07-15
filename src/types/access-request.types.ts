import type { UserAccessRequestStatus } from "@prisma/client";

export type AccessRequestMemberSummary = {
  id: string;
  name: string;
  nickname: string | null;
  displayName: string;
  email: string | null;
  cpf: string | null;
  rg: string | null;
  phone: string | null;
  mobilePhone: string | null;
  whatsapp: string | null;
  birthDate: string | null;
  status: string;
};

export type AccessRequestMemberMatch = {
  member: AccessRequestMemberSummary;
  score: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  criteria: string[];
  recommendation: string;
};

export type AccessRequestSummary = {
  id: string;
  name: string;
  username: string;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  rg: string | null;
  birthDate: string | null;
  status: UserAccessRequestStatus;
  possibleMember: AccessRequestMemberSummary | null;
  approvedMember: AccessRequestMemberSummary | null;
  approvedBy: { id: string; name: string } | null;
  approvedAt: string | null;
  rejectedBy: { id: string; name: string } | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AccessRequestListResult = {
  requests: AccessRequestSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type AccessRequestDetailResult = {
  request: AccessRequestSummary;
  members: AccessRequestMemberSummary[];
  matches: AccessRequestMemberMatch[];
};

export type PublicAccessRequestFormValues = {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  rg: string;
  birthDate: string;
  password: string;
  confirmPassword: string;
};
