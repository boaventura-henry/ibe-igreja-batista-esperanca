import { hashPassword } from "../src/utils/password";
import { seedAdminSchema } from "../src/validators/auth.validator";
import { userRepository } from "../src/repositories/user.repository";
import { accessRoleRepository } from "../src/repositories/access-role.repository";
import { availablePermissions, type PermissionCode } from "../src/lib/permissions";
import { prisma } from "../src/prisma/client";
import { ZodError } from "zod";

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
    permissions: ["member.view", "member.create", "member.update"]
  },
  {
    name: "Secretario",
    description: "Acesso operacional para secretaria da igreja.",
    permissions: ["member.view", "member.create", "member.update", "member.photo.upload", "member.export"]
  },
  {
    name: "Membro",
    description: "Acesso basico para visualizacao.",
    permissions: ["member.view"]
  }
];

async function main() {
  const admin = seedAdminSchema.parse({
    name: process.env.ADMIN_NAME,
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

  const passwordHash = await hashPassword(admin.password);

  const user = await userRepository.upsertAdmin({
    name: admin.name,
    email: admin.email,
    passwordHash,
    accessRoleId: adminAccessRoleId
  });

  console.log(`Admin user ready: ${user.email}`);
}

main()
  .catch((error) => {
    if (error instanceof ZodError) {
      console.error(
        "Invalid admin seed environment variables. Check ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD."
      );
    } else {
      console.error(error instanceof Error ? error.message : "Failed to seed admin user.");
    }

    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
