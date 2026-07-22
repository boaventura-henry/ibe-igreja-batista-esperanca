import type { Prisma } from "@prisma/client";
import { prisma } from "@/prisma/client";
import type { AccessRoleCreateInput, AccessRoleUpdateInput } from "@/validators";

const accessRoleSelect = {
  id: true,
  name: true,
  description: true,
  permissions: {
    select: {
      id: true,
      code: true,
      name: true,
      label: true,
      module: true
    },
    orderBy: [{ module: "asc" }, { code: "asc" }]
  },
  dashboardWidgets: {
    select: {
      isVisible: true,
      sortOrder: true,
      size: true,
      visibleOnMobile: true,
      visibleOnTablet: true,
      visibleOnDesktop: true,
      dashboardWidget: { select: { code: true } }
    },
    orderBy: { dashboardWidget: { defaultOrder: "asc" } }
  },
  dashboardLayout: {
    select: { layoutMode: true, desktopColumns: true, tabletColumns: true, mobileColumns: true, showCategoryHeaders: true, allowCategoryCollapse: true }
  },
  isSystem: true,
  isActive: true,
  updatedAt: true,
  _count: {
    select: {
      users: true
    }
  }
} satisfies Prisma.AccessRoleSelect;

const accessRoleDetailSelect = {
  ...accessRoleSelect,
  createdAt: true,
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true
    }
  },
  updatedBy: {
    select: {
      id: true,
      name: true,
      email: true
    }
  }
} satisfies Prisma.AccessRoleSelect;

export type AccessRoleListItem = Prisma.AccessRoleGetPayload<{ select: typeof accessRoleSelect }>;
export type AccessRoleDetail = Prisma.AccessRoleGetPayload<{ select: typeof accessRoleDetailSelect }>;

export const accessRoleRepository = {
  list() {
    return prisma.accessRole.findMany({
      where: { deletedAt: null },
      select: accessRoleSelect,
      orderBy: { name: "asc" }
    });
  },

  listActive() {
    return prisma.accessRole.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    });
  },

  findById(id: string) {
    return prisma.accessRole.findFirst({
      where: { id, deletedAt: null },
      select: accessRoleDetailSelect
    });
  },

  findByName(name: string) {
    return prisma.accessRole.findUnique({
      where: { name },
      select: { id: true }
    });
  },

  countActiveMembers(id: string) {
    return prisma.user.count({
      where: {
        accessRoleId: id,
        member: {
          deletedAt: null
        }
      }
    });
  },

  listPermissions() {
    return prisma.permission.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        label: true,
        module: true,
        description: true
      },
      orderBy: [{ module: "asc" }, { code: "asc" }]
    });
  },

  listDashboardWidgets() {
    return prisma.dashboardWidget.findMany({
      select: {
        code: true,
        title: true,
        description: true,
        category: true,
        defaultOrder: true,
        isEnabled: true,
        sensitivity: true,
        priority: true,
        defaultSize: true,
        defaultVisibleOnMobile: true,
        defaultVisibleOnTablet: true,
        defaultVisibleOnDesktop: true,
        iconKey: true,
        visualVariant: true,
        permission: { select: { code: true } }
      },
      orderBy: { defaultOrder: "asc" }
    });
  },

  create(data: AccessRoleCreateInput, userId: string) {
    return prisma.accessRole.create({
      data: {
        name: data.name,
        description: data.description,
        permissions: {
          connect: data.permissions.map((code) => ({ code }))
        },
        isActive: data.isActive,
        dashboardWidgets: {
          create: data.dashboardWidgets.map((widget) => ({
            isVisible: widget.isVisible,
            sortOrder: widget.sortOrder ?? null,
            size: widget.size ?? null,
            visibleOnMobile: widget.visibleOnMobile ?? null,
            visibleOnTablet: widget.visibleOnTablet ?? null,
            visibleOnDesktop: widget.visibleOnDesktop ?? null,
            dashboardWidget: { connect: { code: widget.code } }
          }))
        },
        dashboardLayout: { create: { layoutMode: data.dashboardLayout.mode, desktopColumns: data.dashboardLayout.desktopColumns, tabletColumns: data.dashboardLayout.tabletColumns, mobileColumns: data.dashboardLayout.mobileColumns, showCategoryHeaders: data.dashboardLayout.showCategoryHeaders, allowCategoryCollapse: data.dashboardLayout.allowCategoryCollapse } },
        createdById: userId,
        updatedById: userId
      },
      select: accessRoleDetailSelect
    });
  },

  update(id: string, data: AccessRoleUpdateInput, userId: string) {
    return prisma.accessRole.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        permissions:
          data.permissions === undefined
            ? undefined
            : {
                set: data.permissions.map((code) => ({ code }))
              },
        isActive: data.isActive,
        dashboardWidgets: data.dashboardWidgets === undefined ? undefined : {
          deleteMany: {},
          create: data.dashboardWidgets.map((widget) => ({
            isVisible: widget.isVisible,
            sortOrder: widget.sortOrder ?? null,
            size: widget.size ?? null,
            visibleOnMobile: widget.visibleOnMobile ?? null,
            visibleOnTablet: widget.visibleOnTablet ?? null,
            visibleOnDesktop: widget.visibleOnDesktop ?? null,
            dashboardWidget: { connect: { code: widget.code } }
          }))
        },
        dashboardLayout: data.dashboardLayout === undefined ? undefined : {
          upsert: {
            create: { layoutMode: data.dashboardLayout.mode, desktopColumns: data.dashboardLayout.desktopColumns, tabletColumns: data.dashboardLayout.tabletColumns, mobileColumns: data.dashboardLayout.mobileColumns, showCategoryHeaders: data.dashboardLayout.showCategoryHeaders, allowCategoryCollapse: data.dashboardLayout.allowCategoryCollapse },
            update: { layoutMode: data.dashboardLayout.mode, desktopColumns: data.dashboardLayout.desktopColumns, tabletColumns: data.dashboardLayout.tabletColumns, mobileColumns: data.dashboardLayout.mobileColumns, showCategoryHeaders: data.dashboardLayout.showCategoryHeaders, allowCategoryCollapse: data.dashboardLayout.allowCategoryCollapse }
          }
        },
        updatedById: userId
      },
      select: accessRoleDetailSelect
    });
  },

  softDelete(id: string, userId: string) {
    return prisma.accessRole.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedById: userId
      },
      select: { id: true, deletedAt: true }
    });
  },

  upsertSystemRole(data: Omit<AccessRoleCreateInput, "dashboardWidgets" | "dashboardLayout"> & { isSystem?: boolean }) {
    return prisma.accessRole.upsert({
      where: { name: data.name },
      update: {
        description: data.description,
        permissions: {
          set: data.permissions.map((code) => ({ code }))
        },
        isSystem: data.isSystem ?? true,
        isActive: true,
        deletedAt: null
      },
      create: {
        name: data.name,
        description: data.description,
        permissions: {
          connect: data.permissions.map((code) => ({ code }))
        },
        isSystem: data.isSystem ?? true,
        isActive: true
      },
      select: accessRoleDetailSelect
    });
  }
};
