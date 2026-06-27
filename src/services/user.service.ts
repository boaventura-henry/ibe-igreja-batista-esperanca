import { UserRole } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { userRepository, type SafeUser } from "@/repositories";
import type { UserListResult, UserSummary } from "@/types";
import { hashPassword } from "@/utils";
import type {
  UserCreateInput,
  UserListQueryInput,
  UserResetPasswordInput,
  UserUpdateInput
} from "@/validators";

const lockDurationMs = 24 * 60 * 60 * 1000;

function serializeDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

function serializeUser(user: SafeUser): UserSummary {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    member: user.member,
    accessRole: user.accessRole ? { id: user.accessRole.id, name: user.accessRole.name } : null,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: serializeDate(user.lastLoginAt),
    failedLoginAttempts: user.failedLoginAttempts,
    lockedUntil: serializeDate(user.lockedUntil),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
}

async function ensureUniqueEmail(email: string | undefined, currentUserId?: string) {
  if (!email) {
    return;
  }

  const existing = await userRepository.findByEmail(email);

  if (existing && existing.id !== currentUserId) {
    throw new AppError("Email ja cadastrado.", 409, "USER_EMAIL_EXISTS");
  }
}

async function ensureMemberAvailable(memberId: string | undefined | null, currentUserId?: string) {
  if (!memberId) {
    return;
  }

  const existing = await userRepository.findByMemberId(memberId);

  if (existing && existing.id !== currentUserId) {
    throw new AppError("Membro ja vinculado a outro usuario.", 409, "MEMBER_ALREADY_LINKED");
  }
}

async function ensureCanDisableAdmin(target: SafeUser, actionUserId: string) {
  if (target.id === actionUserId) {
    throw new AppError("Voce nao pode executar esta acao no seu proprio usuario.", 409, "SELF_ACTION_BLOCKED");
  }

  if (target.role === UserRole.ADMIN) {
    const remainingAdmins = await userRepository.countActiveAdmins(target.id);

    if (remainingAdmins <= 0) {
      throw new AppError("Nao e permitido remover o ultimo ADMIN ativo.", 409, "LAST_ADMIN_ACTIVE");
    }
  }
}

export const userService = {
  async list(filters: UserListQueryInput): Promise<UserListResult> {
    const [result, accessRoles, members] = await Promise.all([
      userRepository.list(filters),
      userRepository.listAccessRoles(),
      userRepository.listAssignableMembers()
    ]);

    return {
      users: result.users.map(serializeUser),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / filters.pageSize))
      },
      filters: {
        accessRoles,
        members
      }
    };
  },

  async getById(id: string) {
    const [user, members] = await Promise.all([
      userRepository.findById(id),
      userRepository.listAssignableMembers(id)
    ]);

    if (!user) {
      throw new AppError("Usuario nao encontrado.", 404, "USER_NOT_FOUND");
    }

    return {
      user: serializeUser(user),
      assignableMembers: members
    };
  },

  async create(data: UserCreateInput) {
    await ensureUniqueEmail(data.email);
    await ensureMemberAvailable(data.memberId);

    const passwordHash = await hashPassword(data.password);
    const user = await userRepository.create({ ...data, passwordHash });

    return serializeUser(user);
  },

  async update(id: string, data: UserUpdateInput, actionUserId: string) {
    const current = await userRepository.findById(id);

    if (!current) {
      throw new AppError("Usuario nao encontrado.", 404, "USER_NOT_FOUND");
    }

    if (data.email) {
      await ensureUniqueEmail(data.email, id);
    }

    await ensureMemberAvailable(data.memberId, id);

    if (data.isActive === false || data.role !== undefined) {
      if (current.role === UserRole.ADMIN && data.role && data.role !== UserRole.ADMIN) {
        await ensureCanDisableAdmin(current, actionUserId);
      }

      if (data.isActive === false) {
        await ensureCanDisableAdmin(current, actionUserId);
      }
    }

    const user = await userRepository.update(id, data);

    return serializeUser(user);
  },

  async deactivate(id: string, actionUserId: string) {
    const current = await this.getSafeUser(id);
    await ensureCanDisableAdmin(current, actionUserId);

    return serializeUser(await userRepository.deactivate(id));
  },

  async activate(id: string) {
    await this.getSafeUser(id);

    return serializeUser(await userRepository.activate(id));
  },

  async lock(id: string, actionUserId: string) {
    const current = await this.getSafeUser(id);
    await ensureCanDisableAdmin(current, actionUserId);

    return serializeUser(await userRepository.lock(id, new Date(Date.now() + lockDurationMs)));
  },

  async unlock(id: string) {
    await this.getSafeUser(id);

    return serializeUser(await userRepository.unlock(id));
  },

  async resetPassword(id: string, data: UserResetPasswordInput) {
    await this.getSafeUser(id);

    const passwordHash = await hashPassword(data.password);

    return serializeUser(await userRepository.updatePassword(id, passwordHash));
  },

  async remove(id: string, actionUserId: string) {
    return this.deactivate(id, actionUserId);
  },

  async getSafeUser(id: string) {
    const user = await userRepository.findById(id);

    if (!user) {
      throw new AppError("Usuario nao encontrado.", 404, "USER_NOT_FOUND");
    }

    return user;
  }
};
