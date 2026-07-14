import { AppError } from "@/lib/errors";
import { songRepository } from "@/repositories";
import { normalizeYouTubeUrl } from "@/utils/music";
import type { SongCreateInput, SongListQueryInput, SongUpdateInput } from "@/validators";

function serialize<T extends { createdAt: Date; updatedAt: Date; lastUsedAt?: Date | null }>(value: T) { return { ...value, createdAt: value.createdAt.toISOString(), updatedAt: value.updatedAt.toISOString(), lastUsedAt: value.lastUsedAt?.toISOString() ?? null }; }
export const songService = {
  async list(filters: SongListQueryInput) { const result = await songRepository.list(filters); return { songs: result.songs.map(serialize), pagination: { page: filters.page, pageSize: filters.pageSize, total: result.total, totalPages: Math.max(1, Math.ceil(result.total / filters.pageSize)) } }; },
  async getById(id: string) { const song = await songRepository.findById(id); if (!song) throw new AppError("Musica nao encontrada.", 404, "SONG_NOT_FOUND"); return serialize({ ...song, usageCount: 0, lastUsedAt: null, lastPerformanceKey: null }); },
  async create(input: SongCreateInput, userId: string) { if (await songRepository.findDuplicate(input.title, input.artist)) throw new AppError("Ja existe uma musica com este titulo e artista.", 409, "SONG_DUPLICATED"); return serialize(await songRepository.create({ ...input, youtubeUrl: normalizeYouTubeUrl(input.youtubeUrl) }, userId)); },
  async update(id: string, input: SongUpdateInput, userId: string) { const current = await this.getById(id); const title = input.title ?? current.title; const artist = input.artist === undefined ? current.artist : input.artist; if (await songRepository.findDuplicate(title, artist, id)) throw new AppError("Ja existe uma musica com este titulo e artista.", 409, "SONG_DUPLICATED"); return serialize(await songRepository.update(id, { ...input, ...(input.youtubeUrl !== undefined ? { youtubeUrl: normalizeYouTubeUrl(input.youtubeUrl) } : {}) }, userId)); },
  async remove(id: string, userId: string) { await this.getById(id); return songRepository.softDelete(id, userId); }
};
