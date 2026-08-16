import { availablePermissions } from "../src/lib/permissions";
import { prisma } from "../src/prisma/client";

export async function syncPermissions() {
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
}

export async function syncAdministratorPermissions() {
  const administrator = await prisma.accessRole.findUnique({
    where: { name: "Administrador" },
    select: { id: true }
  });

  if (!administrator) {
    return false;
  }

  await prisma.accessRole.update({
    where: { id: administrator.id },
    data: {
      permissions: {
        set: availablePermissions.map((permission) => ({ code: permission.code }))
      }
    }
  });

  return true;
}
