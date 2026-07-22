import { PasswordResetRequestStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { passwordResetRequestRepository, type SafePasswordResetRequest } from "@/repositories";
import type {
  PasswordResetApprovalResult,
  PasswordResetRequestListResult,
  PasswordResetRequestSummary
} from "@/types";
import { generateTemporaryPassword, getMemberDisplayName, hashPassword, normalizeOptionalDigits } from "@/utils";
import type {
  PasswordResetRequestCreateInput,
  PasswordResetRequestListQueryInput,
  PasswordResetRequestRejectInput
} from "@/validators";

function serializeDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

function serializeRequest(request: SafePasswordResetRequest): PasswordResetRequestSummary {
  return {
    id: request.id,
    identifier: request.identifier,
    name: request.name,
    email: request.email,
    phone: request.phone,
    cpf: request.cpf,
    status: request.status,
    user: request.user
      ? {
          id: request.user.id,
          name: request.user.name,
          username: request.user.username,
          email: request.user.email,
          member: request.user.member
            ? {
                id: request.user.member.id,
                name: request.user.member.name,
                nickname: request.user.member.nickname,
                displayName: getMemberDisplayName(request.user.member),
                cpf: request.user.member.cpf
              }
            : null
        }
      : null,
    processedBy: request.processedBy,
    requestedAt: request.requestedAt.toISOString(),
    processedAt: serializeDate(request.processedAt),
    rejectionReason: request.rejectionReason,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString()
  };
}

const publicSuccessMessage =
  "Se os dados informados estiverem cadastrados, a solicitacao sera encaminhada para analise.";

function maskIdentifier(identifier: string) {
  if (identifier.length === 11) {
    return `${identifier.slice(0, 3)}.***.***-${identifier.slice(-2)}`;
  }

  if (identifier.length === 10) {
    return `(**) ****-${identifier.slice(-4)}`;
  }

  return `(**) *****-${identifier.slice(-4)}`;
}

export const passwordResetRequestService = {
  async createPublic(data: PasswordResetRequestCreateInput) {
    const normalizedIdentifier = data.identifier;
    const [existingPending, possibleUser] = await Promise.all([
      passwordResetRequestRepository.findPendingDuplicate(normalizedIdentifier),
      passwordResetRequestRepository.findUserByIdentifier(normalizedIdentifier)
    ]);
    const normalizedPhone = normalizeOptionalDigits(data.phone);
    const normalizedCpf = normalizeOptionalDigits(data.cpf);

    if (!existingPending) {
      await passwordResetRequestRepository.create({
        identifier: maskIdentifier(normalizedIdentifier),
        normalizedIdentifier,
        name: data.name,
        email: data.email,
        phone: normalizedPhone ? maskIdentifier(normalizedPhone) : undefined,
        cpf: normalizedCpf ? maskIdentifier(normalizedCpf) : undefined,
        userId: possibleUser?.id ?? null
      });
    }

    return { message: publicSuccessMessage };
  },

  async list(filters: PasswordResetRequestListQueryInput): Promise<PasswordResetRequestListResult> {
    const result = await passwordResetRequestRepository.list(filters);

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

  async getById(id: string) {
    const request = await passwordResetRequestRepository.findById(id);

    if (!request) {
      throw new AppError("Solicitacao nao encontrada.", 404, "PASSWORD_RESET_REQUEST_NOT_FOUND");
    }

    return serializeRequest(request);
  },

  async approve(id: string, actionUserId: string): Promise<PasswordResetApprovalResult> {
    const request = await passwordResetRequestRepository.findById(id);

    if (!request) {
      throw new AppError("Solicitacao nao encontrada.", 404, "PASSWORD_RESET_REQUEST_NOT_FOUND");
    }

    if (request.status !== PasswordResetRequestStatus.PENDING) {
      throw new AppError("Esta solicitacao ja foi finalizada.", 409, "PASSWORD_RESET_REQUEST_CLOSED");
    }

    if (!request.user) {
      throw new AppError("Nao ha usuario vinculado a esta solicitacao.", 409, "PASSWORD_RESET_USER_NOT_FOUND");
    }

    const possibleUser = await passwordResetRequestRepository.findUserByIdentifier(request.normalizedIdentifier);

    if (!possibleUser || possibleUser.id !== request.user.id) {
      throw new AppError("Nao foi possivel confirmar o usuario da solicitacao.", 409, "PASSWORD_RESET_USER_MISMATCH");
    }

    if (!possibleUser.isActive) {
      throw new AppError("Usuario inativo nao pode ter senha redefinida por este fluxo.", 409, "PASSWORD_RESET_USER_INACTIVE");
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    const approvedRequest = await passwordResetRequestRepository.approve(id, actionUserId, request.user.id, passwordHash);

    if (!approvedRequest) {
      throw new AppError("Esta solicitacao ja foi finalizada.", 409, "PASSWORD_RESET_REQUEST_CLOSED");
    }

    return {
      request: serializeRequest(approvedRequest),
      temporaryPassword
    };
  },

  async reject(id: string, data: PasswordResetRequestRejectInput, actionUserId: string) {
    const request = await passwordResetRequestRepository.findById(id);

    if (!request) {
      throw new AppError("Solicitacao nao encontrada.", 404, "PASSWORD_RESET_REQUEST_NOT_FOUND");
    }

    if (request.status !== PasswordResetRequestStatus.PENDING) {
      throw new AppError("Esta solicitacao ja foi finalizada.", 409, "PASSWORD_RESET_REQUEST_CLOSED");
    }

    const rejectedRequest = await passwordResetRequestRepository.reject(id, actionUserId, data.reason);

    if (!rejectedRequest) {
      throw new AppError("Esta solicitacao ja foi finalizada.", 409, "PASSWORD_RESET_REQUEST_CLOSED");
    }

    return serializeRequest(rejectedRequest);
  }
};
