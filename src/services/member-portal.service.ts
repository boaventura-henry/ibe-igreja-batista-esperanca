import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";
import {
  memberPortalRepository,
  type MemberPortalMinistryRecord,
  type MemberPortalProfileRecord,
  type MemberPortalScheduleRecord
} from "@/repositories";
import type {
  MemberPortalDashboard,
  MemberPortalMinistry,
  MemberPortalProfile,
  MemberPortalSchedulePreview
} from "@/types";
import type { MemberPortalUpdateProfileInput } from "@/validators";
import { getMemberDisplayName } from "@/utils";

type PortalSessionUser = {
  id: string;
  memberId?: string | null;
};

function serializeDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

function serializeProfile(member: MemberPortalProfileRecord): MemberPortalProfile {
  return {
    ...member,
    displayName: getMemberDisplayName(member),
    birthDate: serializeDate(member.birthDate)
  };
}

function serializeMinistry(link: MemberPortalMinistryRecord): MemberPortalMinistry {
  return {
    id: link.id,
    role: link.role,
    status: link.status,
    entryDate: link.entryDate.toISOString(),
    exitDate: serializeDate(link.exitDate),
    ministry: {
      id: link.ministry.id,
      name: link.ministry.name,
      description: link.ministry.description,
      color: link.ministry.color,
      leader: link.ministry.leaderMember
    }
  };
}

function serializeSchedule(link: MemberPortalScheduleRecord): MemberPortalSchedulePreview {
  return {
    id: link.id,
    title: link.schedule.title,
    date: link.schedule.date.toISOString(),
    startTime: link.schedule.startTime,
    endTime: link.schedule.endTime,
    location: link.schedule.location,
    role: link.role,
    status: link.status,
    ministry: link.schedule.ministry
  };
}

function getMemberId(user: PortalSessionUser) {
  if (!user.memberId) {
    throw new AppError("Seu usuario ainda nao esta vinculado a um cadastro de membro.", 403, "USER_WITHOUT_MEMBER");
  }

  return user.memberId;
}

function isUniqueConstraint(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export const memberPortalService = {
  async getDashboard(user: PortalSessionUser): Promise<MemberPortalDashboard> {
    if (!user.memberId) {
      return {
        member: null,
        nextSchedules: [],
        ministries: []
      };
    }

    const [member, nextSchedules, ministries] = await Promise.all([
      memberPortalRepository.findProfile(user.memberId),
      memberPortalRepository.listNextSchedules(user.memberId),
      memberPortalRepository.listMinistries(user.memberId)
    ]);

    if (!member) {
      return {
        member: null,
        nextSchedules: [],
        ministries: []
      };
    }

    return {
      member: serializeProfile(member),
      nextSchedules: nextSchedules.map(serializeSchedule),
      ministries: ministries.map(serializeMinistry)
    };
  },

  async getProfile(user: PortalSessionUser) {
    const memberId = getMemberId(user);
    const member = await memberPortalRepository.findProfile(memberId);

    if (!member) {
      throw new AppError("Cadastro de membro nao encontrado.", 404, "MEMBER_NOT_FOUND");
    }

    return serializeProfile(member);
  },

  async updateProfile(user: PortalSessionUser, data: MemberPortalUpdateProfileInput) {
    const memberId = getMemberId(user);

    if (data.email) {
      const existing = await memberPortalRepository.findMemberByEmail(data.email);

      if (existing && existing.id !== memberId) {
        throw new AppError("Ja existe um membro cadastrado com este e-mail.", 409, "EMAIL_ALREADY_EXISTS");
      }
    }

    try {
      return serializeProfile(await memberPortalRepository.updateProfile(memberId, data, user.id));
    } catch (error) {
      if (isUniqueConstraint(error)) {
        throw new AppError("Ja existe um membro cadastrado com este e-mail.", 409, "EMAIL_ALREADY_EXISTS");
      }

      throw error;
    }
  },

  async listMinistries(user: PortalSessionUser) {
    const memberId = getMemberId(user);

    return (await memberPortalRepository.listMinistries(memberId)).map(serializeMinistry);
  }
};
