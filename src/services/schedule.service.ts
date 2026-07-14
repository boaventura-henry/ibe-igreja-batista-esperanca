import { MemberStatus, ScheduleMemberStatus, ScheduleStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { scheduleRepository, type ScheduleMemberRecord, type ScheduleRecord } from "@/repositories";
import type { ScheduleListResult, ScheduleMemberSummary, ScheduleSummary } from "@/types";
import type {
  ScheduleCreateInput,
  ScheduleListQueryInput,
  ScheduleMemberCreateInput,
  ScheduleMemberUpdateInput,
  ScheduleUpdateInput
} from "@/validators";

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
    member: member.member,
    replacedByMember: member.replacedByMember,
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
  async list(filters: ScheduleListQueryInput): Promise<ScheduleListResult> {
    const [result, ministries, members] = await Promise.all([
      scheduleRepository.list(filters),
      scheduleRepository.listMinistries(),
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
      filters: { ministries, members }
    };
  },

  async getById(id: string) {
    const schedule = await scheduleRepository.findById(id);

    if (!schedule) {
      throw new AppError("Escala nao encontrada.", 404, "SCHEDULE_NOT_FOUND");
    }

    return serialize(schedule);
  },

  async create(data: ScheduleCreateInput, userId: string) {
    await ensureActiveMinistry(data.ministryId);

    return serialize(await scheduleRepository.create(data, userId));
  },

  async update(id: string, data: ScheduleUpdateInput, userId: string) {
    const current = await scheduleRepository.findById(id);

    if (!current) {
      throw new AppError("Escala nao encontrada.", 404, "SCHEDULE_NOT_FOUND");
    }

    ensureScheduleCanBeEdited(current, data);

    if (data.ministryId) {
      await ensureActiveMinistry(data.ministryId);
    }

    if (data.date || data.startTime !== undefined || data.endTime !== undefined || data.status) {
      await ensureNoExistingMembersTimeConflict(current, data);
    }

    return serialize(await scheduleRepository.update(id, data, userId));
  },

  async remove(id: string, userId: string) {
    await this.getById(id);

    return scheduleRepository.softDelete(id, userId);
  },

  async publish(id: string, userId: string) {
    await this.getById(id);

    return serialize(await scheduleRepository.updateStatus(id, ScheduleStatus.PUBLISHED, userId));
  },

  async cancel(id: string, userId: string) {
    await this.getById(id);

    return serialize(await scheduleRepository.updateStatus(id, ScheduleStatus.CANCELED, userId));
  },

  async complete(id: string, userId: string) {
    await this.getById(id);

    return serialize(await scheduleRepository.updateStatus(id, ScheduleStatus.COMPLETED, userId));
  },

  async listMembers(id: string) {
    return (await this.getById(id)).members;
  },

  async listAvailableMembers(id: string, allowMinistryException: boolean) {
    const schedule = await this.getById(id);
    const members = await scheduleRepository.listAvailableMembers(schedule.ministry.id, allowMinistryException);

    return { members };
  },

  async addMember(scheduleId: string, data: ScheduleMemberCreateInput, userId: string) {
    const schedule = await this.getById(scheduleId);
    ensureScheduleCanReceiveMembers(schedule);
    await ensureMemberRules(schedule, data);

    return serializeMember(await scheduleRepository.addMember(scheduleId, data, userId));
  },

  async updateMember(scheduleId: string, memberScheduleId: string, data: ScheduleMemberUpdateInput, userId: string) {
    const schedule = await this.getById(scheduleId);
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

    return serializeMember(await scheduleRepository.updateMember(memberScheduleId, data, userId));
  },

  async removeMember(scheduleId: string, memberScheduleId: string, userId: string) {
    await this.getById(scheduleId);
    const current = await scheduleRepository.findScheduleMemberById(memberScheduleId, scheduleId);

    if (!current) {
      throw new AppError("Membro da escala nao encontrado.", 404, "SCHEDULE_MEMBER_NOT_FOUND");
    }

    return scheduleRepository.softDeleteMember(memberScheduleId, userId);
  },

  async confirmMember(scheduleId: string, memberScheduleId: string, userId: string) {
    return this.updateMember(
      scheduleId,
      memberScheduleId,
      { status: ScheduleMemberStatus.CONFIRMED, confirmedAt: new Date().toISOString() },
      userId
    );
  }
};
