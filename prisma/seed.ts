import { hashPassword } from "../src/utils/password";
import { seedAdminSchema } from "../src/validators/auth.validator";
import { userRepository } from "../src/repositories/user.repository";
import { accessRoleRepository } from "../src/repositories/access-role.repository";
import { availablePermissions, type PermissionCode } from "../src/lib/permissions";
import { prisma } from "../src/prisma/client";
import { ZodError } from "zod";
import { createSlug } from "../src/utils/identity";
import { MinistryIcon } from "@prisma/client";

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
    permissions: ["member.view", "member.create", "member.update", "ministry.view", "memberMinistry.view"]
  },
  {
    name: "Secretario",
    description: "Acesso operacional para secretaria da igreja.",
    permissions: [
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
      "memberMinistry.update"
    ]
  },
  {
    name: "Membro",
    description: "Acesso basico para visualizacao.",
    permissions: ["member.view", "ministry.view", "memberMinistry.view"]
  }
];

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
        isSystem: true,
        isActive: true
      },
      create: {
        code: permission.code,
        name: permission.name,
        label: permission.label,
        module: permission.module,
        isSystem: true,
        isActive: true
      }
    });
  }

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
