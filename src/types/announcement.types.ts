import type { AnnouncementAudience, AnnouncementStatus } from "@prisma/client";

export type AnnouncementMinistry = {
  id: string;
  name: string;
  color: string;
};

export type AnnouncementSummary = {
  id: string;
  title: string;
  content: string;
  status: AnnouncementStatus;
  audience: AnnouncementAudience;
  ministry: AnnouncementMinistry | null;
  isPinned: boolean;
  publishAt: string | null;
  expiresAt: string | null;
  externalLink: string | null;
  readAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AnnouncementListResult = {
  announcements: AnnouncementSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  filters: {
    ministries: AnnouncementMinistry[];
  };
};

export type PortalAnnouncementListResult = {
  userWithoutMember: boolean;
  announcements: AnnouncementSummary[];
};

export type AnnouncementFormValues = {
  title: string;
  content: string;
  status: AnnouncementStatus;
  audience: AnnouncementAudience;
  ministryId?: string;
  isPinned: boolean;
  publishAt?: string;
  expiresAt?: string;
  externalLink?: string;
};
