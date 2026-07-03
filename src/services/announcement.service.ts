import { AnnouncementAudience, AnnouncementStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { announcementRepository, type AnnouncementRecord } from "@/repositories";
import type { AnnouncementListResult, AnnouncementSummary, PortalAnnouncementListResult } from "@/types";
import type {
  AnnouncementCreateInput,
  AnnouncementListQueryInput,
  AnnouncementUpdateInput
} from "@/validators";

function serializeDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

function serialize(announcement: AnnouncementRecord, userId?: string): AnnouncementSummary {
  const read = userId ? announcement.reads.find((item) => item.userId === userId) : announcement.reads[0];

  return {
    id: announcement.id,
    title: announcement.title,
    content: announcement.content,
    status: announcement.status,
    audience: announcement.audience,
    ministry: announcement.ministry,
    isPinned: announcement.isPinned,
    publishAt: serializeDate(announcement.publishAt),
    expiresAt: serializeDate(announcement.expiresAt),
    externalLink: announcement.externalLink,
    readAt: serializeDate(read?.readAt ?? null),
    createdAt: announcement.createdAt.toISOString(),
    updatedAt: announcement.updatedAt.toISOString()
  };
}

function ensureDateRange(publishAt: Date | null | undefined, expiresAt: Date | null | undefined) {
  if (publishAt && expiresAt && expiresAt < publishAt) {
    throw new AppError("A data de expiracao nao pode ser menor que a data de publicacao.", 400, "ANNOUNCEMENT_INVALID_DATE_RANGE");
  }
}

async function ensureMinistryForAudience(audience: AnnouncementAudience | undefined, ministryId: string | null | undefined) {
  if (audience !== AnnouncementAudience.MINISTRY) {
    return;
  }

  if (!ministryId) {
    throw new AppError("Informe o ministerio para este publico-alvo.", 400, "ANNOUNCEMENT_MINISTRY_REQUIRED");
  }

  const ministry = await announcementRepository.findMinistryById(ministryId);

  if (!ministry) {
    throw new AppError("Ministerio nao encontrado ou inativo.", 404, "MINISTRY_NOT_FOUND");
  }
}

export const announcementService = {
  async list(filters: AnnouncementListQueryInput): Promise<AnnouncementListResult> {
    const [result, ministries] = await Promise.all([
      announcementRepository.list(filters),
      announcementRepository.listMinistries()
    ]);

    return {
      announcements: result.announcements.map((announcement) => serialize(announcement)),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / filters.pageSize))
      },
      filters: { ministries }
    };
  },

  async getById(id: string) {
    const announcement = await announcementRepository.findById(id);

    if (!announcement) {
      throw new AppError("Comunicado nao encontrado.", 404, "ANNOUNCEMENT_NOT_FOUND");
    }

    return serialize(announcement);
  },

  async create(data: AnnouncementCreateInput, userId: string) {
    ensureDateRange(data.publishAt, data.expiresAt);
    await ensureMinistryForAudience(data.audience, data.ministryId);

    return serialize(await announcementRepository.create(data, userId));
  },

  async update(id: string, data: AnnouncementUpdateInput, userId: string) {
    const current = await announcementRepository.findById(id);

    if (!current) {
      throw new AppError("Comunicado nao encontrado.", 404, "ANNOUNCEMENT_NOT_FOUND");
    }

    const nextAudience = data.audience ?? current.audience;
    const nextMinistryId = data.ministryId === undefined ? current.ministry?.id : data.ministryId;
    const nextPublishAt = data.publishAt === undefined ? current.publishAt : data.publishAt;
    const nextExpiresAt = data.expiresAt === undefined ? current.expiresAt : data.expiresAt;

    ensureDateRange(nextPublishAt, nextExpiresAt);
    await ensureMinistryForAudience(nextAudience, nextMinistryId);

    return serialize(await announcementRepository.update(id, data, userId));
  },

  async remove(id: string, userId: string) {
    await this.getById(id);

    return announcementRepository.softDelete(id, userId);
  },

  async publish(id: string, userId: string) {
    const current = await announcementRepository.findById(id);

    if (!current) {
      throw new AppError("Comunicado nao encontrado.", 404, "ANNOUNCEMENT_NOT_FOUND");
    }

    if (current.status === AnnouncementStatus.ARCHIVED) {
      throw new AppError("Comunicado arquivado nao pode ser publicado.", 409, "ANNOUNCEMENT_ARCHIVED");
    }

    ensureDateRange(current.publishAt, current.expiresAt);

    return serialize(await announcementRepository.updateStatus(id, AnnouncementStatus.PUBLISHED, userId));
  },

  async archive(id: string, userId: string) {
    await this.getById(id);

    return serialize(await announcementRepository.updateStatus(id, AnnouncementStatus.ARCHIVED, userId));
  },

  async listForPortal(userId: string, memberId: string | null | undefined): Promise<PortalAnnouncementListResult> {
    const announcements = await announcementRepository.listPortalAnnouncements(userId, memberId);

    return {
      userWithoutMember: !memberId,
      announcements: announcements.map((announcement) => serialize(announcement, userId))
    };
  },

  async markRead(id: string, userId: string, memberId: string | null | undefined) {
    const announcement = await announcementRepository.findPortalAnnouncementForUser(id, memberId);

    if (!announcement) {
      throw new AppError("Comunicado nao encontrado para este usuario.", 404, "ANNOUNCEMENT_NOT_AVAILABLE");
    }

    const read = await announcementRepository.markRead(id, userId);

    return { id, readAt: read.readAt.toISOString() };
  }
};
