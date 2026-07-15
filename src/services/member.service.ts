import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { memberRepository, type MemberDetail, type MemberListItem } from "@/repositories";
import type { MemberListResult, MemberSummary } from "@/types";
import type { MemberCreateInput, MemberListQueryInput, MemberUpdateInput } from "@/validators";
import { getMemberDisplayName } from "@/utils";

function serializeDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

function serializeListItem(member: MemberListItem): MemberSummary {
  return {
    ...member,
    displayName: getMemberDisplayName(member),
    ministries: member.memberMinistries.map((link) => link.ministry),
    updatedAt: member.updatedAt.toISOString()
  };
}

function serializeDetail(member: MemberDetail) {
  return {
    ...member,
    displayName: getMemberDisplayName(member),
    birthDate: serializeDate(member.birthDate),
    baptismDate: serializeDate(member.baptismDate),
    joinedAt: serializeDate(member.joinedAt),
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt.toISOString(),
    ministries: member.memberMinistries.map((link) => ({
      id: link.ministry.id,
      name: link.ministry.name,
      description: link.ministry.description,
      role: link.role,
      status: link.status,
      entryDate: serializeDate(link.entryDate),
      exitDate: serializeDate(link.exitDate),
      observations: link.observations
    })),
    schedules: member.scheduleMembers.map((link) => ({
      id: link.id,
      role: link.role,
      status: link.status,
      confirmedAt: serializeDate(link.confirmedAt),
      declinedAt: serializeDate(link.declinedAt),
      declineReason: link.declineReason,
      schedule: {
        ...link.schedule,
        date: link.schedule.date.toISOString()
      }
    })),
    user: member.user
      ? {
          ...member.user,
          lockedUntil: serializeDate(member.user.lockedUntil)
        }
      : null,
    donations: member.donations.map((donation) => ({
      ...donation,
      amount: donation.amount.toString(),
      donatedAt: donation.donatedAt.toISOString()
    }))
  };
}

function isUniqueConstraint(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function ensureUniqueFields(data: MemberCreateInput | MemberUpdateInput, currentMemberId?: string) {
  if (data.cpf) {
    const existingCpf = await memberRepository.findByCpf(data.cpf);

    if (existingCpf && existingCpf.id !== currentMemberId) {
      throw new AppError("Ja existe um membro cadastrado com este CPF.", 409, "CPF_ALREADY_EXISTS");
    }
  }

  if (data.email) {
    const existingEmail = await memberRepository.findByEmail(data.email);

    if (existingEmail && existingEmail.id !== currentMemberId) {
      throw new AppError("Ja existe um membro cadastrado com este e-mail.", 409, "EMAIL_ALREADY_EXISTS");
    }
  }
}

export const memberService = {
  async list(filters: MemberListQueryInput): Promise<MemberListResult> {
    const [result, ministries] = await Promise.all([
      memberRepository.list(filters),
      memberRepository.listMinistries()
    ]);

    return {
      members: result.members.map(serializeListItem),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / filters.pageSize))
      },
      filters: {
        ministries
      }
    };
  },

  async getById(id: string) {
    const member = await memberRepository.findById(id);

    if (!member) {
      throw new AppError("Membro nao encontrado.", 404, "MEMBER_NOT_FOUND");
    }

    return serializeDetail(member);
  },

  async create(data: MemberCreateInput, userId: string) {
    await ensureUniqueFields(data);

    try {
      const member = await memberRepository.create(data, userId);

      return serializeDetail(member);
    } catch (error) {
      if (isUniqueConstraint(error)) {
        throw new AppError("CPF ou e-mail ja cadastrado.", 409, "MEMBER_ALREADY_EXISTS");
      }

      throw error;
    }
  },

  async update(id: string, data: MemberUpdateInput, userId: string) {
    await this.getById(id);
    await ensureUniqueFields(data, id);

    try {
      const member = await memberRepository.update(id, data, userId);

      return serializeDetail(member);
    } catch (error) {
      if (isUniqueConstraint(error)) {
        throw new AppError("CPF ou e-mail ja cadastrado.", 409, "MEMBER_ALREADY_EXISTS");
      }

      throw error;
    }
  },

  async remove(id: string, userId: string) {
    await this.getById(id);

    return memberRepository.softDelete(id, userId);
  },

  listMinistries() {
    return memberRepository.listMinistries();
  }
};
