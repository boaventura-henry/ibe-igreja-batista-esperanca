import { AnnouncementAudience, AnnouncementStatus, Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { announcementRepository, type AnnouncementRecord } from "@/repositories";
import { announcementNotificationService } from "@/services/announcement-notification.service";
import { notificationPublisher } from "@/services/notification-publisher.service";
import type { AnnouncementListResult, AnnouncementSummary, PortalAnnouncementListResult } from "@/types";
import type {
  AnnouncementCreateInput,
  AnnouncementListQueryInput,
  AnnouncementUpdateInput
} from "@/validators";

const MAX_ANNOUNCEMENT_TRANSACTION_ATTEMPTS = 3;
const TRANSIENT_TRANSACTION_CODES = new Set(["P2034", "40001", "40P01"]);

function transientTransactionCode(error: unknown): string | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return TRANSIENT_TRANSACTION_CODES.has(error.code) ? error.code : null;
  if (!error || typeof error !== "object") return null;
  const candidate = error as { code?: unknown; cause?: unknown };
  if (typeof candidate.code === "string" && TRANSIENT_TRANSACTION_CODES.has(candidate.code)) return candidate.code;
  return candidate.cause ? transientTransactionCode(candidate.cause) : null;
}

async function runAnnouncementTransaction<T>(operation: (database: Prisma.TransactionClient) => Promise<T>) {
  for (let attempt = 1; attempt <= MAX_ANNOUNCEMENT_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await announcementRepository.transaction(operation);
    } catch (error) {
      if (!transientTransactionCode(error) || attempt === MAX_ANNOUNCEMENT_TRANSACTION_ATTEMPTS) throw error;
    }
  }
  throw new Error("Announcement transaction retry limit reached.");
}

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
    if (data.status !== AnnouncementStatus.DRAFT) {
      throw new AppError("Use a acao de publicar para disponibilizar um comunicado.", 403, "ANNOUNCEMENT_PUBLISH_ACTION_REQUIRED");
    }
    ensureDateRange(data.publishAt, data.expiresAt);
    await ensureMinistryForAudience(data.audience, data.ministryId);

    return serialize(await announcementRepository.create(data, userId));
  },

  async update(id: string, data: AnnouncementUpdateInput, userId: string) {
    const current = await announcementRepository.findById(id);

    if (!current) {
      throw new AppError("Comunicado nao encontrado.", 404, "ANNOUNCEMENT_NOT_FOUND");
    }

    if (current.status === AnnouncementStatus.ARCHIVED) {
      throw new AppError("Comunicado arquivado e somente para consulta.", 409, "ANNOUNCEMENT_ARCHIVED");
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

    const notificationIds: string[] = [];
    const deleted = await runAnnouncementTransaction(async (database) => {
      const transactionalCurrent = await announcementRepository.findById(id, database);
      if (!transactionalCurrent) return null;
      if (transactionalCurrent.status === AnnouncementStatus.PUBLISHED) {
        const version = await announcementRepository.incrementNotificationVersion(id, database);
        const batch = await announcementNotificationService.cancelled(
          { ...transactionalCurrent, notificationVersion: version.notificationVersion },
          userId,
          database
        );
        notificationIds.push(...batch.notificationIds);
      }
      const result = await announcementRepository.softDeleteWithinTransaction(id, userId, database);
      return result.count ? { id, deletedAt: new Date() } : null;
    });
    if (!deleted) throw new AppError("Comunicado nao encontrado.", 404, "ANNOUNCEMENT_NOT_FOUND");
    await notificationPublisher.deliverPush(notificationIds);
    return deleted;
  },

  async publish(id: string, userId: string) {
    const notificationIds: string[] = [];
    const announcement = await runAnnouncementTransaction(async (database) => {
      const current = await announcementRepository.findById(id, database);
      if (!current) return null;
      if (current.status === AnnouncementStatus.PUBLISHED) return current;
      if (current.status === AnnouncementStatus.ARCHIVED) {
        throw new AppError("Comunicado arquivado nao pode ser publicado.", 409, "ANNOUNCEMENT_ARCHIVED");
      }
      ensureDateRange(current.publishAt, current.expiresAt);
      const published = await announcementRepository.transitionStatus(
        id,
        [AnnouncementStatus.DRAFT],
        AnnouncementStatus.PUBLISHED,
        userId,
        database,
        { publishedAt: new Date(), incrementNotificationVersion: true }
      );
      if (!published) {
        const concurrent = await announcementRepository.findById(id, database);
        if (concurrent?.status === AnnouncementStatus.PUBLISHED) return concurrent;
        return null;
      }
      const batch = await announcementNotificationService.publishInitial(published, userId, database);
      notificationIds.push(...batch.notificationIds);
      return published;
    });
    if (!announcement) throw new AppError("Comunicado nao encontrado.", 404, "ANNOUNCEMENT_NOT_FOUND");
    await notificationPublisher.deliverPush(notificationIds);
    return serialize(announcement);
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
