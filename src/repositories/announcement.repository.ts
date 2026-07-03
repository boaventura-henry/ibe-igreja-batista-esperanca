import { AnnouncementAudience, AnnouncementStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/prisma/client";
import type {
  AnnouncementCreateInput,
  AnnouncementListQueryInput,
  AnnouncementUpdateInput
} from "@/validators";

const announcementSelect = {
  id: true,
  title: true,
  content: true,
  status: true,
  audience: true,
  ministry: { select: { id: true, name: true, color: true } },
  isPinned: true,
  publishAt: true,
  expiresAt: true,
  externalLink: true,
  reads: {
    select: {
      userId: true,
      readAt: true
    }
  },
  createdAt: true,
  updatedAt: true
} satisfies Prisma.AnnouncementSelect;

export type AnnouncementRecord = Prisma.AnnouncementGetPayload<{ select: typeof announcementSelect }>;

function buildWhere(filters: AnnouncementListQueryInput): Prisma.AnnouncementWhereInput {
  const and: Prisma.AnnouncementWhereInput[] = [{ deletedAt: null }];

  if (filters.search) {
    and.push({
      OR: [
        { title: { contains: filters.search, mode: "insensitive" } },
        { content: { contains: filters.search, mode: "insensitive" } },
        { ministry: { name: { contains: filters.search, mode: "insensitive" } } }
      ]
    });
  }

  if (filters.status) and.push({ status: filters.status });
  if (filters.audience) and.push({ audience: filters.audience });
  if (filters.ministryId) and.push({ ministryId: filters.ministryId });

  return { AND: and };
}

function createData(data: AnnouncementCreateInput, userId: string): Prisma.AnnouncementUncheckedCreateInput {
  return {
    title: data.title,
    content: data.content,
    status: data.status,
    audience: data.audience,
    ministryId: data.audience === AnnouncementAudience.MINISTRY ? data.ministryId : null,
    isPinned: data.isPinned,
    publishAt: data.publishAt,
    expiresAt: data.expiresAt,
    externalLink: data.externalLink,
    createdById: userId,
    updatedById: userId
  };
}

function updateData(data: AnnouncementUpdateInput): Prisma.AnnouncementUncheckedUpdateInput {
  return {
    title: data.title,
    content: data.content,
    audience: data.audience,
    ministryId:
      data.audience === undefined
        ? data.ministryId
        : data.audience === AnnouncementAudience.MINISTRY
          ? data.ministryId
          : null,
    isPinned: data.isPinned,
    publishAt: data.publishAt,
    expiresAt: data.expiresAt,
    externalLink: data.externalLink
  };
}

export const announcementRepository = {
  async list(filters: AnnouncementListQueryInput) {
    const where = buildWhere(filters);
    const skip = (filters.page - 1) * filters.pageSize;
    const orderBy = { [filters.sortBy]: filters.sortDirection } satisfies Prisma.AnnouncementOrderByWithRelationInput;

    const [announcements, total] = await prisma.$transaction([
      prisma.announcement.findMany({
        where,
        select: announcementSelect,
        orderBy,
        skip,
        take: filters.pageSize
      }),
      prisma.announcement.count({ where })
    ]);

    return { announcements, total };
  },

  findById(id: string) {
    return prisma.announcement.findFirst({
      where: { id, deletedAt: null },
      select: announcementSelect
    });
  },

  findMinistryById(id: string) {
    return prisma.ministry.findFirst({
      where: { id, deletedAt: null, isActive: true },
      select: { id: true }
    });
  },

  create(data: AnnouncementCreateInput, userId: string) {
    return prisma.announcement.create({
      data: createData(data, userId),
      select: announcementSelect
    });
  },

  update(id: string, data: AnnouncementUpdateInput, userId: string) {
    return prisma.announcement.update({
      where: { id },
      data: { ...updateData(data), updatedById: userId },
      select: announcementSelect
    });
  },

  updateStatus(id: string, status: AnnouncementStatus, userId: string) {
    return prisma.announcement.update({
      where: { id },
      data: { status, updatedById: userId },
      select: announcementSelect
    });
  },

  softDelete(id: string, userId: string) {
    return prisma.announcement.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: userId },
      select: { id: true, deletedAt: true }
    });
  },

  listMinistries() {
    return prisma.ministry.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" }
    });
  },

  listPortalAnnouncements(userId: string, memberId: string | null | undefined) {
    const now = new Date();

    return prisma.announcement.findMany({
      where: {
        deletedAt: null,
        status: AnnouncementStatus.PUBLISHED,
        OR: [{ publishAt: null }, { publishAt: { lte: now } }],
        AND: [
          {
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
          },
          {
            OR: [
              { audience: AnnouncementAudience.ALL },
              { audience: AnnouncementAudience.PORTAL_ONLY },
              ...(memberId
                ? [
                    {
                      audience: AnnouncementAudience.MINISTRY,
                      ministry: {
                        memberMinistries: {
                          some: {
                            memberId,
                            status: "ACTIVE",
                            deletedAt: null
                          }
                        }
                      }
                    } satisfies Prisma.AnnouncementWhereInput
                  ]
                : [])
            ]
          }
        ]
      },
      select: {
        ...announcementSelect,
        reads: {
          where: { userId },
          select: { userId: true, readAt: true }
        }
      },
      orderBy: [{ isPinned: "desc" }, { publishAt: "desc" }, { createdAt: "desc" }],
      take: 50
    });
  },

  findPortalAnnouncementForUser(id: string, memberId: string | null | undefined) {
    const now = new Date();

    return prisma.announcement.findFirst({
      where: {
        id,
        deletedAt: null,
        status: AnnouncementStatus.PUBLISHED,
        OR: [{ publishAt: null }, { publishAt: { lte: now } }],
        AND: [
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          {
            OR: [
              { audience: AnnouncementAudience.ALL },
              { audience: AnnouncementAudience.PORTAL_ONLY },
              ...(memberId
                ? [
                    {
                      audience: AnnouncementAudience.MINISTRY,
                      ministry: {
                        memberMinistries: { some: { memberId, status: "ACTIVE", deletedAt: null } }
                      }
                    } satisfies Prisma.AnnouncementWhereInput
                  ]
                : [])
            ]
          }
        ]
      },
      select: { id: true }
    });
  },

  markRead(announcementId: string, userId: string) {
    return prisma.announcementRead.upsert({
      where: { announcementId_userId: { announcementId, userId } },
      update: {},
      create: { announcementId, userId },
      select: { id: true, readAt: true }
    });
  },

  countPublished() {
    return prisma.announcement.count({
      where: { deletedAt: null, status: AnnouncementStatus.PUBLISHED }
    });
  }
};
