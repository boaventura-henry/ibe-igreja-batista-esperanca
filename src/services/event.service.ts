import { EventStatus, MemberStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { eventRepository, type EventRecord } from "@/repositories";
import type { EventListResult, EventSummary } from "@/types";
import { createSlug } from "@/utils";
import type { EventCreateInput, EventListQueryInput, EventUpdateInput } from "@/validators";

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
    responsibleMember: event.responsibleMember,
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

  if (current.status === EventStatus.COMPLETED) {
    const changedFields = Object.keys(data).filter((key) => key !== "observations");

    if (changedFields.length > 0) {
      throw new AppError("Evento concluido permite alterar apenas observacoes.", 409, "EVENT_COMPLETED");
    }
  }
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
      filters: { ministries, members }
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

    const slug = await createUniqueSlug(data.title);

    return serialize(await eventRepository.create(data, slug, userId));
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

    const nextData = data.title ? { ...data, slug: await createUniqueSlug(data.title, id) } : data;

    return serialize(await eventRepository.update(id, nextData, userId));
  },

  async remove(id: string, userId: string) {
    await this.getById(id);

    return eventRepository.softDelete(id, userId);
  },

  async publish(id: string, userId: string) {
    const current = await this.getById(id);

    if (current.status === EventStatus.CANCELED) {
      throw new AppError("Evento cancelado nao pode ser publicado.", 409, "EVENT_CANCELED");
    }

    if (current.status === EventStatus.COMPLETED) {
      throw new AppError("Evento concluido nao pode ser publicado.", 409, "EVENT_COMPLETED");
    }

    return serialize(await eventRepository.updateStatus(id, EventStatus.PUBLISHED, userId));
  },

  async cancel(id: string, userId: string) {
    const current = await this.getById(id);

    if (current.status === EventStatus.COMPLETED) {
      throw new AppError("Evento concluido nao pode ser cancelado.", 409, "EVENT_COMPLETED");
    }

    return serialize(await eventRepository.updateStatus(id, EventStatus.CANCELED, userId));
  },

  async complete(id: string, userId: string) {
    await this.getById(id);

    return serialize(await eventRepository.updateStatus(id, EventStatus.COMPLETED, userId));
  }
};
