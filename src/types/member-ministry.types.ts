import type { MemberMinistryRole, MemberMinistryStatus } from "@prisma/client";

export type MemberMinistryPerson = {
  id: string;
  name: string;
  nickname: string | null;
  displayName: string;
  cpf: string | null;
  email: string | null;
  status?: string;
};

export type MemberMinistryMinistry = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  color: string;
};

export type MemberMinistrySummary = {
  id: string;
  role: MemberMinistryRole;
  status: MemberMinistryStatus;
  entryDate: string;
  exitDate: string | null;
  observations: string | null;
  member: MemberMinistryPerson;
  ministry: MemberMinistryMinistry;
  createdAt: string;
  updatedAt: string;
};

export type MemberMinistryFormValues = {
  memberId: string;
  ministryId: string;
  role: MemberMinistryRole;
  status: MemberMinistryStatus;
  entryDate: string;
  exitDate?: string;
  observations?: string;
};

export type MemberMinistryListResult = {
  memberMinistries: MemberMinistrySummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  filters: {
    members: MemberMinistryPerson[];
    ministries: MemberMinistryMinistry[];
  };
};
