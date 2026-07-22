import { UserRole } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { accessRequestRepository, type SafeAccessRequest } from "@/repositories";
import type {
  AccessRequestDetailResult,
  AccessRequestListResult,
  AccessRequestMemberMatch,
  AccessRequestSummary
} from "@/types";
import { buildFallbackEmail, getMemberDisplayName, hashPassword, normalizeNameForMatch } from "@/utils";
import type {
  AccessRequestApproveInput,
  AccessRequestCreateInput,
  AccessRequestListQueryInput,
  AccessRequestRejectInput
} from "@/validators";

function serializeDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
  );
}

function serializeMember(
  member: SafeAccessRequest["possibleMember"] | SafeAccessRequest["approvedMember"]
) {
  if (!member) {
    return null;
  }

  return {
    id: member.id,
    name: member.name,
    nickname: member.nickname,
    displayName: getMemberDisplayName(member),
    email: member.email,
    cpf: member.cpf,
    rg: member.rg,
    phone: member.phone,
    mobilePhone: member.mobilePhone,
    whatsapp: member.whatsapp,
    birthDate: serializeDate(member.birthDate),
    status: member.status
  };
}

function serializeRequest(request: SafeAccessRequest): AccessRequestSummary {
  return {
    id: request.id,
    name: request.name,
    username: request.username,
    email: request.email,
    phone: request.phone,
    cpf: request.cpf,
    rg: request.rg,
    birthDate: serializeDate(request.birthDate),
    status: request.status,
    possibleMember: serializeMember(request.possibleMember),
    approvedMember: serializeMember(request.approvedMember),
    approvedBy: request.approvedBy,
    approvedAt: serializeDate(request.approvedAt),
    rejectedBy: request.rejectedBy,
    rejectedAt: serializeDate(request.rejectedAt),
    rejectionReason: request.rejectionReason,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString()
  };
}

function serializeMembers(
  members: Awaited<ReturnType<typeof accessRequestRepository.listAssignableMembers>>
) {
  return members.map((member) => ({
    id: member.id,
    name: member.name,
    nickname: member.nickname,
    displayName: getMemberDisplayName(member),
    email: member.email,
    cpf: member.cpf,
    rg: member.rg,
    phone: member.phone,
    mobilePhone: member.mobilePhone,
    whatsapp: member.whatsapp,
    birthDate: serializeDate(member.birthDate),
    status: member.status
  }));
}

function sameDay(left: Date | null | undefined, right: Date | null | undefined) {
  return Boolean(left && right && left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10));
}

function nameSimilarity(left: string, right: string) {
  const a = normalizeNameForMatch(left);
  const b = normalizeNameForMatch(right);

  if (!a || !b) {
    return 0;
  }

  if (a === b) {
    return 1;
  }

  const aParts = new Set(a.split(" ").filter(Boolean));
  const bParts = b.split(" ").filter(Boolean);
  const common = bParts.filter((part) => aParts.has(part)).length;

  return common / Math.max(aParts.size, bParts.length, 1);
}

function evaluateMemberMatch(
  member: Awaited<ReturnType<typeof accessRequestRepository.findMemberCandidates>>[number],
  data: AccessRequestCreateInput
): AccessRequestMemberMatch & { hasActiveUser: boolean } {
  const criteria: string[] = [];
  let score = 0;

  if (data.cpf && member.cpf === data.cpf) {
    criteria.push("CPF igual");
    score = 100;
  }

  if (data.rg && member.rg === data.rg) {
    criteria.push("RG igual");
    score = 100;
  }

  const phoneMatches = [member.phone, member.mobilePhone, member.whatsapp].some((phone) => phone === data.phone);
  const birthMatches = sameDay(member.birthDate, data.birthDate);
  const similarity = nameSimilarity(member.name, data.name);

  if (phoneMatches) {
    criteria.push("Telefone igual");
  }

  if (birthMatches) {
    criteria.push("Data de nascimento igual");
  }

  if (similarity >= 1) {
    criteria.push("Nome igual");
  } else if (similarity >= 0.5) {
    criteria.push("Nome parecido");
  }

  if (data.email && member.email === data.email) {
    criteria.push("E-mail igual");
  }

  if (score !== 100 && phoneMatches && birthMatches && similarity >= 0.8) {
    score = 100;
  }

  if (score !== 100) {
    if ((phoneMatches && similarity >= 0.5) || (birthMatches && similarity >= 0.5) || (data.email && member.email === data.email && similarity >= 0.5)) {
      score = 70;
    } else if (similarity >= 0.5 || phoneMatches || (data.email && member.email === data.email)) {
      score = 35;
    }
  }

  const confidence = score >= 100 ? "HIGH" : score >= 70 ? "MEDIUM" : "LOW";

  return {
    member: serializeMember(member)!,
    score,
    confidence,
    criteria,
    recommendation:
      score >= 100
        ? "Correspondencia forte."
        : score >= 70
          ? "Revisar manualmente antes de aprovar."
          : "Baixa confianca. Nao vincular automaticamente.",
    hasActiveUser: Boolean(member.user?.isActive)
  };
}

async function findMemberMatchesForAccessRequest(data: AccessRequestCreateInput) {
  const candidates = await accessRequestRepository.findMemberCandidates({
    name: data.name,
    email: data.email,
    phone: data.phone,
    cpf: data.cpf,
    rg: data.rg,
    birthDate: data.birthDate
  });

  return candidates
    .map((member) => evaluateMemberMatch(member, data))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score);
}

async function ensureRequestPending(id: string) {
  const request = await accessRequestRepository.findPrivateById(id);

  if (!request) {
    throw new AppError("Solicitacao nao encontrada.", 404, "ACCESS_REQUEST_NOT_FOUND");
  }

  if (request.status !== "PENDING") {
    throw new AppError("Esta solicitacao ja foi concluida.", 409, "ACCESS_REQUEST_ALREADY_FINISHED");
  }

  return request;
}

export const accessRequestService = {
  async createPublic(data: AccessRequestCreateInput) {
    const passwordHash = await hashPassword(data.password);
    const email = data.email ?? buildFallbackEmail(data.username);
    const [memberAccessRole, existingIdentifier, existingCpfIdentifier, pendingDuplicate, existingEmail] = await Promise.all([
      accessRequestRepository.findAccessRoleByName("Membro"),
      accessRequestRepository.findUserByIdentifier(data.username),
      data.cpf ? accessRequestRepository.findUserByIdentifier(data.cpf) : Promise.resolve(null),
      accessRequestRepository.findPendingDuplicate({
        username: data.username,
        phone: data.phone,
        cpf: data.cpf,
        rg: data.rg,
        email: data.email
      }),
      data.email ? accessRequestRepository.findUserByEmail(data.email) : Promise.resolve(null)
    ]);

    if (!memberAccessRole) {
      throw new AppError("Perfil de acesso Membro nao encontrado.", 409, "MEMBER_ACCESS_ROLE_NOT_FOUND");
    }

    if (pendingDuplicate) {
      throw new AppError("Ja existe uma solicitacao pendente com esses dados.", 409, "ACCESS_REQUEST_DUPLICATE");
    }

    const matches = await findMemberMatchesForAccessRequest(data);
    const highConfidenceMatches = matches.filter((match) => match.score === 100);
    const bestMatch = matches[0];

    const requestPayload = {
      name: data.name,
      username: data.username,
      email,
      phone: data.phone,
      cpf: data.cpf,
      rg: data.rg,
      birthDate: data.birthDate,
      passwordHash
    };

    const hasUserConflict = Boolean(existingIdentifier || existingCpfIdentifier || existingEmail);

    if (highConfidenceMatches.length === 1 && !highConfidenceMatches[0].hasActiveUser && !hasUserConflict) {
      try {
        await accessRequestRepository.autoApproveWithExistingMember({
          request: {
            ...requestPayload,
            possibleMemberId: highConfidenceMatches[0].member.id
          },
          accessRoleId: memberAccessRole.id
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw new AppError("Sua solicitacao foi enviada e sera analisada em breve.", 409, "ACCESS_REQUEST_CONFLICT");
        }

        throw error;
      }

      return {
        message: "Solicitacao aceita. Voce ja pode acessar o sistema."
      };
    }

    // Auto-create is intentionally conservative: any plausible member match or
    // user conflict must keep the request pending for manual review.
    if (matches.length === 0 && !hasUserConflict) {
      try {
        await accessRequestRepository.autoApproveWithNewMember({
          request: requestPayload,
          accessRoleId: memberAccessRole.id
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw new AppError("Sua solicitacao foi enviada e sera analisada em breve.", 409, "ACCESS_REQUEST_CONFLICT");
        }

        throw error;
      }

      return {
        message: "Solicitacao aceita. Voce ja pode acessar o sistema."
      };
    }

    try {
      await accessRequestRepository.create({
        name: data.name,
        username: data.username,
        email: data.email,
        phone: data.phone,
        cpf: data.cpf,
        rg: data.rg,
        birthDate: data.birthDate,
        passwordHash,
        possibleMemberId: bestMatch?.member.id
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new AppError("Ja existe uma solicitacao pendente com esses dados.", 409, "ACCESS_REQUEST_DUPLICATE");
      }

      throw error;
    }

    return {
      message: "Sua solicitacao foi enviada e sera analisada em breve."
    };
  },

  async list(filters: AccessRequestListQueryInput): Promise<AccessRequestListResult> {
    const result = await accessRequestRepository.list(filters);

    return {
      requests: result.requests.map(serializeRequest),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / filters.pageSize))
      }
    };
  },

  async getById(id: string): Promise<AccessRequestDetailResult> {
    const [request, members] = await Promise.all([
      accessRequestRepository.findById(id),
      accessRequestRepository.listAssignableMembers()
    ]);

    if (!request) {
      throw new AppError("Solicitacao nao encontrada.", 404, "ACCESS_REQUEST_NOT_FOUND");
    }

    const matches = await findMemberMatchesForAccessRequest({
      name: request.name,
      username: request.username,
      email: request.email ?? undefined,
      phone: request.phone ?? "",
      cpf: request.cpf ?? undefined,
      rg: request.rg ?? undefined,
      birthDate: request.birthDate ?? new Date(0),
      password: "unused-password",
      confirmPassword: "unused-password"
    });

    return {
      request: serializeRequest(request),
      members: serializeMembers(members),
      matches
    };
  },

  async approve(id: string, data: AccessRequestApproveInput, actionUserId: string) {
    const request = await ensureRequestPending(id);
    const [member, linkedUser, existingUsername, existingEmail, memberAccessRole] = await Promise.all([
      accessRequestRepository.findMemberById(data.memberId),
      accessRequestRepository.findMemberWithActiveUser(data.memberId),
      accessRequestRepository.findUserByIdentifier(request.username),
      request.email ? accessRequestRepository.findUserByEmail(request.email) : Promise.resolve(null),
      accessRequestRepository.findAccessRoleByName("Membro")
    ]);

    if (!member) {
      throw new AppError("Membro selecionado nao encontrado.", 404, "MEMBER_NOT_FOUND");
    }

    if (linkedUser) {
      throw new AppError("Este membro ja possui um usuario ativo.", 409, "MEMBER_ALREADY_HAS_ACTIVE_USER");
    }

    if (existingUsername) {
      throw new AppError("Usuario ja cadastrado.", 409, "USER_USERNAME_EXISTS");
    }

    if (existingEmail) {
      throw new AppError("E-mail ja cadastrado em outro usuario.", 409, "USER_EMAIL_EXISTS");
    }

    if (!memberAccessRole) {
      throw new AppError("Perfil de acesso Membro nao encontrado.", 409, "MEMBER_ACCESS_ROLE_NOT_FOUND");
    }

    const approvedRequest = await accessRequestRepository.approve({
        requestId: id,
        actionUserId,
        memberId: data.memberId,
        accessRoleId: memberAccessRole.id,
        user: {
          name: request.name,
          username: request.username,
          email: request.email ?? buildFallbackEmail(request.username),
          passwordHash: request.passwordHash,
          role: UserRole.LEADER,
          mustChangePassword: data.mustChangePassword
        }
      });

    if (!approvedRequest) {
      throw new AppError("Esta solicitacao ja foi finalizada.", 409, "ACCESS_REQUEST_CLOSED");
    }

    return serializeRequest(approvedRequest);
  },

  async reject(id: string, data: AccessRequestRejectInput, actionUserId: string) {
    await ensureRequestPending(id);

    const rejectedRequest = await accessRequestRepository.reject(id, actionUserId, data.reason);

    if (!rejectedRequest) {
      throw new AppError("Esta solicitacao ja foi finalizada.", 409, "ACCESS_REQUEST_CLOSED");
    }

    return serializeRequest(rejectedRequest);
  }
};
