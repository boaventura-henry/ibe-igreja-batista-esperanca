import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";
import {
  accessRoleRepository,
  type AccessRoleDetail,
  type AccessRoleListItem
} from "@/repositories";
import type { AccessRoleListResult, AccessRoleSummary } from "@/types";
import type { AccessRoleCreateInput, AccessRoleUpdateInput } from "@/validators";
import { dashboardWidgetByCode, isDashboardWidgetCode } from "@/config/dashboard-widgets";
import { defaultDashboardLayout, dashboardLayoutModes, type DashboardLayoutConfiguration } from "@/config/dashboard-widget-enums";

function serializeLayout(layout: AccessRoleListItem["dashboardLayout"]): DashboardLayoutConfiguration {
  if (!layout) return { ...defaultDashboardLayout };
  return {
    mode: dashboardLayoutModes.includes(layout.layoutMode) ? layout.layoutMode : defaultDashboardLayout.mode,
    desktopColumns: ([1, 2, 3, 4].includes(layout.desktopColumns) ? layout.desktopColumns : 3) as 1 | 2 | 3 | 4,
    tabletColumns: ([1, 2, 3].includes(layout.tabletColumns) ? layout.tabletColumns : 2) as 1 | 2 | 3,
    mobileColumns: ([1, 2].includes(layout.mobileColumns) ? layout.mobileColumns : 1) as 1 | 2,
    showCategoryHeaders: layout.showCategoryHeaders,
    allowCategoryCollapse: layout.allowCategoryCollapse
  };
}

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
    updatedAt: role.updatedAt.toISOString(),
    dashboardWidgets: role.dashboardWidgets.flatMap((configuration) =>
      isDashboardWidgetCode(configuration.dashboardWidget.code)
        ? [{ code: configuration.dashboardWidget.code, isVisible: configuration.isVisible, sortOrder: configuration.sortOrder, size: configuration.size, visibleOnMobile: configuration.visibleOnMobile, visibleOnTablet: configuration.visibleOnTablet, visibleOnDesktop: configuration.visibleOnDesktop }]
        : []
    ),
    dashboardLayout: serializeLayout(role.dashboardLayout)
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
    const [roles, permissions, widgets] = await Promise.all([
      accessRoleRepository.list(),
      accessRoleRepository.listPermissions(),
      accessRoleRepository.listDashboardWidgets()
    ]);

    return {
      accessRoles: roles.map(serialize),
      availablePermissions: permissions,
      availableDashboardWidgets: widgets.flatMap((widget) => {
        if (!isDashboardWidgetCode(widget.code)) return [];
        const definition = dashboardWidgetByCode.get(widget.code);
        if (!definition) return [];
        return [{ code: widget.code, title: widget.title, description: widget.description, category: widget.category, permissionCode: widget.permission.code, defaultOrder: widget.defaultOrder, isEnabled: widget.isEnabled, sensitivity: definition.sensitivity, priority: definition.priority, defaultSize: definition.defaultSize, defaultVisibleOnMobile: definition.defaultVisibleOnMobile, defaultVisibleOnTablet: definition.defaultVisibleOnTablet, defaultVisibleOnDesktop: definition.defaultVisibleOnDesktop, iconKey: definition.iconKey, visualVariant: definition.visualVariant }];
      })
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
