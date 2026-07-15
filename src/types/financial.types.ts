import type {
  FinancialEntryOrigin,
  FinancialEntryStatus,
  FinancialEntryType,
  FinancialPaymentMethod
} from "@prisma/client";

export type FinancialCategorySummary = {
  id: string;
  name: string;
  description: string | null;
  type: FinancialEntryType;
  displayOrder: number;
  showInMemberPortal: boolean;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type FinancialCategoryListResult = {
  categories: FinancialCategorySummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type FinancialCategoryFormValues = {
  name: string;
  description: string;
  type: FinancialEntryType;
  displayOrder: number | "";
  showInMemberPortal: boolean;
  isActive: boolean;
};

export type FinancialRelationSummary = {
  id: string;
  name: string;
  nickname?: string | null;
  displayName?: string;
};

export type FinancialEventSummary = {
  id: string;
  title: string;
};

export type FinancialEntrySummary = {
  id: string;
  entryNumber: number;
  type: FinancialEntryType;
  member: FinancialRelationSummary | null;
  category: FinancialCategorySummary;
  event: FinancialEventSummary | null;
  ministry: FinancialRelationSummary | null;
  amount: string;
  paymentMethod: FinancialPaymentMethod;
  status: FinancialEntryStatus;
  origin: FinancialEntryOrigin;
  anonymous: boolean;
  launchDate: string;
  referenceDate: string;
  observation: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FinancialEntryListResult = {
  entries: FinancialEntrySummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  filters: {
    categories: FinancialCategorySummary[];
    members: FinancialRelationSummary[];
    events: FinancialEventSummary[];
    ministries: FinancialRelationSummary[];
  };
};

export type FinancialEntryFormValues = {
  type: FinancialEntryType;
  memberId: string;
  categoryId: string;
  eventId: string;
  ministryId: string;
  amount: number | "";
  paymentMethod: FinancialPaymentMethod;
  status: FinancialEntryStatus;
  origin: FinancialEntryOrigin;
  anonymous: boolean;
  launchDate: string;
  referenceDate: string;
  observation: string;
};

export type FinancialClosingSummary = {
  id: string;
  date: string;
  openingBalance: string;
  closingBalance: string;
  observation: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FinancialClosingListResult = {
  closings: FinancialClosingSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type FinancialClosingFormValues = {
  date: string;
  openingBalance: number | "";
  closingBalance: number | "";
  observation: string;
};

export type MemberContributionSummary = {
  id: string;
  entryNumber: number;
  category: string;
  amount: string;
  paymentMethod: FinancialPaymentMethod;
  status: FinancialEntryStatus;
  launchDate: string;
  referenceDate: string;
};

export type MemberContributionListResult = {
  contributions: MemberContributionSummary[];
};
