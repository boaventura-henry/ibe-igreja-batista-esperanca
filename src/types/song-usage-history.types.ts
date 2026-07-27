import type { ScheduleStatus } from "@prisma/client";

export type SongUsageHistoryItem = {
  id: string;
  date: string;
  position: number;
  referenceKey: string | null;
  performanceKey: string | null;
  materialUrl: string | null;
  notes: string | null;
  schedule: {
    id: string;
    title: string;
    status: ScheduleStatus;
  };
  ministry: {
    id: string;
    name: string;
  };
  event: {
    id: string;
    title: string;
  } | null;
  leadMember: {
    id: string;
    name: string;
    nickname: string | null;
    displayName: string;
  } | null;
};

export type SongUsageHistoryResult = {
  song: {
    id: string;
    title: string;
    artist: string | null;
  };
  summary: {
    usageCount: number;
    firstUsedAt: string | null;
    lastUsedAt: string | null;
  };
  usages: SongUsageHistoryItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  filters: {
    ministries: Array<{ id: string; name: string }>;
    events: Array<{ id: string; title: string }>;
  };
};

export type SongUsageSummary = {
  usageCount: number;
  firstUsedAt: string | null;
  lastUsedAt: string | null;
  lastPerformanceKey: string | null;
};
