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
  options(search?: string) {
    const normalizedSearch = search?.trim();
    return prisma.song.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        ...(normalizedSearch ? { OR: [{ title: { contains: normalizedSearch, mode: "insensitive" } }, { artist: { contains: normalizedSearch, mode: "insensitive" } }] } : {})
      },
      select: { id: true, title: true, artist: true, referenceKey: true, isActive: true },
      orderBy: [{ title: "asc" }, { artist: "asc" }],
      take: 500
    });
  },
  async list(filters: SongListQueryInput, orderedIds?: string[]) {
    const where: Prisma.SongWhereInput = { deletedAt: null, ...(filters.isActive === undefined ? {} : { isActive: filters.isActive }) };
    if (filters.search) where.OR = [{ title: { contains: filters.search, mode: "insensitive" } }, { artist: { contains: filters.search, mode: "insensitive" } }];
    if (filters.artist) where.artist = { contains: filters.artist, mode: "insensitive" };
    const skip = (filters.page - 1) * filters.pageSize;
    const songWhere = orderedIds ? { AND: [where, { id: { in: orderedIds } }] } : where;
    const [songs, total] = await prisma.$transaction([
      prisma.song.findMany({
        where: songWhere,
        select: songSelect,
        ...(orderedIds
          ? {}
          : {
              orderBy: { [filters.sortBy]: filters.sortOrder },
              skip,
              take: filters.pageSize
            })
      }),
      prisma.song.count({ where })
    ]);
    const order = new Map(orderedIds?.map((id, index) => [id, index]) ?? []);
    return {
      songs: orderedIds
        ? songs.sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0))
        : songs,
      total
    };
  },
  findById(id: string) { return prisma.song.findFirst({ where: { id, deletedAt: null }, select: songSelect }); },
  findDuplicate(title: string, artist: string | null | undefined, ignoreId?: string) { return prisma.song.findFirst({ where: { title: { equals: title, mode: "insensitive" }, artist: artist ? { equals: artist, mode: "insensitive" } : null, deletedAt: null, ...(ignoreId ? { id: { not: ignoreId } } : {}) }, select: { id: true } }); },
  create(data: SongCreateInput, userId: string) { return prisma.song.create({ data: { ...createData(data), createdById: userId, updatedById: userId }, select: songSelect }); },
  update(id: string, data: SongUpdateInput, userId: string) { return prisma.song.update({ where: { id }, data: { ...updateData(data), updatedById: userId }, select: songSelect }); },
  softDelete(id: string, userId: string) { return prisma.song.update({ where: { id }, data: { deletedAt: new Date(), updatedById: userId }, select: { id: true } }); }
};
