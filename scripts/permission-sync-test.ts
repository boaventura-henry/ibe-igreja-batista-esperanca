import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { seedAdminSchema } from "@/validators/auth.validator";
import { availablePermissions } from "@/lib/permissions";
import { syncAdministratorPermissions, syncPermissions } from "../prisma/seed-permissions";

const prisma = new PrismaClient();
const instrumentCodes = availablePermissions.filter((permission) => permission.code.startsWith("instrument.")).map((permission) => permission.code);

async function main() {
  assert.equal(instrumentCodes.length, 8, "O catalogo deve conter as oito permissions de Instrumentos.");
  assert.throws(() => seedAdminSchema.parse({}), "O bootstrap administrativo deve continuar exigindo ADMIN_*.");

  const usersBefore = await prisma.user.count();
  const nonAdminBefore = await prisma.accessRole.findMany({
    where: { name: { not: "Administrador" } },
    select: { id: true, permissions: { select: { code: true }, orderBy: { code: "asc" } } }
  });

  await syncPermissions();
  const firstRun = await prisma.permission.count({ where: { code: { in: instrumentCodes } } });
  assert.equal(firstRun, instrumentCodes.length, "A sincronizacao deve criar todas as permissions de Instrumentos.");

  await syncPermissions();
  const secondRun = await prisma.permission.count({ where: { code: { in: instrumentCodes } } });
  assert.equal(secondRun, firstRun, "A sincronizacao repetida nao pode duplicar permissions.");

  assert.equal(await syncAdministratorPermissions(), true, "O perfil Administrador deve ser sincronizado quando existir.");
  const administrator = await prisma.accessRole.findUniqueOrThrow({
    where: { name: "Administrador" },
    select: { permissions: { select: { code: true } } }
  });
  for (const code of instrumentCodes) assert.ok(administrator.permissions.some((permission) => permission.code === code), `Administrador deve receber ${code}.`);

  const nonAdminAfter = await prisma.accessRole.findMany({
    where: { name: { not: "Administrador" } },
    select: { id: true, permissions: { select: { code: true }, orderBy: { code: "asc" } } }
  });
  assert.deepEqual(nonAdminAfter, nonAdminBefore, "A sincronizacao isolada nao pode alterar outros perfis.");
  assert.equal(await prisma.user.count(), usersBefore, "A sincronizacao isolada nao pode criar ou atualizar usuarios.");

  const seedSource = readFileSync("prisma/seed.ts", "utf8");
  assert.ok(seedSource.indexOf("seedAdminSchema.parse") < seedSource.indexOf("syncPermissions()"), "O seed completo deve validar ADMIN_* antes do bootstrap.");
  console.log("Permission synchronization tests passed: 8 scenarios.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
