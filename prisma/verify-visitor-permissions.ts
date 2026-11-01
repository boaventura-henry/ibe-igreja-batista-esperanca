import { availablePermissions } from "../src/lib/permissions";
import { prisma } from "../src/prisma/client";

const visitorPermissionCodes = availablePermissions
  .filter((permission) => permission.code.startsWith("visitor."))
  .map((permission) => permission.code);

async function main() {
  const permissions = await prisma.permission.findMany({
    where: { code: { in: visitorPermissionCodes } },
    select: { code: true }
  });
  const foundCodes = new Set(permissions.map((permission) => permission.code));
  const missingPermissions = visitorPermissionCodes.filter((code) => !foundCodes.has(code));

  if (missingPermissions.length > 0) {
    throw new Error(`Missing Visitor permissions: ${missingPermissions.join(", ")}.`);
  }

  const administrator = await prisma.accessRole.findUnique({
    where: { name: "Administrador" },
    select: { permissions: { select: { code: true } } }
  });

  if (!administrator) {
    throw new Error("Administrator access role was not found.");
  }

  const grantedCodes = new Set(administrator.permissions.map((permission) => permission.code));
  const missingGrants = visitorPermissionCodes.filter((code) => !grantedCodes.has(code));

  if (missingGrants.length > 0) {
    throw new Error(`Administrator is missing Visitor grants: ${missingGrants.join(", ")}.`);
  }

  console.log("Visitor permissions and Administrator grants verified.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Visitor permission verification failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
