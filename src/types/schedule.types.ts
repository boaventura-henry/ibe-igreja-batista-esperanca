import type { ScheduleMemberRole, ScheduleMemberStatus, ScheduleStatus } from "@prisma/client";

export type ScheduleMinistry = {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
};

export type SchedulePerson = {
  id: string;
  name: string;
  nickname: string | null;
  displayName: string;
  status: string;
};

export type ScheduleMemberSummary = {
  id: string;
  role: ScheduleMemberRole;
  status: ScheduleMemberStatus;
  confirmedAt: string | null;
  declinedAt: string | null;
  declineReason: string | null;
  observations: string | null;
  member: SchedulePerson;
  replacedByMember: SchedulePerson | null;
  createdAt: string;
  updatedAt: string;
};

export type ScheduleSummary = {
  id: string;
  title: string;
  description: string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  status: ScheduleStatus;
  observations: string | null;
  ministry: ScheduleMinistry;
  members: ScheduleMemberSummary[];
  createdAt: string;
  updatedAt: string;
};

export type ScheduleListResult = {
  schedules: ScheduleSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  filters: {
    ministries: Array<{ id: string; name: string; color: string }>;
    members: Array<{ id: string; name: string; nickname: string | null; displayName: string; status: string }>;
  };
};

export type ScheduleFormValues = {
  title: string;
  description?: string;
  ministryId: string;
  date: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  status: ScheduleStatus;
  observations?: string;
};

export type ScheduleMemberFormValues = {
  memberId: string;
  role: ScheduleMemberRole;
  status: ScheduleMemberStatus;
  confirmedAt?: string;
  replacedByMemberId?: string;
  observations?: string;
  allowMinistryException: boolean;
};
