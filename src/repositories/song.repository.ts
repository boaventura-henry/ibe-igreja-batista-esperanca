import { Prisma } from "@prisma/client";
import { prisma } from "@/prisma/client";
import type { SongCreateInput, SongListQueryInput, SongUpdateInput } from "@/validators";

const songSelect = {
  id: true, title: true, artist: true, youtubeUrl: true, referenceKey: true, resourceUrl: true,
  simplifiedResourceUrl: true, notes: true, isActive: true, createdAt: true, updatedAt: true
} satisfies Prisma.SongSelect;
export type SongRecord = Prisma.SongGetPayload<{ select: typeof songSelect }>;

function createData(data: SongCreateInput): Prisma.SongUncheckedCreateInput {
  return { title: data.title, artist: data.artist, youtubeUrl: data.youtubeUrl, referenceKey: data.referenceKey, resourceUrl: data.resourceUrl, simplifiedResourceUrl: data.simplifiedResourceUrl, notes: data.notes, isActive: data.isActive ?? true };
}

function updateData(data: SongUpdateInput): Prisma.SongUncheckedUpdateInput {
  return { title: data.title, artist: data.artist, youtubeUrl: data.youtubeUrl, referenceKey: data.referenceKey, resourceUrl: data.resourceUrl, simplifiedResourceUrl: data.simplifiedResourceUrl, notes: data.notes, isActive: data.isActive };
}

export const songRepository = {
  async list(filters: SongListQueryInput) {
    const where: Prisma.SongWhereInput = { deletedAt: null, ...(filters.isActive === undefined ? {} : { isActive: filters.isActive }) };
    if (filters.search) where.OR = [{ title: { contains: filters.search, mode: "insensitive" } }, { artist: { contains: filters.search, mode: "insensitive" } }];
    if (filters.artist) where.artist = { contains: filters.artist, mode: "insensitive" };
    const skip = (filters.page - 1) * filters.pageSize;
    const [songs, total, usage] = await prisma.$transaction([
      prisma.song.findMany({ where, select: songSelect, orderBy: filters.sortBy === "lastUsedAt" ? { updatedAt: filters.sortOrder } : { [filters.sortBy]: filters.sortOrder }, skip, take: filters.pageSize }),
      prisma.song.count({ where }),
      prisma.scheduleSong.groupBy({ by: ["songId"], where: { deletedAt: null, schedule: { deletedAt: null } }, orderBy: { songId: "asc" }, _count: { _all: true }, _max: { createdAt: true, performanceKey: true } })
    ]);
    const usageBySong = new Map(usage.map((item) => [item.songId, item]));
    return { songs: songs.map((song) => { const item = usageBySong.get(song.id) as { _count: { _all: number }; _max: { createdAt: Date | null; performanceKey: string | null } } | undefined; return { ...song, usageCount: item?._count._all ?? 0, lastUsedAt: item?._max.createdAt ?? null, lastPerformanceKey: item?._max.performanceKey ?? null }; }), total };
  },
  findById(id: string) { return prisma.song.findFirst({ where: { id, deletedAt: null }, select: songSelect }); },
  findDuplicate(title: string, artist: string | null | undefined, ignoreId?: string) { return prisma.song.findFirst({ where: { title: { equals: title, mode: "insensitive" }, artist: artist ? { equals: artist, mode: "insensitive" } : null, deletedAt: null, ...(ignoreId ? { id: { not: ignoreId } } : {}) }, select: { id: true } }); },
  create(data: SongCreateInput, userId: string) { return prisma.song.create({ data: { ...createData(data), createdById: userId, updatedById: userId }, select: songSelect }); },
  update(id: string, data: SongUpdateInput, userId: string) { return prisma.song.update({ where: { id }, data: { ...updateData(data), updatedById: userId }, select: songSelect }); },
  softDelete(id: string, userId: string) { return prisma.song.update({ where: { id }, data: { deletedAt: new Date(), updatedById: userId }, select: { id: true } }); }
};
