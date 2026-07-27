import { Prisma, ScheduleScope } from "@prisma/client";
import { prisma } from "@/prisma/client";
import { buildScheduleScopeWhere } from "@/repositories/schedule-access.repository";
import type { ScheduleAccessContext } from "@/types";
import type {
  SongListQueryInput,
  SongUsageHistoryQueryInput
} from "@/validators";

const usageSelect = {
  id: true,
  position: true,
  referenceKey: true,
  performanceKey: true,
  resourceUrlOverride: true,
  notes: true,
  leadMember: {
    select: { id: true, name: true, nickname: true }
  },
  song: {
    select: { resourceUrl: true }
  },
  schedule: {
    select: {
      id: true,
      title: true,
      date: true,
      status: true,
      ministry: {
        select: { id: true, name: true }
      },
      event: {
        select: { id: true, title: true }
      }
    }
  }
} satisfies Prisma.ScheduleSongSelect;

export type SongUsageRecord = Prisma.ScheduleSongGetPayload<{
  select: typeof usageSelect;
}>;

export type SongUsageSummaryRecord = {
  songId: string;
  usageCount: number;
  firstUsedAt: Date;
  lastUsedAt: Date;
  lastPerformanceKey: string | null;
};

function dateFromInput(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function buildScheduleScopeSql(accessContext: ScheduleAccessContext) {
  if (accessContext.scope === ScheduleScope.ALL) {
    return Prisma.empty;
  }

  const ministryIds = [...(accessContext.authorizedMinistryIds ?? [])];

  if (ministryIds.length === 0) {
    return Prisma.sql`AND FALSE`;
  }

  return Prisma.sql`AND schedule."ministryId" IN (${Prisma.join(ministryIds)})`;
}

function buildSongCatalogWhereSql(filters: SongListQueryInput) {
  const conditions: Prisma.Sql[] = [Prisma.sql`song."deletedAt" IS NULL`];

  if (filters.isActive !== undefined) {
    conditions.push(Prisma.sql`song."isActive" = ${filters.isActive}`);
  }

  if (filters.search) {
    const search = `%${filters.search}%`;
    conditions.push(
      Prisma.sql`(song."title" ILIKE ${search} OR song."artist" ILIKE ${search})`
    );
  }

  if (filters.artist) {
    conditions.push(Prisma.sql`song."artist" ILIKE ${`%${filters.artist}%`}`);
  }

  return Prisma.join(conditions, " AND ");
}

export function buildSongUsageHistoryWhere(
  songId: string,
  filters: SongUsageHistoryQueryInput,
  accessContext: ScheduleAccessContext
): Prisma.ScheduleSongWhereInput {
  return {
    songId,
    deletedAt: null,
    schedule: {
      deletedAt: null,
      AND: [
        buildScheduleScopeWhere(accessContext),
        ...(filters.ministryId ? [{ ministryId: filters.ministryId }] : [])
      ],
      ...(filters.eventId ? { eventId: filters.eventId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search
        ? { title: { contains: filters.search, mode: "insensitive" } }
        : {}),
      ...((filters.dateFrom || filters.dateTo)
        ? {
            date: {
              ...(filters.dateFrom ? { gte: dateFromInput(filters.dateFrom) } : {}),
              ...(filters.dateTo ? { lte: dateFromInput(filters.dateTo) } : {})
            }
          }
        : {})
    }
  };
}

export const songUsageHistoryRepository = {
  findSong(id: string) {
    return prisma.song.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        title: true,
        artist: true
      }
    });
  },

  async list(
    songId: string,
    filters: SongUsageHistoryQueryInput,
    accessContext: ScheduleAccessContext
  ) {
    const where = buildSongUsageHistoryWhere(songId, filters, accessContext);
    const skip = (filters.page - 1) * filters.pageSize;

    const [usages, total, firstUsage, lastUsage, ministries, events] =
      await prisma.$transaction([
        prisma.scheduleSong.findMany({
          where,
          select: usageSelect,
          orderBy: [
            { schedule: { date: filters.sortOrder } },
            { position: "asc" }
          ],
          skip,
          take: filters.pageSize
        }),
        prisma.scheduleSong.count({ where }),
        prisma.scheduleSong.findFirst({
          where,
          select: { schedule: { select: { date: true } } },
          orderBy: { schedule: { date: "asc" } }
        }),
        prisma.scheduleSong.findFirst({
          where,
          select: { schedule: { select: { date: true } } },
          orderBy: { schedule: { date: "desc" } }
        }),
        prisma.ministry.findMany({
          where: {
            deletedAt: null,
            schedules: {
              some: {
                ...buildScheduleScopeWhere(accessContext),
                deletedAt: null,
                songs: { some: { songId, deletedAt: null } }
              }
            }
          },
          select: { id: true, name: true },
          orderBy: { name: "asc" }
        }),
        prisma.event.findMany({
          where: {
            deletedAt: null,
            schedules: {
              some: {
                ...buildScheduleScopeWhere(accessContext),
                deletedAt: null,
                songs: { some: { songId, deletedAt: null } }
              }
            }
          },
          select: { id: true, title: true },
          orderBy: [{ startDate: "desc" }, { title: "asc" }]
        })
      ]);

    return {
      usages,
      total,
      firstUsedAt: firstUsage?.schedule.date ?? null,
      lastUsedAt: lastUsage?.schedule.date ?? null,
      ministries,
      events
    };
  },

  listSummaries(
    songIds: string[],
    accessContext: ScheduleAccessContext
  ): Promise<SongUsageSummaryRecord[]> {
    if (songIds.length === 0) {
      return Promise.resolve([]);
    }

    const scope = buildScheduleScopeSql(accessContext);

    return prisma.$queryRaw<SongUsageSummaryRecord[]>(Prisma.sql`
      SELECT
        usage."songId" AS "songId",
        COUNT(*)::integer AS "usageCount",
        MIN(schedule."date") AS "firstUsedAt",
        MAX(schedule."date") AS "lastUsedAt",
        (ARRAY_AGG(
          usage."performanceKey"
          ORDER BY schedule."date" DESC, usage."position" ASC
        ))[1] AS "lastPerformanceKey"
      FROM "ScheduleSong" AS usage
      INNER JOIN "Schedule" AS schedule
        ON schedule."id" = usage."scheduleId"
      WHERE usage."songId" IN (${Prisma.join(songIds)})
        AND usage."deletedAt" IS NULL
        AND schedule."deletedAt" IS NULL
        ${scope}
      GROUP BY usage."songId"
    `);
  },

  listSongIdsByLastUsage(
    filters: SongListQueryInput,
    accessContext: ScheduleAccessContext
  ): Promise<Array<{ id: string }>> {
    const scope = buildScheduleScopeSql(accessContext);
    const songWhere = buildSongCatalogWhereSql(filters);
    const direction = Prisma.raw(filters.sortOrder === "desc" ? "DESC" : "ASC");
    const offset = (filters.page - 1) * filters.pageSize;

    return prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT song."id"
      FROM "Song" AS song
      LEFT JOIN "ScheduleSong" AS usage
        ON usage."songId" = song."id"
        AND usage."deletedAt" IS NULL
      LEFT JOIN "Schedule" AS schedule
        ON schedule."id" = usage."scheduleId"
        AND schedule."deletedAt" IS NULL
        ${scope}
      WHERE ${songWhere}
      GROUP BY song."id", song."title"
      ORDER BY MAX(schedule."date") ${direction} NULLS LAST, song."title" ASC
      OFFSET ${offset}
      LIMIT ${filters.pageSize}
    `);
  }
};
