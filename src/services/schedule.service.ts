import { MemberStatus, ScheduleMemberStatus, ScheduleScope, ScheduleStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";
import type { ScheduleAuthorization } from "@/lib/schedule-authorization";
import {
  scheduleRepository,
  type ScheduleDatabase,
  type ScheduleMemberRecord,
  type ScheduleRecord
} from "@/repositories";
import {
  activeScheduleRecipients,
  scheduleNotificationService,
  type ScheduleRelevantChange
} from "@/services/schedule-notification.service";
import { notificationPublisher } from "@/services/notification-publisher.service";
import type { ScheduleListResult, ScheduleMemberSummary, ScheduleSummary } from "@/types";
import type {
  ScheduleCreateInput,
  ScheduleListQueryInput,
  ScheduleMemberCreateInput,
  ScheduleMemberUpdateInput,
  ScheduleUpdateInput
} from "@/validators";
import { getMemberDisplayName } from "@/utils";

type ScheduleWindow = {
  id: string;
  date: Date;
  startTime: string | null;
  endTime: string | null;
  status: ScheduleStatus;
  ministry: { id: string };
};

type NotificationBatch = { notificationIds?: string[] };

function collectNotificationIds(target: string[], batch: NotificationBatch) {
  if (batch.notificationIds?.length) target.push(...batch.notificationIds);
}

function serializeDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

function serializeMember(member: ScheduleMemberRecord): ScheduleMemberSummary {
  const safeMember = {
    id: member.member.id,
    name: member.member.name,
    nickname: member.member.nickname,
    status: member.member.status
  };
  const safeReplacement = member.replacedByMember
    ? {
        id: member.replacedByMember.id,
        name: member.replacedByMember.name,
        nickname: member.replacedByMember.nickname,
        status: member.replacedByMember.status
      }
    : null;
  return {
    id: member.id,
    role: member.role,
    status: member.status,
    confirmedAt: serializeDate(member.confirmedAt),
    declinedAt: serializeDate(member.declinedAt),
    declineReason: member.declineReason,
    observations: member.observations,
    member: { ...safeMember, displayName: getMemberDisplayName(member.member) },
    replacedByMember: safeReplacement
      ? { ...safeReplacement, displayName: getMemberDisplayName(safeReplacement) }
      : null,
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt.toISOString()
  };
}

function serialize(schedule: ScheduleRecord): ScheduleSummary {
  return {
    id: schedule.id,
    title: schedule.title,
    description: schedule.description,
    date: schedule.date.toISOString(),
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    location: schedule.location,
    status: schedule.status,
    publishedAt: serializeDate(schedule.publishedAt),
    observations: schedule.observations,
    ministry: schedule.ministry,
    event: schedule.event
      ? {
          ...schedule.event,
          startDate: schedule.event.startDate.toISOString()
        }
      : null,
    members: schedule.members.map(serializeMember),
    createdAt: schedule.createdAt.toISOString(),
    updatedAt: schedule.updatedAt.toISOString()
  };
}

function getRelevantScheduleChanges(
  current: ScheduleRecord,
  data: ScheduleUpdateInput
): ScheduleRelevantChange[] {
  const changes: ScheduleRelevantChange[] = [];
  const currentDate = current.date.toISOString().slice(0, 10);
  const comparisons: Array<[ScheduleRelevantChange, unknown, unknown]> = [
    ["title", current.title, data.title],
    ["description", current.description ?? undefined, data.description],
    ["date", currentDate, data.date],
    ["startTime", current.startTime ?? undefined, data.startTime],
    ["endTime", current.endTime ?? undefined, data.endTime],
    ["location", current.location ?? undefined, data.location],
    ["ministryId", current.ministry.id, data.ministryId],
    ["observations", current.observations ?? undefined, data.observations]
  ];

  for (const [field, previous, next] of comparisons) {
    if (next !== undefined && next !== previous) changes.push(field);
  }
  return changes;
}

function hasNonNotifiableScheduleChange(
  current: ScheduleRecord,
  data: ScheduleUpdateInput
) {
  return (
    data.eventId !== undefined &&
    data.eventId !== (current.event?.id ?? null)
  );
}

function hasRelevantMemberChange(
  current: ScheduleMemberRecord,
  data: ScheduleMemberUpdateInput
) {
  return (
    (data.memberId !== undefined && data.memberId !== current.member.id) ||
    (data.role !== undefined && data.role !== current.role) ||
    (data.status !== undefined && data.status !== current.status) ||
    (data.replacedByMemberId !== undefined &&
      data.replacedByMemberId !== (current.replacedByMember?.id ?? null)) ||
    (data.observations !== undefined &&
      data.observations !== (current.observations ?? undefined))
  );
}

async function ensureActiveMinistry(ministryId: string) {
  const ministry = await scheduleRepository.findMinistryById(ministryId);

  if (!ministry) {
    throw new AppError("Ministerio nao encontrado.", 404, "MINISTRY_NOT_FOUND");
  }

  if (!ministry.isActive) {
    throw new AppError("Escalas precisam estar vinculadas a um ministerio ativo.", 409, "MINISTRY_INACTIVE");
  }
}

async function ensureCompatibleEvent(
  eventId: string | null | undefined,
  ministryId: string
) {
  if (!eventId) {
    return;
  }

  const event = await scheduleRepository.findEventById(eventId);

  if (!event) {
    throw new AppError("Evento nao encontrado.", 404, "EVENT_NOT_FOUND");
  }

  if (event.ministryId && event.ministryId !== ministryId) {
    throw new AppError(
      "O evento deve pertencer ao mesmo ministerio da escala.",
      409,
      "SCHEDULE_EVENT_MINISTRY_MISMATCH"
    );
  }
}

function ensureAuthorizedMinistry(ministryId: string, authorization: ScheduleAuthorization) {
  if (authorization.accessContext.scope === ScheduleScope.ALL) {
    return;
  }

  if (!authorization.accessContext.authorizedMinistryIds?.includes(ministryId)) {
    throw new AppError(
      "Voce nao pode gerenciar escalas deste ministerio.",
      403,
      "SCHEDULE_MINISTRY_FORBIDDEN"
    );
  }
}

async function ensureActiveMember(
  memberId: string,
  database?: ScheduleDatabase
) {
  const member = await scheduleRepository.findMemberById(memberId, database);

  if (!member) {
    throw new AppError("Membro nao encontrado.", 404, "MEMBER_NOT_FOUND");
  }

  if (member.status !== MemberStatus.ACTIVE) {
    throw new AppError("A escala aceita apenas membros ativos.", 409, "MEMBER_NOT_ACTIVE");
  }
}

function ensureScheduleCanReceiveMembers(schedule: ScheduleSummary | ScheduleRecord) {
  if (schedule.status === ScheduleStatus.CANCELED) {
    throw new AppError("Escala cancelada nao pode receber novos membros.", 409, "SCHEDULE_CANCELED");
  }
}

function ensureScheduleCanBeEdited(schedule: ScheduleRecord, data: ScheduleUpdateInput) {
  if (schedule.status === ScheduleStatus.COMPLETED) {
    const keys = Object.keys(data).filter((key) => key !== "observations");

    if (keys.length > 0) {
      throw new AppError("Escala concluida permite alterar apenas observacoes.", 409, "SCHEDULE_COMPLETED");
    }
  }
}

function buildScheduleWindow(schedule: ScheduleRecord, data?: ScheduleUpdateInput): ScheduleWindow {
  return {
    id: schedule.id,
    date: data?.date ? new Date(`${data.date}T00:00:00.000Z`) : schedule.date,
    startTime: data?.startTime === undefined ? schedule.startTime : data.startTime ?? null,
    endTime: data?.endTime === undefined ? schedule.endTime : data.endTime ?? null,
    status: schedule.status,
    ministry: schedule.ministry
  };
}

async function ensureNoTimeConflict(
  memberId: string,
  schedule: ScheduleWindow,
  currentScheduleMemberId?: string,
  database?: ScheduleDatabase
) {
  if (schedule.status === ScheduleStatus.CANCELED) {
    return;
  }

  const conflict = await scheduleRepository.findScheduleMemberTimeConflict(
    memberId,
    schedule,
    currentScheduleMemberId,
    database
  );

  if (conflict) {
    throw new AppError(
      "Este membro ja esta escalado em outro compromisso no mesmo horario.",
      409,
      "SCHEDULE_TIME_CONFLICT"
    );
  }
}

async function ensureNoExistingMembersTimeConflict(schedule: ScheduleRecord, data: ScheduleUpdateInput) {
  const nextSchedule = buildScheduleWindow(schedule, data);

  if (nextSchedule.status === ScheduleStatus.CANCELED) {
    return;
  }

  const conflict = await scheduleRepository.findAnyMemberTimeConflict(nextSchedule);

  if (conflict) {
    throw new AppError(
      "Um ou mais membros ja estao escalados em outro compromisso no mesmo horario.",
      409,
      "SCHEDULE_TIME_CONFLICT"
    );
  }
}

async function ensureMemberHasMinistryLinkOrException(
  memberId: string,
  ministryId: string,
  allowMinistryException: boolean | undefined,
  database?: ScheduleDatabase
) {
  const ministryLink = await scheduleRepository.findActiveMemberMinistry(
    memberId,
    ministryId,
    database
  );

  if (!ministryLink && !allowMinistryException) {
    throw new AppError(
      "Este membro n?o est? vinculado ao minist?rio da escala. Marque a op??o de exce??o para permitir.",
      409,
      "MINISTRY_EXCEPTION_REQUIRED"
    );
  }
}

async function ensureMemberRules(
  schedule: ScheduleSummary | ScheduleRecord,
  data: ScheduleMemberCreateInput | ScheduleMemberUpdateInput,
  options: {
    currentId?: string;
    currentStatus?: ScheduleMemberStatus;
    currentMemberId?: string;
    currentReplacedByMemberId?: string | null;
    database?: ScheduleDatabase;
  } = {},
) {
  const isCreate = !options.currentId;
  const nextMemberId = data.memberId ?? options.currentMemberId;
  const nextStatus = data.status ?? options.currentStatus ?? ScheduleMemberStatus.PENDING;
  const nextReplacedByMemberId =
    data.replacedByMemberId === undefined ? options.currentReplacedByMemberId : data.replacedByMemberId;
  const shouldValidatePrimaryMember = isCreate || data.memberId !== undefined;
  const shouldValidateReplacement = data.replacedByMemberId !== undefined;

  if (nextMemberId && shouldValidatePrimaryMember) {
    await ensureActiveMember(nextMemberId, options.database);

    const duplicated = await scheduleRepository.findActiveScheduleMember(
      schedule.id,
      nextMemberId,
      options.currentId,
      options.database
    );

    if (duplicated) {
      throw new AppError("Este membro ja esta nesta escala.", 409, "SCHEDULE_MEMBER_DUPLICATED");
    }

    await ensureNoTimeConflict(nextMemberId, {
      id: schedule.id,
      date: new Date(schedule.date),
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      status: schedule.status,
      ministry: schedule.ministry
    }, options.currentId, options.database);

    await ensureMemberHasMinistryLinkOrException(
      nextMemberId,
      schedule.ministry.id,
      data.allowMinistryException,
      options.database
    );
  }

  if (nextStatus === ScheduleMemberStatus.REPLACED && !nextReplacedByMemberId) {
    throw new AppError("Informe o membro substituto.", 400, "REPLACEMENT_REQUIRED");
  }

  if (nextStatus !== ScheduleMemberStatus.REPLACED && nextReplacedByMemberId) {
    throw new AppError("Use o status substituido para informar um substituto.", 400, "INVALID_REPLACEMENT_STATUS");
  }

  if (nextReplacedByMemberId && nextMemberId && nextReplacedByMemberId === nextMemberId) {
    throw new AppError("O substituto nao pode ser o mesmo membro.", 400, "INVALID_REPLACEMENT");
  }

  if (nextReplacedByMemberId && shouldValidateReplacement) {
    await ensureActiveMember(nextReplacedByMemberId, options.database);
    await ensureNoTimeConflict(nextReplacedByMemberId, {
      id: schedule.id,
      date: new Date(schedule.date),
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      status: schedule.status,
      ministry: schedule.ministry
    }, undefined, options.database);
    await ensureMemberHasMinistryLinkOrException(
      nextReplacedByMemberId,
      schedule.ministry.id,
      data.allowMinistryException,
      options.database
    );
  }
}
export const scheduleService = {
  async list(
    filters: ScheduleListQueryInput,
    authorization: ScheduleAuthorization
  ): Promise<ScheduleListResult> {
    const [result, ministries, members, events] = await Promise.all([
      scheduleRepository.list(filters, authorization.accessContext),
      scheduleRepository.listMinistries(authorization.accessContext),
      scheduleRepository.listMembers(),
      scheduleRepository.listEvents(authorization.accessContext)
    ]);

    return {
      schedules: result.schedules.map(serialize),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / filters.pageSize))
      },
      filters: {
        ministries,
        members: members.map((member) => ({ ...member, displayName: getMemberDisplayName(member) })),
        events: events.map((event) => ({
          ...event,
          startDate: event.startDate.toISOString()
        }))
      }
    };
  },

  async getById(id: string, authorization: ScheduleAuthorization) {
    const schedule = await scheduleRepository.findByIdWithinScope(
      id,
      authorization.accessContext
    );

    if (!schedule) {
      throw new AppError("Escala nao encontrada.", 404, "SCHEDULE_NOT_FOUND");
    }

    return serialize(schedule);
  },

  async create(data: ScheduleCreateInput, authorization: ScheduleAuthorization) {
    ensureAuthorizedMinistry(data.ministryId, authorization);
    await Promise.all([
      ensureActiveMinistry(data.ministryId),
      ensureCompatibleEvent(data.eventId, data.ministryId)
    ]);

    return serialize(await scheduleRepository.create(data, authorization.user.id));
  },

  async update(id: string, data: ScheduleUpdateInput, authorization: ScheduleAuthorization) {
    const current = await scheduleRepository.findByIdWithinScope(id, authorization.accessContext);

    if (!current) {
      throw new AppError("Escala nao encontrada.", 404, "SCHEDULE_NOT_FOUND");
    }

    ensureScheduleCanBeEdited(current, data);

    if (data.ministryId) {
      ensureAuthorizedMinistry(data.ministryId, authorization);
      await ensureActiveMinistry(data.ministryId);
    }

    if (data.eventId !== undefined || data.ministryId) {
      await ensureCompatibleEvent(
        data.eventId === undefined ? current.event?.id : data.eventId,
        data.ministryId ?? current.ministry.id
      );
    }

    if (data.date || data.startTime !== undefined || data.endTime !== undefined) {
      await ensureNoExistingMembersTimeConflict(current, data);
    }

    const notificationIds: string[] = [];
    const updated = await scheduleRepository.transaction(async (database) => {
      const transactionalCurrent = await scheduleRepository.lockByIdWithinScope(
        id,
        authorization.accessContext,
        database
      );
      if (!transactionalCurrent) return null;
      ensureScheduleCanBeEdited(transactionalCurrent, data);
      const changes = getRelevantScheduleChanges(transactionalCurrent, data);
      const hasNonNotifiableChange = hasNonNotifiableScheduleChange(
        transactionalCurrent,
        data
      );
      if (!changes.length && !hasNonNotifiableChange) return transactionalCurrent;
      const result = await scheduleRepository.updateWithinScope(
        id,
        data,
        authorization.user.id,
        authorization.accessContext,
        database
      );
      if (!result) return null;
      if (
        changes.length &&
        result.status === ScheduleStatus.PUBLISHED &&
        result.publishedAt !== null
      ) {
        const version = await scheduleRepository.incrementNotificationVersion(
          id,
          database
        );
        const versionedResult = {
          ...result,
          notificationVersion: version.notificationVersion
        };
        collectNotificationIds(notificationIds, await scheduleNotificationService.updated(
          versionedResult,
          changes,
          authorization.user.id,
          database
        ));
        collectNotificationIds(notificationIds, await scheduleNotificationService.rescheduleReminders(
          versionedResult,
          authorization.user.id,
          database
        ));
        return versionedResult;
      }
      return result;
    });

    if (!updated) {
      throw new AppError("Escala nao encontrada.", 404, "SCHEDULE_NOT_FOUND");
    }

    await notificationPublisher.deliverPush(notificationIds);
    return serialize(updated);
  },

  async remove(id: string, authorization: ScheduleAuthorization) {
    const notificationIds: string[] = [];
    const removed = await scheduleRepository.transaction(async (database) => {
      const current = await scheduleRepository.lockByIdWithinScope(
        id,
        authorization.accessContext,
        database
      );
      if (!current) return null;
      if (current.status === ScheduleStatus.COMPLETED) {
        throw new AppError("Escala concluida e somente para consulta.", 409, "SCHEDULE_COMPLETED");
      }
      const wasPublished = current.publishedAt !== null;
      const versioned = wasPublished
        ? await scheduleRepository.incrementNotificationVersion(id, database)
        : null;
      const notificationSchedule = versioned
        ? { ...current, notificationVersion: versioned.notificationVersion }
        : current;
      const result = await scheduleRepository.softDeleteWithinScope(
        id,
        authorization.user.id,
        authorization.accessContext,
        database
      );
      if (result && wasPublished) {
        collectNotificationIds(notificationIds, await scheduleNotificationService.cancelled(
          notificationSchedule,
          authorization.user.id,
          database
        ));
      }
      return result;
    });

    if (!removed) {
      throw new AppError("Escala nao encontrada.", 404, "SCHEDULE_NOT_FOUND");
    }

    await notificationPublisher.deliverPush(notificationIds);
    return removed;
  },

  async publish(id: string, authorization: ScheduleAuthorization) {
    const notificationIds: string[] = [];
    const schedule = await scheduleRepository.transaction(async (database) => {
      const current = await scheduleRepository.lockByIdWithinScope(
        id,
        authorization.accessContext,
        database
      );
      if (!current) return null;
      if (current.status === ScheduleStatus.PUBLISHED && current.publishedAt) return current;
      if (current.status !== ScheduleStatus.DRAFT) {
        throw new AppError(
          "Somente escalas em rascunho podem ser publicadas.",
          409,
          "SCHEDULE_NOT_DRAFT"
        );
      }
      const published = await scheduleRepository.transitionStatusWithinScope(
        id,
        [ScheduleStatus.DRAFT],
        ScheduleStatus.PUBLISHED,
        authorization.user.id,
        authorization.accessContext,
        database,
        { publishedAt: new Date(), incrementNotificationVersion: true }
      );
      if (!published) {
        const concurrent = await scheduleRepository.findByIdWithinScope(
          id,
          authorization.accessContext,
          database
        );
        if (concurrent?.status === ScheduleStatus.PUBLISHED && concurrent.publishedAt) {
          return concurrent;
        }
        return null;
      }
      collectNotificationIds(notificationIds, await scheduleNotificationService.publishInitial(
        published,
        authorization.user.id,
        database
      ));
      return published;
    });

    if (!schedule) {
      throw new AppError("Escala nao encontrada.", 404, "SCHEDULE_NOT_FOUND");
    }

    await notificationPublisher.deliverPush(notificationIds);
    return serialize(schedule);
  },

  async cancel(id: string, authorization: ScheduleAuthorization) {
    const notificationIds: string[] = [];
    const schedule = await scheduleRepository.transaction(async (database) => {
      const current = await scheduleRepository.lockByIdWithinScope(
        id,
        authorization.accessContext,
        database
      );
      if (!current) return null;
      if (current.status === ScheduleStatus.CANCELED) return current;
      const wasPublished = current.publishedAt !== null;
      const cancelled = await scheduleRepository.transitionStatusWithinScope(
        id,
        [ScheduleStatus.DRAFT, ScheduleStatus.PUBLISHED],
        ScheduleStatus.CANCELED,
        authorization.user.id,
        authorization.accessContext,
        database,
        { incrementNotificationVersion: wasPublished }
      );
      if (cancelled && wasPublished) {
        collectNotificationIds(notificationIds, await scheduleNotificationService.cancelled(
          cancelled,
          authorization.user.id,
          database
        ));
      }
      return cancelled;
    });

    if (!schedule) {
      throw new AppError("Escala nao encontrada.", 404, "SCHEDULE_NOT_FOUND");
    }

    await notificationPublisher.deliverPush(notificationIds);
    return serialize(schedule);
  },

  async complete(id: string, authorization: ScheduleAuthorization) {
    const schedule = await scheduleRepository.transaction(async (database) => {
      const current = await scheduleRepository.lockByIdWithinScope(
        id,
        authorization.accessContext,
        database
      );
      if (!current) return null;
      if (current.status === ScheduleStatus.COMPLETED) return current;
      if (current.status === ScheduleStatus.CANCELED) {
        throw new AppError("Escala cancelada nao pode ser concluida.", 409, "SCHEDULE_CANCELED");
      }
      const completed = await scheduleRepository.transitionStatusWithinScope(
        id,
        [ScheduleStatus.DRAFT, ScheduleStatus.PUBLISHED],
        ScheduleStatus.COMPLETED,
        authorization.user.id,
        authorization.accessContext,
        database
      );
      if (completed && current.publishedAt !== null) {
        await scheduleNotificationService.cancelPendingReminders(completed.id, database);
      }
      return completed;
    });

    if (!schedule) {
      throw new AppError("Escala nao encontrada.", 404, "SCHEDULE_NOT_FOUND");
    }

    return serialize(schedule);
  },

  async listMembers(id: string, authorization: ScheduleAuthorization) {
    return (await this.getById(id, authorization)).members;
  },

  async listAvailableMembers(
    id: string,
    allowMinistryException: boolean,
    authorization: ScheduleAuthorization
  ) {
    const schedule = await this.getById(id, authorization);
    const members = await scheduleRepository.listAvailableMembers(schedule.ministry.id, allowMinistryException);

    return { members: members.map((member) => ({ ...member, displayName: getMemberDisplayName(member) })) };
  },

  async addMember(
    scheduleId: string,
    data: ScheduleMemberCreateInput,
    authorization: ScheduleAuthorization
  ) {
    const notificationIds: string[] = [];
    const participant = await scheduleRepository.transaction(async (database) => {
      const transactionalSchedule = await scheduleRepository.lockByIdWithinScope(
        scheduleId,
        authorization.accessContext,
        database
      );
      if (!transactionalSchedule) {
        throw new AppError("Escala nao encontrada.", 404, "SCHEDULE_NOT_FOUND");
      }
      ensureScheduleCanReceiveMembers(transactionalSchedule);
      await ensureMemberRules(transactionalSchedule, data, { database });
      const created = await scheduleRepository.addMember(
        scheduleId,
        data,
        authorization.user.id,
        database
      );
      if (
        transactionalSchedule.status === ScheduleStatus.PUBLISHED &&
        transactionalSchedule.publishedAt
      ) {
        const version = await scheduleRepository.incrementNotificationVersion(
          scheduleId,
          database
        );
        collectNotificationIds(notificationIds, await scheduleNotificationService.participantAdded(
          { ...transactionalSchedule, notificationVersion: version.notificationVersion },
          created,
          authorization.user.id,
          database
        ));
      }
      return created;
    });
    await notificationPublisher.deliverPush(notificationIds);
    return serializeMember(participant);
  },

  async updateMember(
    scheduleId: string,
    memberScheduleId: string,
    data: ScheduleMemberUpdateInput,
    authorization: ScheduleAuthorization
  ) {
    const notificationIds: string[] = [];
    const updated = await scheduleRepository.transaction(async (database) => {
      const transactionalSchedule = await scheduleRepository.lockByIdWithinScope(
        scheduleId,
        authorization.accessContext,
        database
      );
      const transactionalCurrent = await scheduleRepository.findScheduleMemberById(
        memberScheduleId,
        scheduleId,
        database
      );
      if (!transactionalSchedule) {
        throw new AppError("Escala nao encontrada.", 404, "SCHEDULE_NOT_FOUND");
      }
      if (!transactionalCurrent) {
        throw new AppError("Membro da escala nao encontrado.", 404, "SCHEDULE_MEMBER_NOT_FOUND");
      }
      if (
        transactionalSchedule.status === ScheduleStatus.COMPLETED &&
        Object.keys(data).some((key) => key !== "observations")
      ) {
        throw new AppError(
          "Escala concluida permite alterar apenas observacoes.",
          409,
          "SCHEDULE_COMPLETED"
        );
      }
      await ensureMemberRules(transactionalSchedule, data, {
        currentId: memberScheduleId,
        currentMemberId: transactionalCurrent.member.id,
        currentStatus: transactionalCurrent.status,
        currentReplacedByMemberId:
          transactionalCurrent.replacedByMember?.id ?? null,
        database
      });
      const changed = hasRelevantMemberChange(transactionalCurrent, data);
      if (!changed) return transactionalCurrent;
      const result = await scheduleRepository.updateMember(
        memberScheduleId,
        data,
        authorization.user.id,
        database
      );
      if (
        transactionalSchedule.status === ScheduleStatus.PUBLISHED &&
        transactionalSchedule.publishedAt
      ) {
        const version = await scheduleRepository.incrementNotificationVersion(
          scheduleId,
          database
        );
        const versionedSchedule = {
          ...transactionalSchedule,
          notificationVersion: version.notificationVersion
        };
        const previousRecipients = activeScheduleRecipients([transactionalCurrent]);
        const nextRecipients = activeScheduleRecipients([result]);
        const previousUserId = previousRecipients[0]?.userId;
        const nextUserId = nextRecipients[0]?.userId;

        if (previousUserId !== nextUserId) {
          if (previousUserId) {
            collectNotificationIds(notificationIds, await scheduleNotificationService.participantRemoved(
              versionedSchedule,
              transactionalCurrent,
              authorization.user.id,
              database
            ));
          }
          if (nextUserId) {
            collectNotificationIds(notificationIds, await scheduleNotificationService.participantAdded(
              versionedSchedule,
              result,
              authorization.user.id,
              database
            ));
          }
        } else if (nextUserId) {
          const participantChanges: ScheduleRelevantChange[] = [];
          if (data.role !== undefined && data.role !== transactionalCurrent.role) {
            participantChanges.push("role");
          }
          if (data.status !== undefined && data.status !== transactionalCurrent.status) {
            participantChanges.push("status");
          }
          if (
            data.observations !== undefined &&
            data.observations !== (transactionalCurrent.observations ?? undefined)
          ) {
            participantChanges.push("observations");
          }
          collectNotificationIds(notificationIds, await scheduleNotificationService.updated(
            versionedSchedule,
            participantChanges,
            authorization.user.id,
            database,
            nextRecipients
          ));
          collectNotificationIds(notificationIds, await scheduleNotificationService.refreshParticipantReminder(
            versionedSchedule,
            result,
            authorization.user.id,
            database
          ));
        }
      }
      return result;
    });
    await notificationPublisher.deliverPush(notificationIds);
    return serializeMember(updated);
  },

  async removeMember(
    scheduleId: string,
    memberScheduleId: string,
    authorization: ScheduleAuthorization
  ) {
    const notificationIds: string[] = [];
    const removed = await scheduleRepository.transaction(async (database) => {
      const transactionalSchedule = await scheduleRepository.lockByIdWithinScope(
        scheduleId,
        authorization.accessContext,
        database
      );
      const transactionalCurrent = await scheduleRepository.findScheduleMemberById(
        memberScheduleId,
        scheduleId,
        database
      );
      if (!transactionalSchedule) {
        throw new AppError("Escala nao encontrada.", 404, "SCHEDULE_NOT_FOUND");
      }
      if (!transactionalCurrent) {
        throw new AppError("Membro da escala nao encontrado.", 404, "SCHEDULE_MEMBER_NOT_FOUND");
      }
      const shouldNotify =
        transactionalSchedule.status === ScheduleStatus.PUBLISHED &&
        transactionalSchedule.publishedAt !== null;
      const version = shouldNotify
        ? await scheduleRepository.incrementNotificationVersion(scheduleId, database)
        : null;
      const removed = await scheduleRepository.softDeleteMember(
        memberScheduleId,
        authorization.user.id,
        database
      );
      if (shouldNotify && version) {
        collectNotificationIds(notificationIds, await scheduleNotificationService.participantRemoved(
          { ...transactionalSchedule, notificationVersion: version.notificationVersion },
          transactionalCurrent,
          authorization.user.id,
          database
        ));
      }
      return removed;
    });
    await notificationPublisher.deliverPush(notificationIds);
    return removed;
  },

  async confirmMember(
    scheduleId: string,
    memberScheduleId: string,
    authorization: ScheduleAuthorization
  ) {
    return this.updateMember(
      scheduleId,
      memberScheduleId,
      { status: ScheduleMemberStatus.CONFIRMED, confirmedAt: new Date().toISOString() },
      authorization
    );
  }
};
