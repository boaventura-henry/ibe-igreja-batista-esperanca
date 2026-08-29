import { ScheduleInstrumentSource, ScheduleMemberRole, ScheduleMemberStatus, ScheduleStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { compareScheduleMembersByRolePriority, getScheduleMemberRoles, hasInstrumentRole } from "@/lib/schedule-member-role";
import { myScheduleRepository, scheduleInstrumentAssignmentRepository, scheduleRepository, type MyScheduleRecord } from "@/repositories";
import type { MyScheduleListResult, MyScheduleSummary } from "@/types";
import type { MyScheduleDeclineInput, MyScheduleInstrumentChangeInput, MyScheduleListQueryInput } from "@/validators";
import { getMemberDisplayName } from "@/utils";
import { setActiveAssignmentInTransaction } from "@/services/schedule-instrument-assignment.service";

type MyScheduleSessionUser = {
  id: string;
  memberId?: string | null;
};

function serializeDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

function serialize(record: MyScheduleRecord): MyScheduleSummary {
  const participants = [...record.schedule.members].sort(compareScheduleMembersByRolePriority).map((participant) => ({
    ...participant,
    roles: getScheduleMemberRoles(participant),
    instrumentAssignment: participant.instrumentAssignments[0] ?? null,
    member: { ...participant.member, displayName: getMemberDisplayName(participant.member) },
    replacedByMember: participant.replacedByMember ? { ...participant.replacedByMember, displayName: getMemberDisplayName(participant.replacedByMember) } : null
  }));
  return {
    id: record.id,
    scheduleId: record.schedule.id,
    title: record.schedule.title,
    description: record.schedule.description,
    ministry: {
      id: record.schedule.ministry.id,
      name: record.schedule.ministry.name,
      color: record.schedule.ministry.color,
      leader: record.schedule.ministry.leaderMember
    },
    date: record.schedule.date.toISOString(),
    startTime: record.schedule.startTime,
    endTime: record.schedule.endTime,
    roles: getScheduleMemberRoles(record),
    instrumentAssignment: record.instrumentAssignments[0] ?? null,
    status: record.status,
    scheduleStatus: record.schedule.status,
    location: record.schedule.location,
    observations: record.schedule.observations,
    participantObservations: record.observations,
    confirmedAt: serializeDate(record.confirmedAt),
    declinedAt: serializeDate(record.declinedAt),
    declineReason: record.declineReason,
    replacedByMember: record.replacedByMember ? { ...record.replacedByMember, displayName: getMemberDisplayName(record.replacedByMember) } : null,
    participants,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function getSessionMemberId(user: MyScheduleSessionUser) {
  if (!user.memberId) {
    throw new AppError("Seu usuario nao esta vinculado a um membro.", 403, "USER_WITHOUT_MEMBER");
  }

  return user.memberId;
}

function ensureCanSelfRespond(scheduleMember: MyScheduleSummary, action: "confirm" | "decline") {
  if (scheduleMember.scheduleStatus === ScheduleStatus.CANCELED) {
    throw new AppError("Nao e possivel responder uma escala cancelada.", 409, "SCHEDULE_CANCELED");
  }

  if (scheduleMember.scheduleStatus === ScheduleStatus.COMPLETED) {
    throw new AppError("Nao e possivel responder uma escala concluida.", 409, "SCHEDULE_COMPLETED");
  }

  if (scheduleMember.status === ScheduleMemberStatus.REPLACED) {
    throw new AppError("Uma escala substituida nao pode ser respondida pelo membro original.", 409, "SCHEDULE_REPLACED");
  }

  if (scheduleMember.status !== ScheduleMemberStatus.PENDING) {
    throw new AppError(
      action === "confirm" ? "Esta escala nao esta pendente de confirmacao." : "Esta escala nao esta pendente de recusa.",
      409,
      "SCHEDULE_RESPONSE_NOT_PENDING"
    );
  }
}

function ensureCanChangeInstrument(participant: {
  roles: Array<{ role: ScheduleMemberRole }>;
  status: ScheduleMemberStatus;
  schedule: { status: ScheduleStatus };
}) {
  if (!hasInstrumentRole(participant)) {
    throw new AppError("Esta participacao nao utiliza instrumento.", 409, "SCHEDULE_INSTRUMENT_ROLE_REQUIRED");
  }
  if (participant.schedule.status !== ScheduleStatus.PUBLISHED) {
    throw new AppError("Esta escala nao permite alterar instrumento.", 409, "SCHEDULE_INSTRUMENT_CLOSED");
  }
  if (
    participant.status === ScheduleMemberStatus.REPLACED ||
    participant.status === ScheduleMemberStatus.DECLINED ||
    participant.status === ScheduleMemberStatus.ABSENT
  ) {
    throw new AppError("Esta participacao nao permite alterar instrumento.", 409, "SCHEDULE_INSTRUMENT_MEMBER_INACTIVE");
  }
}

export const myScheduleService = {
  async list(
    user: MyScheduleSessionUser,
    filters: MyScheduleListQueryInput = { includeCompleted: false }
  ): Promise<MyScheduleListResult> {
    const memberId = getSessionMemberId(user);
    const schedules = await myScheduleRepository.listByMemberId(memberId, filters);

    return { schedules: schedules.map(serialize) };
  },

  async getById(scheduleMemberId: string, user: MyScheduleSessionUser) {
    const memberId = getSessionMemberId(user);
    const scheduleMember = await myScheduleRepository.findByIdForMember(scheduleMemberId, memberId);

    if (!scheduleMember) {
      throw new AppError("Escala nao encontrada para este membro.", 404, "MY_SCHEDULE_NOT_FOUND");
    }

    return serialize(scheduleMember);
  },

  async getRepertoire(scheduleMemberId: string, user: MyScheduleSessionUser) {
    const memberId = getSessionMemberId(user);
    const record = await myScheduleRepository.findRepertoireForMember(scheduleMemberId, memberId);
    if (!record) throw new AppError("Escala nao encontrada para este membro.", 404, "MY_SCHEDULE_NOT_FOUND");
    return { songs: record.schedule.songs.map((song) => ({ ...song, leadMember: song.leadMember ? { ...song.leadMember, displayName: getMemberDisplayName(song.leadMember) } : null })) };
  },

  async getInstrumentChange(scheduleMemberId: string, user: MyScheduleSessionUser) {
    const memberId = getSessionMemberId(user);
    const participant = await myScheduleRepository.findInstrumentChangeForMember(scheduleMemberId, memberId);
    if (!participant) throw new AppError("Escala nao encontrada para este membro.", 404, "MY_SCHEDULE_NOT_FOUND");
    ensureCanChangeInstrument(participant);
    const current = participant.instrumentAssignments[0] ?? null;
    if (!current) {
      throw new AppError("Seu instrumento ainda nao foi definido nesta escala. Solicite ao responsavel pela escala que configure sua funcao/instrumento.", 409, "SCHEDULE_INSTRUMENT_NOT_DEFINED");
    }
    return {
      category: current.instrumentCategory,
      current,
      instruments: await scheduleInstrumentAssignmentRepository.listEligible(current.instrumentCategory.id)
    };
  },

  async changeInstrument(scheduleMemberId: string, input: MyScheduleInstrumentChangeInput, user: MyScheduleSessionUser) {
    const memberId = getSessionMemberId(user);
    const target = await myScheduleRepository.findInstrumentChangeScheduleForMember(
      scheduleMemberId,
      memberId
    );
    if (!target) throw new AppError("Escala nao encontrada para este membro.", 404, "MY_SCHEDULE_NOT_FOUND");

    return scheduleRepository.transaction(async (database) => {
      const scheduleLocked = await scheduleRepository.lockById(target.scheduleId, database);
      if (!scheduleLocked) throw new AppError("Escala nao encontrada para este membro.", 404, "MY_SCHEDULE_NOT_FOUND");

      const participant = await myScheduleRepository.lockInstrumentChangeForMember(scheduleMemberId, memberId, database);
      if (!participant) throw new AppError("Escala nao encontrada para este membro.", 404, "MY_SCHEDULE_NOT_FOUND");
      ensureCanChangeInstrument(participant);

      const current = participant.instrumentAssignments[0] ?? null;
      if (!current) {
        throw new AppError("Seu instrumento ainda nao foi definido nesta escala. Solicite ao responsavel pela escala que configure sua funcao/instrumento.", 409, "SCHEDULE_INSTRUMENT_NOT_DEFINED");
      }
      if (input.currentAssignmentId !== current.id) {
        throw new AppError("O instrumento foi alterado enquanto este formulario estava aberto. Atualize a pagina e tente novamente.", 409, "SCHEDULE_INSTRUMENT_STALE");
      }

      const same = current.source === input.source && (current.instrument?.id ?? null) === (input.instrumentId ?? null);
      if (same) return current;
      if (!input.changeReason?.trim()) throw new AppError("Informe o motivo da alteracao.", 400, "SCHEDULE_INSTRUMENT_REASON_REQUIRED");

      const assignment = input.source === ScheduleInstrumentSource.REGISTERED
        ? { instrumentCategoryId: current.instrumentCategory.id, source: ScheduleInstrumentSource.REGISTERED, instrumentId: input.instrumentId, changeReason: input.changeReason ?? null }
        : { instrumentCategoryId: current.instrumentCategory.id, source: ScheduleInstrumentSource.OWN, instrumentId: null, changeReason: input.changeReason ?? null };

      return setActiveAssignmentInTransaction(participant.id, participant, assignment, user.id, database);
    }, { maxWait: 5_000, timeout: 15_000 });
  },

  async confirm(scheduleMemberId: string, user: MyScheduleSessionUser) {
    const current = await this.getById(scheduleMemberId, user);
    ensureCanSelfRespond(current, "confirm");

    return serialize(await myScheduleRepository.confirm(scheduleMemberId, user.id));
  },

  async decline(scheduleMemberId: string, data: MyScheduleDeclineInput, user: MyScheduleSessionUser) {
    const current = await this.getById(scheduleMemberId, user);
    ensureCanSelfRespond(current, "decline");

    return serialize(await myScheduleRepository.decline(scheduleMemberId, user.id, data.declineReason ?? null));
  }
};
