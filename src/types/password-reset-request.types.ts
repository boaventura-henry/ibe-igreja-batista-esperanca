import type { PasswordResetRequestStatus } from "@prisma/client";

export type PasswordResetRequestUserSummary = {
  id: string;
  name: string;
  username: string;
  email: string;
  member: { id: string; name: string; cpf: string | null } | null;
};

export type PasswordResetRequestSummary = {
  id: string;
  identifier: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  status: PasswordResetRequestStatus;
  user: PasswordResetRequestUserSummary | null;
  processedBy: { id: string; name: string } | null;
  requestedAt: string;
  processedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PasswordResetRequestListResult = {
  requests: PasswordResetRequestSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type PasswordResetApprovalResult = {
  request: PasswordResetRequestSummary;
  temporaryPassword: string;
};

export type PublicPasswordResetRequestFormValues = {
  identifier: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
};
