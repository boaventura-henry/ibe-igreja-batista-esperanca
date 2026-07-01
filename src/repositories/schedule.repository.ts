import { MemberStatus, Prisma, ScheduleStatus } from "@prisma/client";
import { prisma } from "@/prisma/client";
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
    select: { id: true, name: true, status: true }
  },
  replacedByMember: {
    select: { id: true, name: true, status: true }
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
  observations: true,
  createdAt: true,
  updatedAt: true,
  ministry: {
    select: { id: true, name: true, color: true, isActive: true }
  },
  members: {
    where: { deletedAt: null },
    select: scheduleMemberSelect,
    orderBy: [{ role: "asc" }, { member: { name: "asc" } }]
  }
} satisfies Prisma.ScheduleSelect;

export type ScheduleRecord = Prisma.ScheduleGetPayload<{ select: typeof scheduleSelect }>;
export type ScheduleMemberRecord = Prisma.ScheduleMemberGetPayload<{ select: typeof scheduleMemberSelect }>;

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
    date: dateFromInput(data.date),
    startTime: data.startTime,
    endTime: data.endTime,
    location: data.location,
    status: data.status,
    observations: data.observations
  };
}

function updateData(data: ScheduleUpdateInput): Prisma.ScheduleUncheckedUpdateInput {
  return {
    title: data.title,
    description: data.description,
    ministryId: data.ministryId,
    date: data.date ? dateFromInput(data.date) : undefined,
    startTime: data.startTime,
    endTime: data.endTime,
    location: data.location,
    status: data.status,
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

function buildWhere(filters: ScheduleListQueryInput): Prisma.ScheduleWhereInput {
  const and: Prisma.ScheduleWhereInput[] = [{ deletedAt: null }];

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
  async list(filters: ScheduleListQueryInput) {
    const where = buildWhere(filters);
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

  findById(id: string) {
    return prisma.schedule.findFirst({ where: { id, deletedAt: null }, select: scheduleSelect });
  },

  findMinistryById(id: string) {
    return prisma.ministry.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, isActive: true }
    });
  },

  findMemberById(id: string) {
    return prisma.member.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, status: true }
    });
  },

  findActiveScheduleMember(scheduleId: string, memberId: string, ignoreId?: string) {
    return prisma.scheduleMember.findFirst({
      where: { scheduleId, memberId, deletedAt: null, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
      select: { id: true }
    });
  },

  findScheduleMemberTimeConflict(memberId: string, schedule: ScheduleTimeWindow, ignoreId?: string) {
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

    return prisma.scheduleMember.findFirst({
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

  findScheduleMemberById(id: string, scheduleId?: string) {
    return prisma.scheduleMember.findFirst({
      where: { id, deletedAt: null, ...(scheduleId ? { scheduleId } : {}) },
      select: { ...scheduleMemberSelect, schedule: { select: { id: true, status: true, ministryId: true } } }
    });
  },

  findActiveMemberMinistry(memberId: string, ministryId: string) {
    return prisma.memberMinistry.findFirst({
      where: { memberId, ministryId, status: "ACTIVE", deletedAt: null },
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

  updateStatus(id: string, status: ScheduleStatus, userId: string) {
    return prisma.schedule.update({
      where: { id },
      data: { status, updatedById: userId },
      select: scheduleSelect
    });
  },

  softDelete(id: string, userId: string) {
    return prisma.schedule.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: userId },
      select: { id: true, deletedAt: true }
    });
  },

  addMember(scheduleId: string, data: ScheduleMemberCreateInput, userId: string) {
    return prisma.scheduleMember.create({
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

  updateMember(id: string, data: ScheduleMemberUpdateInput, userId: string) {
    return prisma.scheduleMember.update({
      where: { id },
      data: { ...scheduleMemberData(data), updatedById: userId },
      select: scheduleMemberSelect
    });
  },

  softDeleteMember(id: string, userId: string) {
    return prisma.scheduleMember.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: userId },
      select: { id: true, deletedAt: true }
    });
  },

  listMinistries() {
    return prisma.ministry.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, name: true, color: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }]
    });
  },

  listMembers() {
    return prisma.member.findMany({
      where: { deletedAt: null, status: { notIn: [MemberStatus.INACTIVE, MemberStatus.DECEASED] } },
      select: { id: true, name: true, status: true },
      orderBy: { name: "asc" }
    });
  },

  listCalendar(filters: Pick<ScheduleListQueryInput, "dateFrom" | "dateTo" | "ministryId" | "status">) {
    return prisma.schedule.findMany({
      where: buildWhere({
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
      where: buildWhere({
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
        schedule: buildWhere({
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
        schedule: buildWhere({
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
