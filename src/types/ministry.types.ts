export type MinistryStatusFilter = "ACTIVE" | "INACTIVE";

export type MinistryPerson = {
  id: string;
  name: string;
  nickname: string | null;
  displayName: string;
  email: string | null;
  cpf: string | null;
};

export type MinistrySummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  icon: MinistryIcon;
  imageUrl: string | null;
  displayOrder: number;
  email: string | null;
  phone: string | null;
  meetingDay: WeekDay | null;
  meetingTime: string | null;
  location: string | null;
  notes: string | null;
  isActive: boolean;
  isSystem: boolean;
  leaderMember: MinistryPerson | null;
  viceLeaderMember: MinistryPerson | null;
  membersCount: number;
  eventsCount: number;
  createdAt: string;
  updatedAt: string;
};

export type MinistryListResult = {
  ministries: MinistrySummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  filters: {
    members: MinistryPerson[];
  };
};

export type MinistryFormValues = {
  name: string;
  description?: string;
  color: string;
  icon: MinistryIcon;
  imageUrl?: string;
  displayOrder: number;
  email?: string;
  phone?: string;
  meetingDay?: WeekDay | "";
  meetingTime?: string;
  location?: string;
  notes?: string;
  isActive: boolean;
  leaderMemberId?: string;
  viceLeaderMemberId?: string;
};
import type { MinistryIcon, WeekDay } from "@prisma/client";
