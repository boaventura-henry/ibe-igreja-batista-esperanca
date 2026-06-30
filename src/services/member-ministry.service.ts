import { MemberMinistryStatus, MemberStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { memberMinistryRepository, type MemberMinistryRecord } from "@/repositories";
import type { MemberMinistryListResult, MemberMinistrySummary } from "@/types";
import type {
  MemberMinistryCreateInput,
  MemberMinistryListQueryInput,
  MemberMinistryUpdateInput
} from "@/validators";

function serializeDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

function serialize(record: MemberMinistryRecord): MemberMinistrySummary {
  return {
    id: record.id,
    role: record.role,
    status: record.status,
    entryDate: record.entryDate.toISOString(),
    exitDate: serializeDate(record.exitDate),
    observations: record.observations,
    member: record.member,
    ministry: record.ministry,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function parseDate(value: string | null | undefined) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function formatDateForRule(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : undefined;
}

function ensureStatusRules(status: MemberMinistryStatus, entryDate: string, exitDate?: string | null) {
  if (status === MemberMinistryStatus.ACTIVE && exitDate) {
    throw new AppError("Vinculo ativo nao pode ter data de saida.", 400, "ACTIVE_LINK_WITH_EXIT_DATE");
  }

  if (status !== MemberMinistryStatus.ACTIVE && !exitDate) {
    throw new AppError("Informe a data de saida para encerrar a participacao.", 400, "EXIT_DATE_REQUIRED");
  }

  const entry = parseDate(entryDate);
  const exit = parseDate(exitDate);

  if (entry && exit && exit < entry) {
    throw new AppError("A data de saida nao pode ser anterior a data de entrada.", 400, "INVALID_EXIT_DATE");
  }
}

async function ensureMemberCanBeLinked(memberId: string) {
  const member = await memberMinistryRepository.findMemberById(memberId);

  if (!member) {
    throw new AppError("Membro nao encontrado.", 404, "MEMBER_NOT_FOUND");
  }

  if (member.status === MemberStatus.INACTIVE || member.status === MemberStatus.DECEASED) {
    throw new AppError(
      "Nao e permitido vincular membro inativo ou falecido a ministerios.",
      409,
      "MEMBER_CANNOT_BE_LINKED"
    );
  }
}

async function ensureMinistryCanBeLinked(ministryId: string) {
  const ministry = await memberMinistryRepository.findMinistryById(ministryId);

  if (!ministry) {
    throw new AppError("Ministerio nao encontrado.", 404, "MINISTRY_NOT_FOUND");
  }

  if (!ministry.isActive) {
    throw new AppError("Nao e permitido vincular membro a ministerio inativo.", 409, "MINISTRY_INACTIVE");
  }
}

async function ensureNoDuplicatedActiveLink(memberId: string, ministryId: string, currentId?: string) {
  const existing = await memberMinistryRepository.findActiveLink(memberId, ministryId, currentId);

  if (existing) {
    throw new AppError(
      "Este membro ja possui um vinculo ativo com este ministerio.",
      409,
      "ACTIVE_MEMBER_MINISTRY_EXISTS"
    );
  }
}

export const memberMinistryService = {
  async list(filters: MemberMinistryListQueryInput): Promise<MemberMinistryListResult> {
    const [result, members, ministries] = await Promise.all([
      memberMinistryRepository.list(filters),
      memberMinistryRepository.listMembers(),
      memberMinistryRepository.listMinistries()
    ]);

    return {
      memberMinistries: result.memberMinistries.map(serialize),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / filters.pageSize))
      },
      filters: {
        members,
        ministries
      }
    };
  },

  async getById(id: string) {
    const link = await memberMinistryRepository.findById(id);

    if (!link) {
      throw new AppError("Vinculo nao encontrado.", 404, "MEMBER_MINISTRY_NOT_FOUND");
    }

    return serialize(link);
  },

  async create(data: MemberMinistryCreateInput, userId: string) {
    ensureStatusRules(data.status, data.entryDate, data.exitDate);
    await ensureMemberCanBeLinked(data.memberId);
    await ensureMinistryCanBeLinked(data.ministryId);

    if (data.status === MemberMinistryStatus.ACTIVE) {
      await ensureNoDuplicatedActiveLink(data.memberId, data.ministryId);
    }

    return serialize(await memberMinistryRepository.create(data, userId));
  },

  async update(id: string, data: MemberMinistryUpdateInput, userId: string) {
    const current = await memberMinistryRepository.findById(id);

    if (!current) {
      throw new AppError("Vinculo nao encontrado.", 404, "MEMBER_MINISTRY_NOT_FOUND");
    }

    const nextMemberId = data.memberId ?? current.member.id;
    const nextMinistryId = data.ministryId ?? current.ministry.id;
    const nextStatus = data.status ?? current.status;
    const nextEntryDate = data.entryDate ?? current.entryDate.toISOString().slice(0, 10);
    const nextExitDate =
      data.exitDate === undefined ? formatDateForRule(current.exitDate) : data.exitDate;

    ensureStatusRules(nextStatus, nextEntryDate, nextExitDate);
    await ensureMemberCanBeLinked(nextMemberId);
    await ensureMinistryCanBeLinked(nextMinistryId);

    if (nextStatus === MemberMinistryStatus.ACTIVE) {
      await ensureNoDuplicatedActiveLink(nextMemberId, nextMinistryId, id);
    }

    return serialize(await memberMinistryRepository.update(id, data, userId));
  },

  async remove(id: string, userId: string) {
    await this.getById(id);

    return memberMinistryRepository.softDelete(id, userId);
  }
};
