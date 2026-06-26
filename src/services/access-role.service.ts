import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";
import {
  accessRoleRepository,
  type AccessRoleDetail,
  type AccessRoleListItem
} from "@/repositories";
import type { AccessRoleListResult, AccessRoleSummary } from "@/types";
import type { AccessRoleCreateInput, AccessRoleUpdateInput } from "@/validators";

function serialize(role: AccessRoleListItem): AccessRoleSummary {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    permissions: role.permissions,
    isSystem: role.isSystem,
    isActive: role.isActive,
    usersCount: role._count.users,
    membersCount: role._count.users,
    updatedAt: role.updatedAt.toISOString()
  };
}

function serializeDetail(role: AccessRoleDetail) {
  return {
    ...serialize(role),
    createdAt: role.createdAt.toISOString(),
    createdBy: role.createdBy,
    updatedBy: role.updatedBy
  };
}

function isUniqueConstraint(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function ensureUniqueName(name: string | undefined, currentId?: string) {
  if (!name) {
    return;
  }

  const existing = await accessRoleRepository.findByName(name);

  if (existing && existing.id !== currentId) {
    throw new AppError("Ja existe um perfil de acesso com este nome.", 409, "ACCESS_ROLE_NAME_EXISTS");
  }
}

export const accessRoleService = {
  async list(): Promise<AccessRoleListResult> {
    const [roles, permissions] = await Promise.all([
      accessRoleRepository.list(),
      accessRoleRepository.listPermissions()
    ]);

    return {
      accessRoles: roles.map(serialize),
      availablePermissions: permissions
    };
  },

  async listActive() {
    return accessRoleRepository.listActive();
  },

  async getById(id: string) {
    const role = await accessRoleRepository.findById(id);

    if (!role) {
      throw new AppError("Perfil de acesso nao encontrado.", 404, "ACCESS_ROLE_NOT_FOUND");
    }

    return serializeDetail(role);
  },

  async create(data: AccessRoleCreateInput, userId: string) {
    await ensureUniqueName(data.name);

    try {
      const role = await accessRoleRepository.create(data, userId);

      return serializeDetail(role);
    } catch (error) {
      if (isUniqueConstraint(error)) {
        throw new AppError("Ja existe um perfil de acesso com este nome.", 409, "ACCESS_ROLE_NAME_EXISTS");
      }

      throw error;
    }
  },

  async update(id: string, data: AccessRoleUpdateInput, userId: string) {
    const current = await this.getById(id);

    if (current.isSystem && !data.confirmSystemChange) {
      throw new AppError(
        "Confirme explicitamente a alteracao deste perfil do sistema.",
        409,
        "SYSTEM_ROLE_CONFIRMATION_REQUIRED"
      );
    }

    await ensureUniqueName(data.name, id);

    try {
      const role = await accessRoleRepository.update(id, data, userId);

      return serializeDetail(role);
    } catch (error) {
      if (isUniqueConstraint(error)) {
        throw new AppError("Ja existe um perfil de acesso com este nome.", 409, "ACCESS_ROLE_NAME_EXISTS");
      }

      throw error;
    }
  },

  async remove(id: string, userId: string, confirmSystemChange = false) {
    const current = await this.getById(id);

    if (current.isSystem && !confirmSystemChange) {
      throw new AppError(
        "Confirme explicitamente a exclusao deste perfil do sistema.",
        409,
        "SYSTEM_ROLE_CONFIRMATION_REQUIRED"
      );
    }

    const activeMembers = await accessRoleRepository.countActiveMembers(id);

    if (activeMembers > 0) {
      throw new AppError(
        "Nao e possivel excluir um perfil vinculado a membros ativos.",
        409,
        "ACCESS_ROLE_IN_USE"
      );
    }

    return accessRoleRepository.softDelete(id, userId);
  }
};
