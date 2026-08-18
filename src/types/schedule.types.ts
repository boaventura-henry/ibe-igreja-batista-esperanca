import type { ScheduleMemberRole, ScheduleMemberStatus, ScheduleStatus } from "@prisma/client";

export type ScheduleMinistry = {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
};

export type ScheduleEvent = {
  id: string;
  title: string;
  startDate: string;
  ministryId: string | null;
};

export type SchedulePerson = {
  id: string;
  name: string;
  nickname: string | null;
  displayName: string;
  status: string;
};

export type ScheduleInstrumentAssignmentSummary = {
  id: string;
  source: "REGISTERED" | "OWN";
  startedAt: string;
  endedAt: string | null;
  changeReason: string | null;
  instrumentCategory: { id: string; name: string };
  instrument: { id: string; name: string; brand: string | null; model: string | null; status: string } | null;
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
  instrumentAssignment: ScheduleInstrumentAssignmentSummary | null;
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
  publishedAt: string | null;
  observations: string | null;
  ministry: ScheduleMinistry;
  event: ScheduleEvent | null;
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
    events: Array<{ id: string; title: string; startDate: string; ministryId: string | null }>;
  };
};

export type ScheduleFormValues = {
  title: string;
  description?: string;
  ministryId: string;
  eventId?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  location?: string;
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
  instrumentAssignment?: { instrumentCategoryId: string; source: "REGISTERED" | "OWN"; instrumentId?: string | null; changeReason?: string | null };
};
