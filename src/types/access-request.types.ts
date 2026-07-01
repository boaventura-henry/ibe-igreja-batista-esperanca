import type { UserAccessRequestStatus } from "@prisma/client";

export type AccessRequestMemberSummary = {
  id: string;
  name: string;
  email: string | null;
  cpf: string | null;
  birthDate: string | null;
};

export type AccessRequestSummary = {
  id: string;
  name: string;
  username: string;
  email: string;
  phone: string | null;
  cpf: string | null;
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
};

export type PublicAccessRequestFormValues = {
  name: string;
  username: string;
  email: string;
  phone: string;
  cpf: string;
  birthDate: string;
  password: string;
  confirmPassword: string;
};
