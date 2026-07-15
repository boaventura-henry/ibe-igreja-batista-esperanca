import type { ScheduleMemberRole, ScheduleMemberStatus, ScheduleStatus } from "@prisma/client";

export type MyScheduleParticipant = {
  id: string;
  role: ScheduleMemberRole;
  status: ScheduleMemberStatus;
  member: {
    id: string;
    name: string;
    nickname: string | null;
    displayName: string;
    status: string;
  };
  replacedByMember: {
    id: string;
    name: string;
    nickname: string | null;
    displayName: string;
    status: string;
  } | null;
};

export type MyScheduleSummary = {
  id: string;
  scheduleId: string;
  title: string;
  description: string | null;
  ministry: {
    id: string;
    name: string;
    color: string;
    leader: {
      id: string;
      name: string;
      phone: string | null;
      mobilePhone: string | null;
    } | null;
  };
  date: string;
  startTime: string | null;
  endTime: string | null;
  role: ScheduleMemberRole;
  status: ScheduleMemberStatus;
  scheduleStatus: ScheduleStatus;
  location: string | null;
  observations: string | null;
  participantObservations: string | null;
  confirmedAt: string | null;
  declinedAt: string | null;
  declineReason: string | null;
  replacedByMember: {
    id: string;
    name: string;
    nickname: string | null;
    displayName: string;
    status: string;
  } | null;
  participants: MyScheduleParticipant[];
  createdAt: string;
  updatedAt: string;
};

export type MyScheduleListResult = {
  schedules: MyScheduleSummary[];
};

export type PortalScheduleRepertoire = {
  songs: Array<{
    id: string; position: number; referenceKey: string | null; performanceKey: string | null; useSimplifiedVersion: boolean;
    youtubeUrlOverride: string | null; resourceUrlOverride: string | null; notes: string | null;
    song: { title: string; artist: string | null; youtubeUrl: string | null; resourceUrl: string | null; simplifiedResourceUrl: string | null };
    leadMember: { id: string; name: string; nickname: string | null; displayName: string } | null;
  }>;
};
