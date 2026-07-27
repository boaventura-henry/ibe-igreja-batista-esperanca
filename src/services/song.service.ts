import { AppError } from "@/lib/errors";
import type { ScheduleAuthorization } from "@/lib/schedule-authorization";
import { songRepository, songUsageHistoryRepository } from "@/repositories";
import { songUsageHistoryService } from "@/services/song-usage-history.service";
import { normalizeYouTubeUrl } from "@/utils/music";
import type { SongCreateInput, SongListQueryInput, SongUpdateInput } from "@/validators";

function serialize<T extends { createdAt: Date; updatedAt: Date; lastUsedAt?: Date | null }>(value: T) { return { ...value, createdAt: value.createdAt.toISOString(), updatedAt: value.updatedAt.toISOString(), lastUsedAt: value.lastUsedAt?.toISOString() ?? null }; }
export const songService = {
  options(search?: string) { return songRepository.options(search); },
  async list(filters: SongListQueryInput, authorization: ScheduleAuthorization) {
    const orderedIds = filters.sortBy === "lastUsedAt"
      ? (await songUsageHistoryRepository.listSongIdsByLastUsage(
          filters,
          authorization.accessContext
        )).map((song) => song.id)
      : undefined;
    const result = await songRepository.list(filters, orderedIds);
    const summaries = await songUsageHistoryService.summarize(
      result.songs.map((song) => song.id),
      authorization
    );

    return {
      songs: result.songs.map((song) => {
        const summary = summaries.get(song.id);
        return serialize({
          ...song,
          usageCount: summary?.usageCount ?? 0,
          lastUsedAt: summary?.lastUsedAt
            ? new Date(summary.lastUsedAt)
            : null,
          lastPerformanceKey: summary?.lastPerformanceKey ?? null
        });
      }),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / filters.pageSize))
      }
    };
  },
  async getById(id: string) { const song = await songRepository.findById(id); if (!song) throw new AppError("Musica nao encontrada.", 404, "SONG_NOT_FOUND"); return serialize({ ...song, usageCount: 0, lastUsedAt: null, lastPerformanceKey: null }); },
  async create(input: SongCreateInput, userId: string) { if (await songRepository.findDuplicate(input.title, input.artist)) throw new AppError("Ja existe uma musica com este titulo e artista.", 409, "SONG_DUPLICATED"); return serialize(await songRepository.create({ ...input, youtubeUrl: normalizeYouTubeUrl(input.youtubeUrl) }, userId)); },
  async update(id: string, input: SongUpdateInput, userId: string) { const current = await this.getById(id); const title = input.title ?? current.title; const artist = input.artist === undefined ? current.artist : input.artist; if (await songRepository.findDuplicate(title, artist, id)) throw new AppError("Ja existe uma musica com este titulo e artista.", 409, "SONG_DUPLICATED"); return serialize(await songRepository.update(id, { ...input, ...(input.youtubeUrl !== undefined ? { youtubeUrl: normalizeYouTubeUrl(input.youtubeUrl) } : {}) }, userId)); },
  async remove(id: string, userId: string) { await this.getById(id); return songRepository.softDelete(id, userId); }
};
