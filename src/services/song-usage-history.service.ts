import { AppError } from "@/lib/errors";
import type { ScheduleAuthorization } from "@/lib/schedule-authorization";
import { songUsageHistoryRepository } from "@/repositories";
import type {
  SongUsageHistoryResult,
  SongUsageSummary
} from "@/types";
import type { SongUsageHistoryQueryInput } from "@/validators";
import { getMemberDisplayName } from "@/utils";

function date(value: Date | null) {
  return value?.toISOString() ?? null;
}

export const songUsageHistoryService = {
  async getHistory(
    songId: string,
    filters: SongUsageHistoryQueryInput,
    authorization: ScheduleAuthorization
  ): Promise<SongUsageHistoryResult> {
    const song = await songUsageHistoryRepository.findSong(songId);

    if (!song) {
      throw new AppError("Musica nao encontrada.", 404, "SONG_NOT_FOUND");
    }

    const result = await songUsageHistoryRepository.list(
      songId,
      filters,
      authorization.accessContext
    );

    return {
      song,
      summary: {
        usageCount: result.total,
        firstUsedAt: date(result.firstUsedAt),
        lastUsedAt: date(result.lastUsedAt)
      },
      usages: result.usages.map((usage) => ({
        id: usage.id,
        date: usage.schedule.date.toISOString(),
        position: usage.position,
        referenceKey: usage.referenceKey,
        performanceKey: usage.performanceKey,
        materialUrl: usage.resourceUrlOverride ?? usage.song.resourceUrl,
        notes: usage.notes,
        schedule: {
          id: usage.schedule.id,
          title: usage.schedule.title,
          status: usage.schedule.status
        },
        ministry: usage.schedule.ministry,
        event: usage.schedule.event,
        leadMember: usage.leadMember
          ? {
              ...usage.leadMember,
              displayName: getMemberDisplayName(usage.leadMember)
            }
          : null
      })),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / filters.pageSize))
      },
      filters: {
        ministries: result.ministries,
        events: result.events
      }
    };
  },

  async summarize(
    songIds: string[],
    authorization: ScheduleAuthorization
  ): Promise<Map<string, SongUsageSummary>> {
    const rows = await songUsageHistoryRepository.listSummaries(
      songIds,
      authorization.accessContext
    );

    return new Map(
      rows.map((row) => [
        row.songId,
        {
          usageCount: row.usageCount,
          firstUsedAt: row.firstUsedAt.toISOString(),
          lastUsedAt: row.lastUsedAt.toISOString(),
          lastPerformanceKey: row.lastPerformanceKey
        }
      ])
    );
  }
};
