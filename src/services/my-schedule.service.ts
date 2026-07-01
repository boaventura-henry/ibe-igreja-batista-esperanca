import { ScheduleMemberStatus, ScheduleStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { myScheduleRepository, type MyScheduleRecord } from "@/repositories";
import type { MyScheduleListResult, MyScheduleSummary } from "@/types";
import type { MyScheduleDeclineInput } from "@/validators";

type MyScheduleSessionUser = {
  id: string;
  memberId?: string | null;
};

function serializeDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

function serialize(record: MyScheduleRecord): MyScheduleSummary {
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
    role: record.role,
    status: record.status,
    scheduleStatus: record.schedule.status,
    location: record.schedule.location,
    observations: record.schedule.observations,
    participantObservations: record.observations,
    confirmedAt: serializeDate(record.confirmedAt),
    declinedAt: serializeDate(record.declinedAt),
    declineReason: record.declineReason,
    replacedByMember: record.replacedByMember,
    participants: record.schedule.members,
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

export const myScheduleService = {
  async list(user: MyScheduleSessionUser): Promise<MyScheduleListResult> {
    const memberId = getSessionMemberId(user);
    const schedules = await myScheduleRepository.listByMemberId(memberId);

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
