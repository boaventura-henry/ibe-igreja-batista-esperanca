import { Prisma } from "@prisma/client";
import { prisma } from "@/prisma/client";
import type { ScheduleSongCreateInput, ScheduleSongUpdateInput } from "@/validators";

const select = {
  id: true, position: true, referenceKey: true, performanceKey: true, youtubeUrlOverride: true, resourceUrlOverride: true, useSimplifiedVersion: true, notes: true, createdAt: true, updatedAt: true,
  song: { select: { id: true, title: true, artist: true, youtubeUrl: true, referenceKey: true, resourceUrl: true, simplifiedResourceUrl: true } },
  leadMember: { select: { id: true, name: true, status: true } }
} satisfies Prisma.ScheduleSongSelect;
export type ScheduleSongRecord = Prisma.ScheduleSongGetPayload<{ select: typeof select }>;
const copySelect = {
  songId: true, position: true, referenceKey: true, performanceKey: true, youtubeUrlOverride: true,
  resourceUrlOverride: true, useSimplifiedVersion: true, notes: true,
  song: { select: { deletedAt: true, isActive: true } }
} satisfies Prisma.ScheduleSongSelect;

function createData(input: ScheduleSongCreateInput): Prisma.ScheduleSongUncheckedCreateInput {
  return { scheduleId: "", songId: input.songId, position: input.position!, referenceKey: input.referenceKey, performanceKey: input.performanceKey, leadMemberId: input.leadMemberId, youtubeUrlOverride: input.youtubeUrlOverride, resourceUrlOverride: input.resourceUrlOverride, useSimplifiedVersion: input.useSimplifiedVersion ?? false, notes: input.notes };
}

function updateData(input: ScheduleSongUpdateInput): Prisma.ScheduleSongUncheckedUpdateInput {
  return { songId: input.songId, position: input.position, referenceKey: input.referenceKey, performanceKey: input.performanceKey, leadMemberId: input.leadMemberId, youtubeUrlOverride: input.youtubeUrlOverride, resourceUrlOverride: input.resourceUrlOverride, useSimplifiedVersion: input.useSimplifiedVersion, notes: input.notes };
}

export const scheduleSongRepository = {
  list(scheduleId: string) { return prisma.scheduleSong.findMany({ where: { scheduleId, deletedAt: null }, select, orderBy: { position: "asc" } }); },
  listForCopy(scheduleId: string) { return prisma.scheduleSong.findMany({ where: { scheduleId, deletedAt: null }, select: copySelect, orderBy: { position: "asc" } }); },
  findById(scheduleId: string, id: string) { return prisma.scheduleSong.findFirst({ where: { id, scheduleId, deletedAt: null }, select }); },
  findSongDuplicate(scheduleId: string, songId: string, ignoreId?: string) { return prisma.scheduleSong.findFirst({ where: { scheduleId, songId, deletedAt: null, ...(ignoreId ? { id: { not: ignoreId } } : {}) }, select: { id: true } }); },
  findActiveSong(id: string) { return prisma.song.findFirst({ where: { id, deletedAt: null, isActive: true }, select: { id: true } }); },
  findActivePosition(scheduleId: string, position: number, ignoreId?: string) { return prisma.scheduleSong.findFirst({ where: { scheduleId, position, deletedAt: null, ...(ignoreId ? { id: { not: ignoreId } } : {}) }, select: { id: true } }); },
  maxPosition(scheduleId: string) { return prisma.scheduleSong.aggregate({ where: { scheduleId, deletedAt: null }, _max: { position: true } }); },
  listScheduleMembers(scheduleId: string) { return prisma.scheduleMember.findMany({ where: { scheduleId, deletedAt: null, status: { in: ["PENDING", "CONFIRMED"] }, member: { deletedAt: null, status: "ACTIVE" } }, select: { member: { select: { id: true, name: true, status: true } } }, orderBy: { member: { name: "asc" } } }); },
  listSourceSchedules(scheduleId: string, ministryId: string) { return prisma.schedule.findMany({ where: { id: { not: scheduleId }, ministryId, deletedAt: null }, select: { id: true, title: true, date: true, _count: { select: { songs: true } } }, orderBy: { date: "desc" }, take: 30 }); },
  create(scheduleId: string, input: ScheduleSongCreateInput, userId: string) { return prisma.scheduleSong.create({ data: { ...createData(input), scheduleId, createdById: userId, updatedById: userId }, select }); },
  update(id: string, input: ScheduleSongUpdateInput, userId: string) { return prisma.scheduleSong.update({ where: { id }, data: { ...updateData(input), updatedById: userId }, select }); },
  async softDeleteAndRecompact(scheduleId: string, id: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      await tx.scheduleSong.update({ where: { id }, data: { deletedAt: new Date(), updatedById: userId } });
      const remaining = await tx.scheduleSong.findMany({ where: { scheduleId, deletedAt: null }, orderBy: { position: "asc" }, select: { id: true } });
      for (let index = 0; index < remaining.length; index++) await tx.scheduleSong.update({ where: { id: remaining[index].id }, data: { position: index + 1, updatedById: userId } });
      return { id };
    });
  },
  async reorder(scheduleId: string, id: string, direction: "up" | "down", userId: string) {
    return prisma.$transaction(async (tx) => {
      const items = await tx.scheduleSong.findMany({ where: { scheduleId, deletedAt: null }, orderBy: { position: "asc" }, select: { id: true, position: true } });
      const index = items.findIndex((item) => item.id === id);
      const target = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || target < 0 || target >= items.length) return;
      [items[index], items[target]] = [items[target], items[index]];
      for (let position = 0; position < items.length; position++) await tx.scheduleSong.update({ where: { id: items[position].id }, data: { position: position + 1, updatedById: userId } });
    });
  },
  async copy(destinationId: string, sourceId: string, mode: "replace" | "append", userId: string) {
    return prisma.$transaction(async (tx) => {
      const source = await tx.scheduleSong.findMany({ where: { scheduleId: sourceId, deletedAt: null }, orderBy: { position: "asc" } });
      const existing = await tx.scheduleSong.findMany({ where: { scheduleId: destinationId, deletedAt: null }, orderBy: { position: "asc" } });
      let position = mode === "replace" ? 1 : existing.length + 1;
      if (mode === "replace" && existing.length) await tx.scheduleSong.updateMany({ where: { scheduleId: destinationId, deletedAt: null }, data: { deletedAt: new Date(), updatedById: userId } });
      for (const item of source) { await tx.scheduleSong.create({ data: { scheduleId: destinationId, songId: item.songId, position: position++, referenceKey: item.referenceKey, performanceKey: item.performanceKey, youtubeUrlOverride: item.youtubeUrlOverride, resourceUrlOverride: item.resourceUrlOverride, useSimplifiedVersion: item.useSimplifiedVersion, notes: item.notes, createdById: userId, updatedById: userId } }); }
    });
  }
};
