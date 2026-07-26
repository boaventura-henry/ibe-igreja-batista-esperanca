import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ScheduleScope } from "@prisma/client";
import { defaultDashboardLayout } from "../src/config/dashboard-widget-enums";
import { prisma } from "../src/prisma/client";
import {
  accessRoleRepository,
  type AccessRoleDetail,
  type AccessRoleListItem
} from "../src/repositories/access-role.repository";
import { accessRoleService } from "../src/services/access-role.service";
import {
  accessRoleCreateSchema,
  accessRoleUpdateSchema,
  type AccessRoleCreateInput,
  type AccessRoleUpdateInput
} from "../src/validators/access-role.validator";

function createRole(
  scheduleScope: ScheduleScope,
  overrides: Partial<AccessRoleDetail> = {}
): AccessRoleDetail {
  const now = new Date("2026-07-23T12:00:00.000Z");

  return {
    id: "access-role-1",
    name: "Perfil de teste",
    description: null,
    scheduleScope,
    permissions: [],
    dashboardWidgets: [],
    dashboardLayout: null,
    isSystem: false,
    isActive: true,
    updatedAt: now,
    _count: { users: 0 },
    createdAt: now,
    createdBy: null,
    updatedBy: null,
    ...overrides
  };
}

async function validateRepositoryPersistence(
  allInput: AccessRoleCreateInput,
  restrictedInput: AccessRoleUpdateInput
) {
  const accessRoleModel = prisma.accessRole as unknown as {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
    update(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
  const originalCreate = accessRoleModel.create;
  const originalUpdate = accessRoleModel.update;
  let createdScheduleScope: ScheduleScope | undefined;
  let updatedScheduleScope: ScheduleScope | undefined;

  try {
    accessRoleModel.create = async (args) => {
      createdScheduleScope = args.data.scheduleScope as ScheduleScope;
      return createRole(args.data.scheduleScope as ScheduleScope);
    };
    accessRoleModel.update = async (args) => {
      updatedScheduleScope = args.data.scheduleScope as ScheduleScope;
      return createRole(args.data.scheduleScope as ScheduleScope);
    };

    await accessRoleRepository.create(allInput, "user-1");
    await accessRoleRepository.update("access-role-1", restrictedInput, "user-1");
  } finally {
    accessRoleModel.create = originalCreate;
    accessRoleModel.update = originalUpdate;
  }

  assert.equal(
    createdScheduleScope,
    ScheduleScope.ALL,
    "6: repository envia ALL ao Prisma na criacao"
  );
  assert.equal(
    updatedScheduleScope,
    ScheduleScope.MEMBER_MINISTRIES,
    "6: repository envia MEMBER_MINISTRIES ao Prisma na alteracao"
  );
}

async function validateServiceSerialization(
  allInput: AccessRoleCreateInput,
  restrictedInput: AccessRoleUpdateInput
) {
  const originals = {
    findByName: accessRoleRepository.findByName,
    findById: accessRoleRepository.findById,
    create: accessRoleRepository.create,
    update: accessRoleRepository.update,
    list: accessRoleRepository.list,
    listPermissions: accessRoleRepository.listPermissions,
    listDashboardWidgets: accessRoleRepository.listDashboardWidgets
  };

  try {
    accessRoleRepository.findByName = (async () =>
      null) as unknown as typeof accessRoleRepository.findByName;
    accessRoleRepository.findById = (async () =>
      createRole(ScheduleScope.ALL)) as unknown as typeof accessRoleRepository.findById;
    accessRoleRepository.create = (async (data: AccessRoleCreateInput) =>
      createRole(data.scheduleScope)) as unknown as typeof accessRoleRepository.create;
    accessRoleRepository.update = (async (
      _id: string,
      data: AccessRoleUpdateInput
    ) =>
      createRole(
        data.scheduleScope ?? ScheduleScope.ALL
      )) as unknown as typeof accessRoleRepository.update;
    accessRoleRepository.list = (async () => [
      createRole(ScheduleScope.ALL) as AccessRoleListItem
    ]) as unknown as typeof accessRoleRepository.list;
    accessRoleRepository.listPermissions = (async () =>
      []) as unknown as typeof accessRoleRepository.listPermissions;
    accessRoleRepository.listDashboardWidgets = (async () =>
      []) as unknown as typeof accessRoleRepository.listDashboardWidgets;

    const created = await accessRoleService.create(allInput, "user-1");
    assert.equal(created.scheduleScope, ScheduleScope.ALL, "7: POST serializa ALL");

    const loaded = await accessRoleService.getById("access-role-1");
    assert.equal(loaded.scheduleScope, ScheduleScope.ALL, "7: GET por ID carrega ALL");

    const listed = await accessRoleService.list();
    assert.equal(
      listed.accessRoles[0]?.scheduleScope,
      ScheduleScope.ALL,
      "7: GET da lista devolve ALL"
    );

    const updated = await accessRoleService.update(
      "access-role-1",
      restrictedInput,
      "user-1"
    );
    assert.equal(
      updated.scheduleScope,
      ScheduleScope.MEMBER_MINISTRIES,
      "8: PUT serializa MEMBER_MINISTRIES"
    );

    const serialized = JSON.parse(JSON.stringify(updated)) as {
      scheduleScope?: string;
    };
    assert.equal(
      serialized.scheduleScope,
      ScheduleScope.MEMBER_MINISTRIES,
      "8: serializacao JSON preserva scheduleScope"
    );
  } finally {
    accessRoleRepository.findByName = originals.findByName;
    accessRoleRepository.findById = originals.findById;
    accessRoleRepository.create = originals.create;
    accessRoleRepository.update = originals.update;
    accessRoleRepository.list = originals.list;
    accessRoleRepository.listPermissions = originals.listPermissions;
    accessRoleRepository.listDashboardWidgets = originals.listDashboardWidgets;
  }
}

async function main() {
  const allInput = accessRoleCreateSchema.parse({
    name: "Perfil de teste ALL",
    scheduleScope: ScheduleScope.ALL,
    dashboardLayout: defaultDashboardLayout
  });
  const restrictedCreateInput = accessRoleCreateSchema.parse({
    name: "Perfil de teste restrito",
    scheduleScope: ScheduleScope.MEMBER_MINISTRIES
  });
  const defaultInput = accessRoleCreateSchema.parse({
    name: "Perfil de teste padrao"
  });

  assert.equal(allInput.scheduleScope, ScheduleScope.ALL, "1: aceita criacao com ALL");
  assert.equal(
    restrictedCreateInput.scheduleScope,
    ScheduleScope.MEMBER_MINISTRIES,
    "2: aceita criacao com MEMBER_MINISTRIES"
  );
  assert.equal(
    defaultInput.scheduleScope,
    ScheduleScope.MEMBER_MINISTRIES,
    "3: criacao aplica explicitamente o default restritivo"
  );

  const updateToAll = accessRoleUpdateSchema.parse({
    scheduleScope: ScheduleScope.ALL
  });
  const updateToRestricted = accessRoleUpdateSchema.parse({
    scheduleScope: ScheduleScope.MEMBER_MINISTRIES
  });

  assert.equal(updateToAll.scheduleScope, ScheduleScope.ALL, "4: aceita alteracao para ALL");
  assert.equal(
    updateToRestricted.scheduleScope,
    ScheduleScope.MEMBER_MINISTRIES,
    "4: aceita alteracao para MEMBER_MINISTRIES"
  );
  assert.equal(
    accessRoleCreateSchema.safeParse({
      name: "Perfil invalido",
      scheduleScope: "INVALID_SCOPE"
    }).success,
    false,
    "5: rejeita valor invalido na criacao"
  );
  assert.equal(
    accessRoleUpdateSchema.safeParse({ scheduleScope: "INVALID_SCOPE" }).success,
    false,
    "5: rejeita valor invalido na alteracao"
  );

  await validateRepositoryPersistence(allInput, updateToRestricted);
  await validateServiceSerialization(allInput, updateToRestricted);

  const migrationSql = readFileSync(
    "prisma/migrations/20260723120000_add_schedule_scope/migration.sql",
    "utf8"
  );
  assert.match(
    migrationSql,
    /ADD COLUMN "scheduleScope" "ScheduleScope" NOT NULL DEFAULT 'ALL'/,
    "9: migration preserva os perfis existentes como ALL"
  );
  assert.match(
    migrationSql,
    /ALTER COLUMN "scheduleScope" SET DEFAULT 'MEMBER_MINISTRIES'/,
    "9: migration define o default futuro como MEMBER_MINISTRIES"
  );

  const seedSource = readFileSync("prisma/seed.ts", "utf8");
  assert.equal(
    seedSource.match(/scheduleScope:\s*ScheduleScope\.ALL/g)?.length,
    4,
    "10: os quatro perfis oficiais declaram ALL explicitamente"
  );

  console.log("Access role schedule scope: 10 scenarios passed.");
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Access role schedule scope tests failed.");
  process.exitCode = 1;
});
