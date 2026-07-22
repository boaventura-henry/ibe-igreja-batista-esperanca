import { hashPassword } from "../src/utils/password";
import { seedAdminSchema } from "../src/validators/auth.validator";
import { userRepository } from "../src/repositories/user.repository";
import { accessRoleRepository } from "../src/repositories/access-role.repository";
import { availablePermissions, type PermissionCode } from "../src/lib/permissions";
import { prisma } from "../src/prisma/client";
import { ZodError } from "zod";
import { createSlug } from "../src/utils/identity";
import { FinancialEntryType, MinistryIcon } from "@prisma/client";
import { dashboardWidgets } from "../src/config/dashboard-widgets";
import { defaultDashboardLayout, type DashboardLayoutConfiguration } from "../src/config/dashboard-widget-enums";

const allDashboardWidgetPermissions = dashboardWidgets.map((widget) => widget.permissionCode);
const operationalDashboardWidgetPermissions = dashboardWidgets
  .filter((widget) => widget.sensitivity !== "RESTRICTED")
  .map((widget) => widget.permissionCode);

const defaultAccessRoles: Array<{
  name: string;
  description: string;
  permissions: PermissionCode[];
}> = [
  {
    name: "Administrador",
    description: "Acesso administrativo completo ao sistema.",
    permissions: availablePermissions.map((permission) => permission.code)
  },
  {
    name: "Pastor",
    description: "Acesso pastoral para visualizar e manter cadastros de membros.",
    permissions: [
      "dashboard.admin.view",
      ...allDashboardWidgetPermissions,
      "dashboard.portal.view",
      "report.view",
      "report.export",
      "member.view",
      "member.create",
      "member.update",
      "ministry.view",
      "memberMinistry.view",
      "schedule.view",
      "event.view",
      "announcement.view",
      "announcement.create",
      "announcement.update",
      "announcement.publish",
      "announcement.archive",
      "financialCategory.view",
      "financialEntry.view",
      "financialClosing.view",
      "memberContribution.view",
      "portalAnnouncement.view",
      "mySchedule.view",
      "mySchedule.confirm",
      "memberPortal.view",
      "memberPortal.updateProfile",
      "memberAccount.view",
      "memberAccount.update",
      "memberAccount.changePassword",
      "passwordResetRequest.view"
    ]
  },
  {
    name: "Secretario",
    description: "Acesso operacional para secretaria da igreja.",
    permissions: [
      "dashboard.admin.view",
      ...operationalDashboardWidgetPermissions,
      "dashboard.portal.view",
      "report.view",
      "report.export",
      "member.view",
      "member.create",
      "member.update",
      "member.photo.upload",
      "member.export",
      "ministry.view",
      "ministry.create",
      "ministry.update",
      "memberMinistry.view",
      "memberMinistry.create",
      "memberMinistry.update",
      "schedule.view",
      "schedule.create",
      "schedule.update",
      "schedule.publish",
      "schedule.cancel",
      "schedule.complete",
      "schedule.confirm",
      "song.view",
      "song.create",
      "song.update",
      "song.delete",
      "event.view",
      "event.create",
      "event.update",
      "event.delete",
      "event.publish",
      "event.cancel",
      "event.complete",
      "announcement.view",
      "announcement.create",
      "announcement.update",
      "announcement.delete",
      "announcement.publish",
      "announcement.archive",
      "financialCategory.view",
      "financialEntry.view",
      "memberContribution.view",
      "portalAnnouncement.view",
      "mySchedule.view",
      "mySchedule.confirm",
      "memberPortal.view",
      "memberPortal.updateProfile",
      "memberAccount.view",
      "memberAccount.update",
      "memberAccount.changePassword",
      "accessRequest.view",
      "passwordResetRequest.view",
      "passwordResetRequest.approve",
      "passwordResetRequest.reject"
    ]
  },
  {
    name: "Membro",
    description: "Acesso basico para visualizacao.",
    permissions: [
      "dashboard.portal.view",
      "member.view",
      "ministry.view",
      "memberMinistry.view",
      "schedule.view",
      "schedule.confirm",
      "event.view",
      "memberContribution.view",
      "portalAnnouncement.view",
      "mySchedule.view",
      "mySchedule.confirm",
      "memberPortal.view",
      "memberPortal.updateProfile",
      "memberAccount.view",
      "memberAccount.update",
      "memberAccount.changePassword",
      "accessRequest.view",
      "accessRequest.approve",
      "accessRequest.reject"
    ]
  }
];

const defaultDashboardLayoutsByRole: Record<string, DashboardLayoutConfiguration> = {
  Administrador: { ...defaultDashboardLayout, mode: "EXPANDED", desktopColumns: 4 },
  Pastor: { ...defaultDashboardLayout, mode: "BALANCED", desktopColumns: 3 },
  Secretario: { ...defaultDashboardLayout, mode: "COMPACT", desktopColumns: 3 }
};

const defaultMinistries: Array<{
  name: string;
  color: string;
  icon: MinistryIcon;
  displayOrder: number;
}> = [
  { name: "Louvor", color: "#2563EB", icon: MinistryIcon.MUSIC, displayOrder: 1 },
  { name: "Infantil", color: "#F59E0B", icon: MinistryIcon.CHILDREN, displayOrder: 2 },
  { name: "Jovens", color: "#7C3AED", icon: MinistryIcon.USERS, displayOrder: 3 },
  { name: "Casais", color: "#DB2777", icon: MinistryIcon.HEART, displayOrder: 4 },
  { name: "Recepção", color: "#059669", icon: MinistryIcon.CHURCH, displayOrder: 5 },
  { name: "Mídia", color: "#DC2626", icon: MinistryIcon.CAMERA, displayOrder: 6 },
  { name: "Intercessão", color: "#0891B2", icon: MinistryIcon.CROSS, displayOrder: 7 },
  { name: "Patrimônio", color: "#4B5563", icon: MinistryIcon.HOME, displayOrder: 8 }
];

const defaultFinancialCategories: Array<{
  name: string;
  type: FinancialEntryType;
  displayOrder: number;
  showInMemberPortal: boolean;
}> = [
  { name: "Dizimo", type: FinancialEntryType.INCOME, displayOrder: 1, showInMemberPortal: true },
  { name: "Oferta", type: FinancialEntryType.INCOME, displayOrder: 2, showInMemberPortal: true },
  { name: "Missoes", type: FinancialEntryType.INCOME, displayOrder: 3, showInMemberPortal: true },
  { name: "Construcao", type: FinancialEntryType.INCOME, displayOrder: 4, showInMemberPortal: true },
  { name: "Campanha", type: FinancialEntryType.INCOME, displayOrder: 5, showInMemberPortal: true },
  { name: "Evento", type: FinancialEntryType.INCOME, displayOrder: 6, showInMemberPortal: true },
  { name: "Doacao", type: FinancialEntryType.INCOME, displayOrder: 7, showInMemberPortal: true },
  { name: "Outros", type: FinancialEntryType.INCOME, displayOrder: 8, showInMemberPortal: false },
  { name: "Conta de Luz", type: FinancialEntryType.EXPENSE, displayOrder: 1, showInMemberPortal: false },
  { name: "Agua", type: FinancialEntryType.EXPENSE, displayOrder: 2, showInMemberPortal: false },
  { name: "Internet", type: FinancialEntryType.EXPENSE, displayOrder: 3, showInMemberPortal: false },
  { name: "Manutencao", type: FinancialEntryType.EXPENSE, displayOrder: 4, showInMemberPortal: false },
  { name: "Compra de Equipamentos", type: FinancialEntryType.EXPENSE, displayOrder: 5, showInMemberPortal: false },
  { name: "Ajuda Social", type: FinancialEntryType.EXPENSE, displayOrder: 6, showInMemberPortal: false },
  { name: "Outros", type: FinancialEntryType.EXPENSE, displayOrder: 7, showInMemberPortal: false }
];

async function main() {
  const admin = seedAdminSchema.parse({
    name: process.env.ADMIN_NAME,
    username: process.env.ADMIN_USERNAME,
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD
  });

  for (const permission of availablePermissions) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: {
        name: permission.name,
        label: permission.label,
        module: permission.module,
        description: "description" in permission ? permission.description : null,
        isSystem: true,
        isActive: true
      },
      create: {
        code: permission.code,
        name: permission.name,
        label: permission.label,
        module: permission.module,
        description: "description" in permission ? permission.description : null,
        isSystem: true,
        isActive: true
      }
    });
  }

  for (const widget of dashboardWidgets) {
    await prisma.dashboardWidget.upsert({
      where: { code: widget.code },
      update: {
        title: widget.title,
        description: widget.description,
        category: widget.category,
        sensitivity: widget.sensitivity,
        priority: widget.priority,
        defaultSize: widget.defaultSize,
        defaultVisibleOnMobile: widget.defaultVisibleOnMobile,
        defaultVisibleOnTablet: widget.defaultVisibleOnTablet,
        defaultVisibleOnDesktop: widget.defaultVisibleOnDesktop,
        iconKey: widget.iconKey,
        visualVariant: widget.visualVariant,
        defaultOrder: widget.defaultOrder,
        isEnabled: widget.enabled,
        isSystem: true,
        permission: { connect: { code: widget.permissionCode } }
      },
      create: {
        code: widget.code,
        title: widget.title,
        description: widget.description,
        category: widget.category,
        sensitivity: widget.sensitivity,
        priority: widget.priority,
        defaultSize: widget.defaultSize,
        defaultVisibleOnMobile: widget.defaultVisibleOnMobile,
        defaultVisibleOnTablet: widget.defaultVisibleOnTablet,
        defaultVisibleOnDesktop: widget.defaultVisibleOnDesktop,
        iconKey: widget.iconKey,
        visualVariant: widget.visualVariant,
        defaultOrder: widget.defaultOrder,
        isEnabled: widget.enabled,
        isSystem: true,
        permission: { connect: { code: widget.permissionCode } }
      }
    });
  }

  console.log(`Dashboard widgets ready: ${dashboardWidgets.length}`);

  let adminAccessRoleId: string | null = null;
  for (const role of defaultAccessRoles) {
    const accessRole = await accessRoleRepository.upsertSystemRole({
      ...role,
      isActive: true,
      isSystem: true
    });

    if (role.name === "Administrador") {
      adminAccessRoleId = accessRole.id;
    }

    const dashboardLayout = defaultDashboardLayoutsByRole[role.name];
    if (dashboardLayout) {
      const { mode, ...dashboardLayoutValues } = dashboardLayout;
      const databaseDashboardLayout = { ...dashboardLayoutValues, layoutMode: mode };
      await prisma.accessRoleDashboardLayout.upsert({
        where: { accessRoleId: accessRole.id },
        update: databaseDashboardLayout,
        create: { accessRoleId: accessRole.id, ...databaseDashboardLayout }
      });
    }
  }

  console.log(`Access roles ready: ${defaultAccessRoles.length}`);

  for (const ministry of defaultMinistries) {
    await prisma.ministry.upsert({
      where: { name: ministry.name },
      update: {
        color: ministry.color,
        icon: ministry.icon,
        slug: createSlug(ministry.name),
        displayOrder: ministry.displayOrder,
        isSystem: true,
        isActive: true,
        deletedAt: null
      },
      create: {
        ...ministry,
        slug: createSlug(ministry.name),
        isSystem: true,
        isActive: true
      }
    });
  }

  console.log(`Ministries ready: ${defaultMinistries.length}`);

  for (const category of defaultFinancialCategories) {
    await prisma.financialCategory.upsert({
      where: {
        name_type: {
          name: category.name,
          type: category.type
        }
      },
      update: {
        displayOrder: category.displayOrder,
        showInMemberPortal: category.showInMemberPortal,
        isSystem: true,
        isActive: true,
        deletedAt: null
      },
      create: {
        ...category,
        isSystem: true,
        isActive: true
      }
    });
  }

  console.log(`Financial categories ready: ${defaultFinancialCategories.length}`);

  const passwordHash = await hashPassword(admin.password);

  await userRepository.upsertAdmin({
    username: admin.username,
    name: admin.name,
    email: admin.email,
    passwordHash,
    accessRoleId: adminAccessRoleId
  });

  console.log("Admin user ready.");
}

main()
  .catch((error) => {
    if (error instanceof ZodError) {
      console.error(
        "Invalid admin seed environment variables. Check ADMIN_USERNAME, ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD."
      );
    } else {
      console.error(error instanceof Error ? error.message : "Failed to seed admin user.");
    }

    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
