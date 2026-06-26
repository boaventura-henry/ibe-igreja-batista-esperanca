import type { MemberSex, MemberStatus } from "@prisma/client";

export type MemberStatusOption = MemberStatus;
export type MemberSexOption = MemberSex;

export type MemberListFilters = {
  search?: string;
  name?: string;
  cpf?: string;
  city?: string;
  status?: MemberStatus;
  ministryId?: string;
  sortBy?: "name" | "createdAt" | "updatedAt" | "joinedAt" | "city" | "status";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type MemberFormValues = {
  name: string;
  cpf: string;
  rg?: string;
  birthDate?: string;
  sex: MemberSex;
  maritalStatus?: string;
  phone?: string;
  mobilePhone?: string;
  whatsapp?: string;
  email?: string;
  zipCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
  baptismDate?: string;
  joinedAt?: string;
  status: MemberStatus;
  notes?: string;
  photoUrl?: string;
  ministryIds: string[];
};

export type MemberSummary = {
  id: string;
  name: string;
  cpf: string | null;
  email: string | null;
  phone: string | null;
  mobilePhone: string | null;
  city: string | null;
  state: string | null;
  status: MemberStatus;
  photoUrl: string | null;
  updatedAt: string;
  ministries: Array<{ id: string; name: string }>;
};

export type MemberListResult = {
  members: MemberSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  filters: {
    ministries: Array<{ id: string; name: string }>;
  };
};
