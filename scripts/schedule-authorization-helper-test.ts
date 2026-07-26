import assert from "node:assert/strict";
import { ScheduleScope, UserRole } from "@prisma/client";
import { AppError } from "../src/lib/errors";
import type { PermissionKey } from "../src/lib/permissions";
import {
  requireScheduleAccess,
  type CurrentScheduleUser,
  type ScheduleAuthorizationDependencies
} from "../src/lib/schedule-authorization";
import { resolveScheduleAccessContext } from "../src/services/schedule-access.service";

function createUser(overrides: Partial<CurrentScheduleUser> = {}): CurrentScheduleUser {
  return {
    id: "user-1",
    name: "Usuario de teste",
    username: "TESTE",
    email: "teste@example.com",
    role: UserRole.LEADER,
    memberId: "member-1",
    accessRoleId: "access-role-1",
    scheduleScope: ScheduleScope.ALL,
    mustChangePassword: false,
    permissions: [
      {
        code: "schedule.view",
        name: "Visualizar escalas",
        label: "Visualizar escalas",
        module: "Escalas"
      }
    ],
    permissionCodes: ["schedule.view"],
    ...overrides
  };
}

function createDependencies(
  user: CurrentScheduleUser,
  ministryIds: string[] = []
): {
  dependencies: ScheduleAuthorizationDependencies;
  calls: {
    permission: number;
    anyPermission: number;
    resolver: number;
    ministryLinks: number;
  };
} {
  const calls = {
    permission: 0,
    anyPermission: 0,
    resolver: 0,
    ministryLinks: 0
  };

  return {
    calls,
    dependencies: {
      async requirePermission(permission: PermissionKey) {
        calls.permission += 1;

        if (!user.permissionCodes.includes(permission)) {
          throw new AppError("Voce nao tem permissao para esta acao.", 403, "FORBIDDEN");
        }

        return user;
      },
      async requireAnyPermission(permissions: PermissionKey[]) {
        calls.anyPermission += 1;

        if (!permissions.some((permission) => user.permissionCodes.includes(permission))) {
          throw new AppError("Voce nao tem permissao para esta acao.", 403, "FORBIDDEN");
        }

        return user;
      },
      async resolveScheduleAccessContext(currentUser: CurrentScheduleUser) {
        calls.resolver += 1;

        return resolveScheduleAccessContext(currentUser, {
          async listActiveMinistryIds() {
            calls.ministryLinks += 1;
            return ministryIds;
          }
        });
      }
    }
  };
}

async function captureError(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    return error;
  }

  assert.fail("A operacao deveria ter falhado.");
}

async function main() {
  const validSetup = createDependencies(createUser());
  const valid = await requireScheduleAccess("schedule.view", validSetup.dependencies);

  assert.equal(valid.user.id, "user-1", "1: retorna o usuario autorizado");
  assert.equal(valid.accessContext.scope, ScheduleScope.ALL, "1: retorna o contexto de escopo");
  assert.equal(validSetup.calls.permission, 1, "1: valida a permissao exatamente uma vez");
  assert.equal(validSetup.calls.resolver, 1, "1: resolve o contexto exatamente uma vez");

  const invalidSetup = createDependencies(createUser());
  const permissionError = await captureError(() =>
    requireScheduleAccess("schedule.delete", invalidSetup.dependencies)
  );

  assert(permissionError instanceof AppError, "2: preserva o erro padronizado de permissao");
  assert.equal(permissionError.statusCode, 403, "2: preserva o HTTP 403");
  assert.equal(permissionError.code, "FORBIDDEN", "2: preserva o codigo FORBIDDEN");
  assert.equal(invalidSetup.calls.resolver, 0, "2: nao resolve escopo sem permissao");

  const anyPermissionSetup = createDependencies(createUser());
  const anyPermission = await requireScheduleAccess(
    ["schedule.update", "schedule.view"],
    anyPermissionSetup.dependencies
  );

  assert.equal(anyPermission.user.id, "user-1", "3: aceita uma das permissoes informadas");
  assert.equal(
    anyPermissionSetup.calls.anyPermission,
    1,
    "3: valida o conjunto de permissoes exatamente uma vez"
  );
  assert.equal(
    anyPermissionSetup.calls.resolver,
    1,
    "3: resolve o contexto uma unica vez apos autorizar o conjunto"
  );

  const deniedAnyPermissionSetup = createDependencies(createUser());
  const deniedAnyPermission = await captureError(() =>
    requireScheduleAccess(
      ["schedule.update", "schedule.confirm"],
      deniedAnyPermissionSetup.dependencies
    )
  );

  assert(deniedAnyPermission instanceof AppError, "4: rejeita conjunto sem permissao");
  assert.equal(deniedAnyPermission.statusCode, 403, "4: conjunto negado retorna HTTP 403");
  assert.equal(
    deniedAnyPermissionSetup.calls.resolver,
    0,
    "4: conjunto negado nao resolve o escopo"
  );

  const withoutMemberSetup = createDependencies(
    createUser({
      memberId: null,
      scheduleScope: ScheduleScope.MEMBER_MINISTRIES
    })
  );
  const withoutMember = await requireScheduleAccess(
    "schedule.view",
    withoutMemberSetup.dependencies
  );

  assert.deepEqual(
    withoutMember.accessContext.authorizedMinistryIds,
    [],
    "5: usuario restrito sem memberId falha fechado com escopo vazio"
  );
  assert.equal(
    withoutMemberSetup.calls.ministryLinks,
    0,
    "5: usuario sem memberId nao consulta vinculos"
  );

  const allSetup = createDependencies(
    createUser({ scheduleScope: ScheduleScope.ALL }),
    ["ministry-1"]
  );
  const all = await requireScheduleAccess("schedule.view", allSetup.dependencies);

  assert.equal(all.accessContext.authorizedMinistryIds, null, "6: ALL nao limita ministerios");
  assert.equal(allSetup.calls.ministryLinks, 0, "6: ALL nao consulta vinculos ministeriais");

  const restrictedSetup = createDependencies(
    createUser({ scheduleScope: ScheduleScope.MEMBER_MINISTRIES }),
    ["ministry-2", "ministry-1", "ministry-2"]
  );
  const restricted = await requireScheduleAccess(
    "schedule.view",
    restrictedSetup.dependencies
  );

  assert.deepEqual(
    restricted.accessContext.authorizedMinistryIds,
    ["ministry-2", "ministry-1"],
    "7: MEMBER_MINISTRIES retorna somente os ministerios autorizados"
  );
  assert.equal(restrictedSetup.calls.ministryLinks, 1, "7: consulta vinculos uma unica vez");

  assert(Object.isFrozen(restricted), "8: retorno externo e imutavel");
  assert(Object.isFrozen(restricted.user), "8: usuario e imutavel");
  assert(Object.isFrozen(restricted.user.permissions), "8: lista de permissoes e imutavel");
  assert(Object.isFrozen(restricted.user.permissions[0]), "8: cada permissao e imutavel");
  assert(Object.isFrozen(restricted.user.permissionCodes), "8: codigos de permissao sao imutaveis");
  assert(Object.isFrozen(restricted.accessContext), "8: contexto e imutavel");
  assert(
    Object.isFrozen(restricted.accessContext.authorizedMinistryIds),
    "8: ministerios autorizados sao imutaveis"
  );

  const resolverError = new AppError("Falha ao resolver escopo.", 503, "SCOPE_UNAVAILABLE");
  const resolverDependencies: ScheduleAuthorizationDependencies = {
    async requirePermission() {
      return createUser();
    },
    async requireAnyPermission() {
      return createUser();
    },
    async resolveScheduleAccessContext() {
      throw resolverError;
    }
  };
  const propagatedError = await captureError(() =>
    requireScheduleAccess("schedule.view", resolverDependencies)
  );

  assert.equal(propagatedError, resolverError, "9: propaga a excecao original do resolver");

  console.log("Schedule authorization helper: 9 scenarios passed.");
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Schedule authorization helper tests failed.");
  process.exitCode = 1;
});
