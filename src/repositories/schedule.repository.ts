import { MemberStatus, Prisma, ScheduleMemberStatus, ScheduleStatus } from "@prisma/client";
import { prisma } from "@/prisma/client";
import { buildScheduleScopeWhere } from "@/repositories/schedule-access.repository";
import type { ScheduleAccessContext } from "@/types";
import type {
  ScheduleCreateInput,
  ScheduleListQueryInput,
  ScheduleMemberCreateInput,
  ScheduleMemberUpdateInput,
  ScheduleUpdateInput
} from "@/validators";

const scheduleMemberSelect = {
  id: true,
  role: true,
  status: true,
  confirmedAt: true,
  declinedAt: true,
  declineReason: true,
  observations: true,
  createdAt: true,
  updatedAt: true,
  member: {
    select: {
      id: true,
      name: true,
      nickname: true,
      status: true,
      user: { select: { id: true } }
    }
  },
  replacedByMember: {
    select: {
      id: true,
      name: true,
      nickname: true,
      status: true,
      user: { select: { id: true } }
    }
  }
} satisfies Prisma.ScheduleMemberSelect;

const scheduleSelect = {
  id: true,
  title: true,
  description: true,
  date: true,
  startTime: true,
  endTime: true,
  location: true,
  status: true,
  publishedAt: true,
  notificationVersion: true,
  observations: true,
  createdAt: true,
  updatedAt: true,
  ministry: {
    select: { id: true, name: true, color: true, isActive: true }
  },
  event: {
    select: { id: true, title: true, startDate: true, ministryId: true }
  },
  members: {
    where: { deletedAt: null },
    select: scheduleMemberSelect,
    orderBy: [{ role: "asc" }, { member: { name: "asc" } }]
  }
} satisfies Prisma.ScheduleSelect;

export type ScheduleRecord = Prisma.ScheduleGetPayload<{ select: typeof scheduleSelect }>;
export type ScheduleMemberRecord = Prisma.ScheduleMemberGetPayload<{ select: typeof scheduleMemberSelect }>;
export type ScheduleDatabase = Prisma.TransactionClient | typeof prisma;

export type ScheduleTimeWindow = {
  id: string;
  date: Date;
  startTime: string | null;
  endTime: string | null;
};

function dateFromInput(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function createData(data: ScheduleCreateInput): Prisma.ScheduleUncheckedCreateInput {
  return {
    title: data.title,
    description: data.description,
    ministryId: data.ministryId,
    eventId: data.eventId,
    date: dateFromInput(data.date),
    startTime: data.startTime,
    endTime: data.endTime,
    location: data.location,
    status: ScheduleStatus.DRAFT,
    observations: data.observations
  };
}

function updateData(data: ScheduleUpdateInput): Prisma.ScheduleUncheckedUpdateInput {
  return {
    title: data.title,
    description: data.description,
    ministryId: data.ministryId,
    eventId: data.eventId,
    date: data.date ? dateFromInput(data.date) : undefined,
    startTime: data.startTime,
    endTime: data.endTime,
    location: data.location,
    observations: data.observations
  };
}

function scheduleMemberData(
  data: ScheduleMemberCreateInput | ScheduleMemberUpdateInput
): Prisma.ScheduleMemberUncheckedUpdateInput {
  return {
    memberId: data.memberId,
    role: data.role,
    status: data.status,
    confirmedAt: data.confirmedAt ? new Date(data.confirmedAt) : data.confirmedAt === null ? null : undefined,
    replacedByMemberId: data.replacedByMemberId,
    observations: data.observations
  };
}

export function buildScheduleWhere(
  filters: ScheduleListQueryInput,
  accessContext?: ScheduleAccessContext
): Prisma.ScheduleWhereInput {
  const and: Prisma.ScheduleWhereInput[] = [{ deletedAt: null }];

  if (accessContext) {
    and.push(buildScheduleScopeWhere(accessContext));
  }

  if (filters.search) {
    and.push({
      OR: [
        { title: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
        { ministry: { name: { contains: filters.search, mode: "insensitive" } } },
        { location: { contains: filters.search, mode: "insensitive" } }
      ]
    });
  }

  if (filters.ministryId) {
    and.push({ ministryId: filters.ministryId });
  }

  if (filters.status) {
    and.push({ status: filters.status });
  }

  if (filters.dateFrom) {
    and.push({ date: { gte: dateFromInput(filters.dateFrom) } });
  }

  if (filters.dateTo) {
    and.push({ date: { lte: dateFromInput(filters.dateTo) } });
  }

  return { AND: and };
}

export const scheduleRepository = {
  transaction<T>(callback: (database: Prisma.TransactionClient) => Promise<T>) {
    return prisma.$transaction(callback);
  },

  async list(filters: ScheduleListQueryInput, accessContext: ScheduleAccessContext) {
    const where = buildScheduleWhere(filters, accessContext);
    const skip = (filters.page - 1) * filters.pageSize;

    const [schedules, total] = await prisma.$transaction([
      prisma.schedule.findMany({
        where,
        select: scheduleSelect,
        orderBy: { [filters.sortBy]: filters.sortOrder },
        skip,
        take: filters.pageSize
      }),
      prisma.schedule.count({ where })
    ]);

    return { schedules, total };
  },

  findByIdWithinScope(
    id: string,
    accessContext: ScheduleAccessContext,
    database: ScheduleDatabase = prisma
  ) {
    return database.schedule.findFirst({
      where: { id, deletedAt: null, ...buildScheduleScopeWhere(accessContext) },
      select: scheduleSelect
    });
  },

  findMinistryById(id: string) {
    return prisma.ministry.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, isActive: true }
    });
  },

  findEventById(id: string) {
    return prisma.event.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, title: true, ministryId: true }
    });
  },

  findMemberById(id: string, database: ScheduleDatabase = prisma) {
    return database.member.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, status: true }
    });
  },

  findActiveScheduleMember(
    scheduleId: string,
    memberId: string,
    ignoreId?: string,
    database: ScheduleDatabase = prisma
  ) {
    return database.scheduleMember.findFirst({
      where: { scheduleId, memberId, deletedAt: null, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
      select: { id: true }
    });
  },

  findScheduleMemberTimeConflict(
    memberId: string,
    schedule: ScheduleTimeWindow,
    ignoreId?: string,
    database: ScheduleDatabase = prisma
  ) {
    const sameDateWhere: Prisma.ScheduleWhereInput = {
      id: { not: schedule.id },
      date: schedule.date,
      deletedAt: null,
      status: { not: ScheduleStatus.CANCELED }
    };

    const scheduleTimeWhere =
      schedule.startTime && schedule.endTime
        ? {
            OR: [
              { startTime: null },
              { endTime: null },
              {
                AND: [
                  { startTime: { lt: schedule.endTime } },
                  { endTime: { gt: schedule.startTime } }
                ]
              }
            ]
          }
        : {};

    return database.scheduleMember.findFirst({
      where: {
        memberId,
        deletedAt: null,
        ...(ignoreId ? { id: { not: ignoreId } } : {}),
        schedule: {
          ...sameDateWhere,
          ...scheduleTimeWhere
        }
      },
      select: {
        id: true,
        schedule: {
          select: {
            id: true,
            title: true,
            date: true,
            startTime: true,
            endTime: true
          }
        }
      }
    });
  },

  findAnyMemberTimeConflict(schedule: ScheduleTimeWindow) {
    const memberIdsQuery = prisma.scheduleMember.findMany({
      where: { scheduleId: schedule.id, deletedAt: null },
      select: { id: true, memberId: true }
    });

    return memberIdsQuery.then((members) => {
      if (members.length === 0) {
        return null;
      }

      const scheduleTimeWhere =
        schedule.startTime && schedule.endTime
          ? {
              OR: [
                { startTime: null },
                { endTime: null },
                {
                  AND: [
                    { startTime: { lt: schedule.endTime } },
                    { endTime: { gt: schedule.startTime } }
                  ]
                }
              ]
            }
          : {};

      return prisma.scheduleMember.findFirst({
        where: {
          memberId: { in: members.map((member) => member.memberId) },
          deletedAt: null,
          schedule: {
            id: { not: schedule.id },
            date: schedule.date,
            deletedAt: null,
            status: { not: ScheduleStatus.CANCELED },
            ...scheduleTimeWhere
          }
        },
        select: {
          id: true,
          schedule: {
            select: {
              id: true,
              title: true,
              date: true,
              startTime: true,
              endTime: true
            }
          }
        }
      });
    });
  },

  findScheduleMemberById(
    id: string,
    scheduleId?: string,
    database: ScheduleDatabase = prisma
  ) {
    return database.scheduleMember.findFirst({
      where: { id, deletedAt: null, ...(scheduleId ? { scheduleId } : {}) },
      select: { ...scheduleMemberSelect, schedule: { select: { id: true, status: true, ministryId: true } } }
    });
  },

  findActiveMemberMinistry(
    memberId: string,
    ministryId: string,
    database: ScheduleDatabase = prisma
  ) {
    return database.memberMinistry.findFirst({
      where: {
        memberId,
        ministryId,
        status: "ACTIVE",
        exitDate: null,
        deletedAt: null,
        ministry: { isActive: true, deletedAt: null }
      },
      select: { id: true }
    });
  },

  create(data: ScheduleCreateInput, userId: string) {
    return prisma.schedule.create({
      data: { ...createData(data), createdById: userId, updatedById: userId },
      select: scheduleSelect
    });
  },

  update(id: string, data: ScheduleUpdateInput, userId: string) {
    return prisma.schedule.update({
      where: { id },
      data: { ...updateData(data), updatedById: userId },
      select: scheduleSelect
    });
  },

  updateWithinScope(
    id: string,
    data: ScheduleUpdateInput,
    userId: string,
    accessContext: ScheduleAccessContext,
    database?: ScheduleDatabase
  ): Promise<ScheduleRecord | null> {
    if (!database) {
      return prisma.$transaction((transaction) =>
        this.updateWithinScope(
          id,
          data,
          userId,
          accessContext,
          transaction
        )
      );
    }
    const scopeWhere = buildScheduleScopeWhere(accessContext);
    return (async () => {
      const result = await database.schedule.updateMany({
        where: { id, deletedAt: null, ...scopeWhere },
        data: {
          ...(updateData(data) as Prisma.ScheduleUncheckedUpdateManyInput),
          updatedById: userId
        }
      });

      if (result.count === 0) {
        return null;
      }

      return database.schedule.findFirst({
        where: { id, deletedAt: null, ...scopeWhere },
        select: scheduleSelect
      });
    })();
  },

  async transitionStatusWithinScope(
    id: string,
    fromStatuses: ScheduleStatus[],
    status: ScheduleStatus,
    userId: string,
    accessContext: ScheduleAccessContext,
    database: ScheduleDatabase,
    options: { publishedAt?: Date; incrementNotificationVersion?: boolean } = {}
  ) {
    const scopeWhere = buildScheduleScopeWhere(accessContext);
    const result = await database.schedule.updateMany({
      where: {
        id,
        deletedAt: null,
        status: { in: fromStatuses },
        ...scopeWhere
      },
      data: {
        status,
        updatedById: userId,
        ...(options.publishedAt ? { publishedAt: options.publishedAt } : {}),
        ...(options.incrementNotificationVersion
          ? { notificationVersion: { increment: 1 } }
          : {})
      }
    });
    if (result.count === 0) return null;
    return database.schedule.findFirst({
      where: { id, deletedAt: null, ...scopeWhere },
      select: scheduleSelect
    });
  },

  async lockByIdWithinScope(
    id: string,
    accessContext: ScheduleAccessContext,
    database: ScheduleDatabase
  ) {
    const authorizedMinistryIds = accessContext.authorizedMinistryIds;
    if (authorizedMinistryIds !== null && authorizedMinistryIds.length === 0) {
      return null;
    }

    const locked =
      authorizedMinistryIds === null
        ? await database.$queryRaw<Array<{ id: string }>>`
            SELECT "id"
            FROM "Schedule"
            WHERE "id" = ${id}
              AND "deletedAt" IS NULL
            FOR UPDATE
          `
        : await database.$queryRaw<Array<{ id: string }>>`
            SELECT "id"
            FROM "Schedule"
            WHERE "id" = ${id}
              AND "deletedAt" IS NULL
              AND "ministryId" IN (${Prisma.join([...authorizedMinistryIds])})
            FOR UPDATE
          `;

    if (!locked.length) {
      return null;
    }

    return this.findByIdWithinScope(id, accessContext, database);
  },

  softDelete(id: string, userId: string) {
    return prisma.schedule.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: userId },
      select: { id: true, deletedAt: true }
    });
  },

  softDeleteWithinScope(
    id: string,
    userId: string,
    accessContext: ScheduleAccessContext,
    database: ScheduleDatabase = prisma
  ) {
    const deletedAt = new Date();

    return database.schedule.updateMany({
      where: { id, deletedAt: null, ...buildScheduleScopeWhere(accessContext) },
      data: {
        deletedAt,
        updatedById: userId
      }
    }).then((result) => {
      if (result.count === 0) {
        return null;
      }

      return { id, deletedAt };
    });
  },

  addMember(
    scheduleId: string,
    data: ScheduleMemberCreateInput,
    userId: string,
    database: ScheduleDatabase = prisma
  ) {
    return database.scheduleMember.create({
      data: {
        ...(scheduleMemberData(data) as Prisma.ScheduleMemberUncheckedCreateInput),
        scheduleId,
        memberId: data.memberId,
        createdById: userId,
        updatedById: userId
      },
      select: scheduleMemberSelect
    });
  },

  updateMember(
    id: string,
    data: ScheduleMemberUpdateInput,
    userId: string,
    database: ScheduleDatabase = prisma
  ) {
    return database.scheduleMember.update({
      where: { id },
      data: { ...scheduleMemberData(data), updatedById: userId },
      select: scheduleMemberSelect
    });
  },

  softDeleteMember(id: string, userId: string, database: ScheduleDatabase = prisma) {
    return database.scheduleMember.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: userId },
      select: { id: true, deletedAt: true }
    });
  },

  incrementNotificationVersion(id: string, database: ScheduleDatabase) {
    return database.schedule.update({
      where: { id },
      data: { notificationVersion: { increment: 1 } },
      select: { notificationVersion: true }
    });
  },

  listPublishedScheduleRecipientLinks(scheduleIds: string[], userIds: string[]) {
    if (!scheduleIds.length || !userIds.length) {
      return Promise.resolve([]);
    }

    return prisma.schedule.findMany({
      where: {
        id: { in: scheduleIds },
        status: ScheduleStatus.PUBLISHED,
        publishedAt: { not: null },
        deletedAt: null
      },
      select: {
        id: true,
        members: {
          where: {
            deletedAt: null,
            OR: [
              {
                status: {
                  in: [ScheduleMemberStatus.PENDING, ScheduleMemberStatus.CONFIRMED]
                },
                member: { user: { id: { in: userIds }, isActive: true } }
              },
              {
                status: ScheduleMemberStatus.REPLACED,
                replacedByMember: {
                  user: { id: { in: userIds }, isActive: true }
                }
              }
            ]
          },
          select: {
            status: true,
            member: { select: { user: { select: { id: true } } } },
            replacedByMember: { select: { user: { select: { id: true } } } }
          }
        }
      }
    });
  },

  listMinistries(accessContext: ScheduleAccessContext) {
    return prisma.ministry.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        ...(accessContext.authorizedMinistryIds === null
          ? {}
          : { id: { in: [...accessContext.authorizedMinistryIds] } })
      },
      select: { id: true, name: true, color: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }]
    });
  },

  listEvents(accessContext: ScheduleAccessContext) {
    return prisma.event.findMany({
      where: {
        deletedAt: null,
        ...(accessContext.authorizedMinistryIds === null
          ? {}
          : {
              OR: [
                { ministryId: null },
                { ministryId: { in: [...accessContext.authorizedMinistryIds] } }
              ]
            })
      },
      select: { id: true, title: true, startDate: true, ministryId: true },
      orderBy: [{ startDate: "desc" }, { title: "asc" }],
      take: 200
    });
  },

  listMembers() {
    return prisma.member.findMany({
      where: { deletedAt: null, status: MemberStatus.ACTIVE },
      select: { id: true, name: true, nickname: true, status: true },
      orderBy: { name: "asc" }
    });
  },

  listAvailableMembers(ministryId: string, allowMinistryException: boolean) {
    return prisma.member.findMany({
      where: {
        deletedAt: null,
        status: MemberStatus.ACTIVE,
        ...(allowMinistryException
          ? {}
          : {
              memberMinistries: {
                some: {
                  ministryId,
                  status: "ACTIVE",
                  exitDate: null,
                  deletedAt: null,
                  ministry: { isActive: true, deletedAt: null }
                }
              }
            })
      },
      select: { id: true, name: true, nickname: true, status: true },
      orderBy: { name: "asc" }
    });
  },

  listCalendar(filters: Pick<ScheduleListQueryInput, "dateFrom" | "dateTo" | "ministryId" | "status">) {
    return prisma.schedule.findMany({
      where: buildScheduleWhere({
        ...filters,
        page: 1,
        pageSize: 50,
        sortBy: "date",
        sortOrder: "asc"
      }),
      select: scheduleSelect,
      orderBy: [{ date: "asc" }, { startTime: "asc" }]
    });
  },

  countByMinistry(filters: Pick<ScheduleListQueryInput, "dateFrom" | "dateTo" | "status"> = {}) {
    return prisma.schedule.groupBy({
      by: ["ministryId"],
      where: buildScheduleWhere({
        ...filters,
        page: 1,
        pageSize: 50,
        sortBy: "date",
        sortOrder: "asc"
      }),
      _count: { _all: true }
    });
  },

  countMembersByStatus(filters: Pick<ScheduleListQueryInput, "dateFrom" | "dateTo" | "ministryId"> = {}) {
    return prisma.scheduleMember.groupBy({
      by: ["status"],
      where: {
        deletedAt: null,
        schedule: buildScheduleWhere({
          ...filters,
          page: 1,
          pageSize: 50,
          sortBy: "date",
          sortOrder: "asc"
        })
      },
      _count: { _all: true }
    });
  },

  listTopParticipatingMembers(
    filters: Pick<ScheduleListQueryInput, "dateFrom" | "dateTo" | "ministryId"> = {},
    limit = 10
  ) {
    return prisma.scheduleMember.groupBy({
      by: ["memberId"],
      where: {
        deletedAt: null,
        schedule: buildScheduleWhere({
          ...filters,
          page: 1,
          pageSize: 50,
          sortBy: "date",
          sortOrder: "asc"
        })
      },
      _count: { _all: true },
      orderBy: { _count: { memberId: "desc" } },
      take: limit
    });
  }
};
