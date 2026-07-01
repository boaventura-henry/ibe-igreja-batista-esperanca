import { UserRole } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { accessRequestRepository, type SafeAccessRequest } from "@/repositories";
import type { AccessRequestDetailResult, AccessRequestListResult, AccessRequestSummary } from "@/types";
import { hashPassword } from "@/utils";
import type {
  AccessRequestApproveInput,
  AccessRequestCreateInput,
  AccessRequestListQueryInput,
  AccessRequestRejectInput
} from "@/validators";

function serializeDate(value: Date | null) {
  return value ? value.toISOString() : null;
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
    email: member.email,
    cpf: member.cpf,
    birthDate: serializeDate(member.birthDate)
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
    email: member.email,
    cpf: member.cpf,
    birthDate: serializeDate(member.birthDate)
  }));
}

async function ensureUsernameAvailable(username: string) {
  const [existingUser, pendingRequest] = await Promise.all([
    accessRequestRepository.findUserByUsername(username),
    accessRequestRepository.findPendingByUsername(username)
  ]);

  if (existingUser || pendingRequest) {
    throw new AppError("Usuario indisponivel.", 409, "USERNAME_UNAVAILABLE");
  }
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
    await ensureUsernameAvailable(data.username);

    const possibleMember = await accessRequestRepository.suggestMember({
      email: data.email,
      phone: data.phone,
      cpf: data.cpf,
      name: data.name,
      birthDate: data.birthDate
    });
    const passwordHash = await hashPassword(data.password);

    await accessRequestRepository.create({
      name: data.name,
      username: data.username,
      email: data.email,
      phone: data.phone,
      cpf: data.cpf,
      birthDate: data.birthDate,
      passwordHash,
      possibleMemberId: possibleMember?.id
    });

    return {
      message: "Solicitacao enviada. Aguarde a aprovacao da secretaria."
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

    return {
      request: serializeRequest(request),
      members: serializeMembers(members)
    };
  },

  async approve(id: string, data: AccessRequestApproveInput, actionUserId: string) {
    const request = await ensureRequestPending(id);
    const [member, linkedUser, existingUsername, existingEmail, memberAccessRole] = await Promise.all([
      accessRequestRepository.findMemberById(data.memberId),
      accessRequestRepository.findMemberWithActiveUser(data.memberId),
      accessRequestRepository.findUserByUsername(request.username),
      accessRequestRepository.findUserByEmail(request.email),
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

    return serializeRequest(
      await accessRequestRepository.approve({
        requestId: id,
        actionUserId,
        memberId: data.memberId,
        accessRoleId: memberAccessRole.id,
        user: {
          name: request.name,
          username: request.username,
          email: request.email,
          passwordHash: request.passwordHash,
          role: UserRole.LEADER,
          mustChangePassword: data.mustChangePassword
        }
      })
    );
  },

  async reject(id: string, data: AccessRequestRejectInput, actionUserId: string) {
    await ensureRequestPending(id);

    return serializeRequest(await accessRequestRepository.reject(id, actionUserId, data.reason));
  }
};
