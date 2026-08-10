import { EventStatus, MemberStatus, Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { eventRepository, type EventRecord } from "@/repositories";
import { eventNotificationService } from "@/services/event-notification.service";
import { notificationPublisher } from "@/services/notification-publisher.service";
import type { EventListResult, EventSummary } from "@/types";
import { createSlug } from "@/utils";
import type { EventCreateInput, EventListQueryInput, EventUpdateInput } from "@/validators";
import { getMemberDisplayName } from "@/utils";

const SLUG_WRITE_ATTEMPTS = 3;

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function serializeDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

function serialize(event: EventRecord): EventSummary {
  return {
    id: event.id,
    title: event.title,
    slug: event.slug,
    description: event.description,
    type: event.type,
    status: event.status,
    ministry: event.ministry,
    responsibleMember: event.responsibleMember ? { ...event.responsibleMember, displayName: getMemberDisplayName(event.responsibleMember) } : null,
    startDate: event.startDate.toISOString(),
    endDate: serializeDate(event.endDate),
    startTime: event.startTime,
    endTime: event.endTime,
    location: event.location,
    address: event.address,
    capacity: event.capacity,
    requiresRegistration: event.requiresRegistration,
    isPublic: event.isPublic,
    imageUrl: event.imageUrl,
    observations: event.observations,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString()
  };
}

async function createUniqueSlug(title: string, currentId?: string) {
  const baseSlug = createSlug(title);
  let slug = baseSlug || "evento";
  let suffix = 1;

  while (true) {
    const existing = await eventRepository.findBySlug(slug);

    if (!existing || existing.id === currentId) {
      return slug;
    }

    slug = `${baseSlug || "evento"}-${suffix++}`;
  }
}

function ensureDateRange(startDate: Date | undefined, endDate: Date | null | undefined) {
  if (startDate && endDate && endDate < startDate) {
    throw new AppError("A data final nao pode ser menor que a data inicial.", 400, "EVENT_INVALID_DATE_RANGE");
  }
}

async function ensureMinistry(ministryId: string | null | undefined) {
  if (!ministryId) {
    return;
  }

  const ministry = await eventRepository.findMinistryById(ministryId);

  if (!ministry) {
    throw new AppError("Ministerio nao encontrado.", 404, "MINISTRY_NOT_FOUND");
  }

  if (!ministry.isActive) {
    throw new AppError("Eventos devem usar ministerios ativos.", 409, "MINISTRY_INACTIVE");
  }
}

async function ensureResponsibleMember(memberId: string | null | undefined) {
  if (!memberId) {
    return;
  }

  const member = await eventRepository.findMemberById(memberId);

  if (!member) {
    throw new AppError("Responsavel nao encontrado.", 404, "MEMBER_NOT_FOUND");
  }

  if (member.status !== MemberStatus.ACTIVE) {
    throw new AppError("O responsavel do evento deve ser um membro ativo.", 409, "MEMBER_NOT_ACTIVE");
  }
}

function ensureEditableFields(current: EventRecord, data: EventUpdateInput) {
  if (data.status !== undefined) {
    throw new AppError(
      "Use as acoes de publicar, cancelar ou concluir para alterar o status do evento.",
      403,
      "EVENT_STATUS_ACTION_REQUIRED"
    );
  }

  if (current.status === EventStatus.ARCHIVED) {
    throw new AppError("Evento arquivado e somente para consulta.", 409, "EVENT_ARCHIVED");
  }

  if (current.status === EventStatus.COMPLETED) {
    const changedFields = Object.keys(data).filter((key) => key !== "observations");

    if (changedFields.length > 0) {
      throw new AppError("Evento concluido permite alterar apenas observacoes.", 409, "EVENT_COMPLETED");
    }
  }
}

function hasReminderRelevantChange(current: EventRecord, data: EventUpdateInput) {
  const currentDate = current.startDate.toISOString().slice(0, 10);
  return (
    (data.startDate !== undefined && data.startDate.toISOString().slice(0, 10) !== currentDate) ||
    (data.startTime !== undefined && data.startTime !== current.startTime)
  );
}

export const eventService = {
  async list(filters: EventListQueryInput): Promise<EventListResult> {
    const [result, ministries, members] = await Promise.all([
      eventRepository.list(filters),
      eventRepository.listMinistries(),
      eventRepository.listMembers()
    ]);

    return {
      events: result.events.map(serialize),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / filters.pageSize))
      },
      filters: { ministries, members: members.map((member) => ({ ...member, displayName: getMemberDisplayName(member) })) }
    };
  },

  async listPublicPublished() {
    return (await eventRepository.listPublicPublished()).map(serialize);
  },

  async getById(id: string) {
    const event = await eventRepository.findById(id);

    if (!event) {
      throw new AppError("Evento nao encontrado.", 404, "EVENT_NOT_FOUND");
    }

    return serialize(event);
  },

  async create(data: EventCreateInput, userId: string) {
    ensureDateRange(data.startDate, data.endDate);
    await Promise.all([
      ensureMinistry(data.ministryId),
      ensureResponsibleMember(data.responsibleMemberId)
    ]);

    for (let attempt = 1; attempt <= SLUG_WRITE_ATTEMPTS; attempt += 1) {
      const slug = await createUniqueSlug(data.title);

      try {
        const notificationIds: string[] = [];
        const created = await eventRepository.transaction(async (database) => {
          const isPublished = data.status === EventStatus.PUBLISHED;
          const event = await eventRepository.create(
            data,
            slug,
            userId,
            database,
            isPublished ? { publishedAt: new Date(), notificationVersion: 1 } : undefined
          );
          if (isPublished) {
            const batch = await eventNotificationService.publishInitial(event, userId, database);
            notificationIds.push(...batch.notificationIds);
          }
          return event;
        });
        await notificationPublisher.deliverPush(notificationIds);
        return serialize(created);
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error;
        }

        if (attempt === SLUG_WRITE_ATTEMPTS) {
          throw new AppError("Nao foi possivel gerar um identificador unico para o evento.", 409, "EVENT_SLUG_CONFLICT");
        }
      }
    }

    throw new AppError("Nao foi possivel gerar um identificador unico para o evento.", 409, "EVENT_SLUG_CONFLICT");
  },

  async update(id: string, data: EventUpdateInput, userId: string) {
    const current = await eventRepository.findById(id);

    if (!current) {
      throw new AppError("Evento nao encontrado.", 404, "EVENT_NOT_FOUND");
    }

    ensureEditableFields(current, data);

    const nextStartDate = data.startDate ?? current.startDate;
    const nextEndDate = data.endDate === undefined ? current.endDate : data.endDate;

    ensureDateRange(nextStartDate, nextEndDate);
    await Promise.all([
      ensureMinistry(data.ministryId),
      ensureResponsibleMember(data.responsibleMemberId)
    ]);

    const save = async (nextData: EventUpdateInput & { slug?: string }) => {
      const notificationIds: string[] = [];
      const updated = await eventRepository.transaction(async (database) => {
        const transactionalCurrent = await eventRepository.findById(id, database);
        if (!transactionalCurrent) return null;
        ensureEditableFields(transactionalCurrent, nextData);
        const result = await eventRepository.update(id, nextData, userId, database);
        if (
          result.status === EventStatus.PUBLISHED &&
          result.publishedAt !== null &&
          hasReminderRelevantChange(transactionalCurrent, nextData)
        ) {
          const version = await eventRepository.incrementNotificationVersion(id, database);
          const versioned = { ...result, notificationVersion: version.notificationVersion };
          const batch = await eventNotificationService.rescheduleReminders(versioned, userId, database);
          notificationIds.push(...batch.notificationIds);
          return versioned;
        }
        return result;
      });
      if (!updated) throw new AppError("Evento nao encontrado.", 404, "EVENT_NOT_FOUND");
      await notificationPublisher.deliverPush(notificationIds);
      return serialize(updated);
    };

    if (!data.title) {
      return save(data);
    }

    for (let attempt = 1; attempt <= SLUG_WRITE_ATTEMPTS; attempt += 1) {
      const nextData = { ...data, slug: await createUniqueSlug(data.title, id) };

      try {
        return await save(nextData);
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error;
        }

        if (attempt === SLUG_WRITE_ATTEMPTS) {
          throw new AppError("Nao foi possivel gerar um identificador unico para o evento.", 409, "EVENT_SLUG_CONFLICT");
        }
      }
    }

    throw new AppError("Nao foi possivel gerar um identificador unico para o evento.", 409, "EVENT_SLUG_CONFLICT");
  },

  async remove(id: string, userId: string) {
    const current = await eventRepository.findById(id);
    if (!current) throw new AppError("Evento nao encontrado.", 404, "EVENT_NOT_FOUND");
    if (current.status === EventStatus.ARCHIVED) {
      throw new AppError("Evento arquivado e somente para consulta.", 409, "EVENT_ARCHIVED");
    }
    const notificationIds: string[] = [];
    const deleted = await eventRepository.transaction(async (database) => {
      const transactionalCurrent = await eventRepository.findById(id, database);
      if (!transactionalCurrent) return null;
      if (transactionalCurrent.status === EventStatus.PUBLISHED) {
        await eventRepository.incrementNotificationVersion(id, database);
        await eventNotificationService.cancelPendingReminders(id, database);
      }
      const result = await eventRepository.softDeleteWithinTransaction(id, userId, database);
      return result.count ? { id, deletedAt: new Date() } : null;
    });
    if (!deleted) throw new AppError("Evento nao encontrado.", 404, "EVENT_NOT_FOUND");
    await notificationPublisher.deliverPush(notificationIds);
    return deleted;
  },

  async publish(id: string, userId: string) {
    const notificationIds: string[] = [];
    const event = await eventRepository.transaction(async (database) => {
      const current = await eventRepository.findById(id, database);
      if (!current) return null;
      if (current.status === EventStatus.PUBLISHED && current.publishedAt) return current;
      if (current.status === EventStatus.CANCELED) throw new AppError("Evento cancelado nao pode ser publicado.", 409, "EVENT_CANCELED");
      if (current.status === EventStatus.COMPLETED) throw new AppError("Evento concluido nao pode ser publicado.", 409, "EVENT_COMPLETED");
      if (current.status === EventStatus.ARCHIVED) throw new AppError("Evento arquivado nao pode ser publicado.", 409, "EVENT_ARCHIVED");
      const published = await eventRepository.transitionStatus(
        id, [EventStatus.DRAFT], EventStatus.PUBLISHED, userId, database,
        { publishedAt: new Date(), incrementNotificationVersion: true }
      );
      if (!published) {
        const concurrent = await eventRepository.findById(id, database);
        if (concurrent?.status === EventStatus.PUBLISHED) return concurrent;
        return null;
      }
      const batch = await eventNotificationService.publishInitial(published, userId, database);
      notificationIds.push(...batch.notificationIds);
      return published;
    });
    if (!event) throw new AppError("Evento nao encontrado.", 404, "EVENT_NOT_FOUND");
    await notificationPublisher.deliverPush(notificationIds);
    return serialize(event);
  },

  async cancel(id: string, userId: string) {
    return this.finish(id, userId, EventStatus.CANCELED);
  },

  async complete(id: string, userId: string) {
    return this.finish(id, userId, EventStatus.COMPLETED);
  },

  async finish(id: string, userId: string, status: EventStatus) {
    const event = await eventRepository.transaction(async (database) => {
      const current = await eventRepository.findById(id, database);
      if (!current) return null;
      if (current.status === EventStatus.ARCHIVED) throw new AppError("Evento arquivado nao pode ser alterado.", 409, "EVENT_ARCHIVED");
      if (current.status === EventStatus.CANCELED && status === EventStatus.COMPLETED) throw new AppError("Evento cancelado nao pode ser concluido.", 409, "EVENT_NOT_COMPLETABLE");
      if (current.status === EventStatus.COMPLETED && status === EventStatus.CANCELED) throw new AppError("Evento concluido nao pode ser cancelado.", 409, "EVENT_COMPLETED");
      if (current.status === status) return current;
      const result = await eventRepository.transitionStatus(
        id, [EventStatus.DRAFT, EventStatus.PUBLISHED], status, userId, database
      );
      if (result && current.status === EventStatus.PUBLISHED) {
        await eventRepository.incrementNotificationVersion(id, database);
        await eventNotificationService.cancelPendingReminders(id, database);
      }
      return result;
    });
    if (!event) throw new AppError("Evento nao encontrado.", 404, "EVENT_NOT_FOUND");
    return serialize(event);
  }
};
