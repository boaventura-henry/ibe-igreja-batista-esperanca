import { MemberStatus, ScheduleMemberStatus, ScheduleScope, ScheduleStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";
import type { ScheduleAuthorization } from "@/lib/schedule-authorization";
import { scheduleRepository, type ScheduleMemberRecord, type ScheduleRecord } from "@/repositories";
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

function serializeDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

function serializeMember(member: ScheduleMemberRecord): ScheduleMemberSummary {
  return {
    id: member.id,
    role: member.role,
    status: member.status,
    confirmedAt: serializeDate(member.confirmedAt),
    declinedAt: serializeDate(member.declinedAt),
    declineReason: member.declineReason,
    observations: member.observations,
    member: { ...member.member, displayName: getMemberDisplayName(member.member) },
    replacedByMember: member.replacedByMember ? { ...member.replacedByMember, displayName: getMemberDisplayName(member.replacedByMember) } : null,
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
    observations: schedule.observations,
    ministry: schedule.ministry,
    members: schedule.members.map(serializeMember),
    createdAt: schedule.createdAt.toISOString(),
    updatedAt: schedule.updatedAt.toISOString()
  };
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

async function ensureActiveMember(memberId: string) {
  const member = await scheduleRepository.findMemberById(memberId);

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
    status: data?.status ?? schedule.status,
    ministry: schedule.ministry
  };
}

async function ensureNoTimeConflict(memberId: string, schedule: ScheduleWindow, currentScheduleMemberId?: string) {
  if (schedule.status === ScheduleStatus.CANCELED) {
    return;
  }

  const conflict = await scheduleRepository.findScheduleMemberTimeConflict(
    memberId,
    schedule,
    currentScheduleMemberId
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
  allowMinistryException: boolean | undefined
) {
  const ministryLink = await scheduleRepository.findActiveMemberMinistry(memberId, ministryId);

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
    await ensureActiveMember(nextMemberId);

    const duplicated = await scheduleRepository.findActiveScheduleMember(schedule.id, nextMemberId, options.currentId);

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
    }, options.currentId);

    await ensureMemberHasMinistryLinkOrException(nextMemberId, schedule.ministry.id, data.allowMinistryException);
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
    await ensureActiveMember(nextReplacedByMemberId);
    await ensureNoTimeConflict(nextReplacedByMemberId, {
      id: schedule.id,
      date: new Date(schedule.date),
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      status: schedule.status,
      ministry: schedule.ministry
    });
    await ensureMemberHasMinistryLinkOrException(nextReplacedByMemberId, schedule.ministry.id, data.allowMinistryException);
  }
}
export const scheduleService = {
  async list(
    filters: ScheduleListQueryInput,
    authorization: ScheduleAuthorization
  ): Promise<ScheduleListResult> {
    const [result, ministries, members] = await Promise.all([
      scheduleRepository.list(filters, authorization.accessContext),
      scheduleRepository.listMinistries(authorization.accessContext),
      scheduleRepository.listMembers()
    ]);

    return {
      schedules: result.schedules.map(serialize),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / filters.pageSize))
      },
      filters: { ministries, members: members.map((member) => ({ ...member, displayName: getMemberDisplayName(member) })) }
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
    await ensureActiveMinistry(data.ministryId);

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

    if (data.date || data.startTime !== undefined || data.endTime !== undefined || data.status) {
      await ensureNoExistingMembersTimeConflict(current, data);
    }

    const updated = await scheduleRepository.updateWithinScope(
      id,
      data,
      authorization.user.id,
      authorization.accessContext
    );

    if (!updated) {
      throw new AppError("Escala nao encontrada.", 404, "SCHEDULE_NOT_FOUND");
    }

    return serialize(updated);
  },

  async remove(id: string, authorization: ScheduleAuthorization) {
    await this.getById(id, authorization);

    const removed = await scheduleRepository.softDeleteWithinScope(
      id,
      authorization.user.id,
      authorization.accessContext
    );

    if (!removed) {
      throw new AppError("Escala nao encontrada.", 404, "SCHEDULE_NOT_FOUND");
    }

    return removed;
  },

  async publish(id: string, authorization: ScheduleAuthorization) {
    await this.getById(id, authorization);
    const schedule = await scheduleRepository.updateWithinScope(
      id,
      { status: ScheduleStatus.PUBLISHED },
      authorization.user.id,
      authorization.accessContext
    );

    if (!schedule) {
      throw new AppError("Escala nao encontrada.", 404, "SCHEDULE_NOT_FOUND");
    }

    return serialize(schedule);
  },

  async cancel(id: string, authorization: ScheduleAuthorization) {
    await this.getById(id, authorization);
    const schedule = await scheduleRepository.updateWithinScope(
      id,
      { status: ScheduleStatus.CANCELED },
      authorization.user.id,
      authorization.accessContext
    );

    if (!schedule) {
      throw new AppError("Escala nao encontrada.", 404, "SCHEDULE_NOT_FOUND");
    }

    return serialize(schedule);
  },

  async complete(id: string, authorization: ScheduleAuthorization) {
    await this.getById(id, authorization);
    const schedule = await scheduleRepository.updateWithinScope(
      id,
      { status: ScheduleStatus.COMPLETED },
      authorization.user.id,
      authorization.accessContext
    );

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
    const schedule = await this.getById(scheduleId, authorization);
    ensureScheduleCanReceiveMembers(schedule);
    await ensureMemberRules(schedule, data);

    return serializeMember(
      await scheduleRepository.addMember(scheduleId, data, authorization.user.id)
    );
  },

  async updateMember(
    scheduleId: string,
    memberScheduleId: string,
    data: ScheduleMemberUpdateInput,
    authorization: ScheduleAuthorization
  ) {
    const schedule = await this.getById(scheduleId, authorization);
    const current = await scheduleRepository.findScheduleMemberById(memberScheduleId, scheduleId);

    if (!current) {
      throw new AppError("Membro da escala nao encontrado.", 404, "SCHEDULE_MEMBER_NOT_FOUND");
    }

    if (schedule.status === ScheduleStatus.COMPLETED && Object.keys(data).some((key) => key !== "observations")) {
      throw new AppError("Escala concluida permite alterar apenas observacoes.", 409, "SCHEDULE_COMPLETED");
    }

    await ensureMemberRules(schedule, data, {
      currentId: memberScheduleId,
      currentMemberId: current.member.id,
      currentStatus: current.status,
      currentReplacedByMemberId: current.replacedByMember?.id ?? null
    });

    return serializeMember(
      await scheduleRepository.updateMember(memberScheduleId, data, authorization.user.id)
    );
  },

  async removeMember(
    scheduleId: string,
    memberScheduleId: string,
    authorization: ScheduleAuthorization
  ) {
    await this.getById(scheduleId, authorization);
    const current = await scheduleRepository.findScheduleMemberById(memberScheduleId, scheduleId);

    if (!current) {
      throw new AppError("Membro da escala nao encontrado.", 404, "SCHEDULE_MEMBER_NOT_FOUND");
    }

    return scheduleRepository.softDeleteMember(memberScheduleId, authorization.user.id);
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
