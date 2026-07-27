import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ScheduleScope, ScheduleStatus } from "@prisma/client";
import { AppError } from "../src/lib/errors";
import type { ScheduleAuthorization } from "../src/lib/schedule-authorization";
import {
  buildScheduleWhere,
  scheduleRepository,
  type ScheduleRecord
} from "../src/repositories/schedule.repository";
import { scheduleService } from "../src/services/schedule.service";
import type { ScheduleAccessContext } from "../src/types/schedule-access.types";
import type {
  ScheduleCreateInput,
  ScheduleListQueryInput,
  ScheduleUpdateInput
} from "../src/validators/schedule.validator";

type RepositoryMethod = (...args: never[]) => unknown;

const filters: ScheduleListQueryInput = {
  page: 1,
  pageSize: 10,
  sortBy: "date",
  sortOrder: "asc"
};

function accessContext(
  scope: ScheduleScope,
  authorizedMinistryIds: readonly string[] | null,
  memberId: string | null = "member-1"
): ScheduleAccessContext {
  return {
    scope,
    memberId,
    authorizedMinistryIds
  };
}

function authorization(context: ScheduleAccessContext): ScheduleAuthorization {
  return {
    user: {
      id: "user-1"
    },
    accessContext: context
  } as ScheduleAuthorization;
}

function scheduleRecord(ministryId = "ministry-1"): ScheduleRecord {
  return {
    id: "schedule-1",
    title: "Escala de teste",
    description: null,
    date: new Date("2026-07-26T00:00:00.000Z"),
    startTime: "09:00",
    endTime: "10:00",
    location: "Templo",
    status: ScheduleStatus.DRAFT,
    observations: null,
    createdAt: new Date("2026-07-23T00:00:00.000Z"),
    updatedAt: new Date("2026-07-23T00:00:00.000Z"),
    ministry: {
      id: ministryId,
      name: `Ministerio ${ministryId}`,
      color: "#000000",
      isActive: true
    },
    event: null,
    members: []
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

function assertNotFound(error: unknown, scenario: string) {
  assert(error instanceof AppError, `${scenario}: retorna AppError`);
  assert.equal(error.statusCode, 404, `${scenario}: retorna HTTP 404`);
  assert.equal(error.code, "SCHEDULE_NOT_FOUND", `${scenario}: nao revela a existencia da escala`);
}

async function main() {
  const mutableRepository = scheduleRepository as unknown as Record<string, RepositoryMethod>;
  const originals = new Map<string, RepositoryMethod>();
  const replace = (name: string, implementation: RepositoryMethod) => {
    originals.set(name, mutableRepository[name]);
    mutableRepository[name] = implementation;
  };

  const allContext = accessContext(ScheduleScope.ALL, null);
  const restrictedContext = accessContext(ScheduleScope.MEMBER_MINISTRIES, ["ministry-1"]);
  const emptyContext = accessContext(ScheduleScope.MEMBER_MINISTRIES, [], null);

  try {
    const allWhere = buildScheduleWhere(filters, allContext);
    assert.deepEqual(allWhere, { AND: [{ deletedAt: null }, {}] }, "1: ALL nao restringe a listagem");

    const restrictedWhere = buildScheduleWhere(filters, restrictedContext);
    assert.deepEqual(
      restrictedWhere,
      { AND: [{ deletedAt: null }, { ministryId: { in: ["ministry-1"] } }] },
      "2: MEMBER_MINISTRIES filtra no where do Prisma"
    );

    const emptyWhere = buildScheduleWhere(filters, emptyContext);
    assert.deepEqual(
      emptyWhere,
      { AND: [{ deletedAt: null }, { ministryId: { in: [] } }] },
      "3: usuario sem Member recebe listagem vazia no banco"
    );

    let listContext: ScheduleAccessContext | null = null;
    let ministryListContext: ScheduleAccessContext | null = null;
    replace("list", (receivedFilters: ScheduleListQueryInput, context: ScheduleAccessContext) => {
      assert.equal(receivedFilters, filters, "4: filtros existentes sao preservados");
      listContext = context;
      return Promise.resolve({ schedules: [scheduleRecord()], total: 1 });
    });
    replace("listMinistries", (context: ScheduleAccessContext) => {
      ministryListContext = context;
      return Promise.resolve([]);
    });
    replace("listMembers", () => Promise.resolve([]));
    replace("listEvents", () => Promise.resolve([]));

    const allList = await scheduleService.list(filters, authorization(allContext));
    assert.equal(allList.schedules.length, 1, "4: ALL continua listando escalas");
    assert.equal(listContext, allContext, "4: o contexto ALL chega ao repository");

    await scheduleService.list(filters, authorization(restrictedContext));
    assert.equal(listContext, restrictedContext, "5: o contexto restrito chega ao repository");
    assert.equal(
      ministryListContext,
      restrictedContext,
      "5: opcoes de ministerio tambem respeitam o escopo"
    );

    await scheduleService.list(filters, authorization(emptyContext));
    assert.equal(listContext, emptyContext, "6: usuario sem Member usa contexto vazio");

    replace("findByIdWithinScope", (id: string, context: ScheduleAccessContext) =>
      Promise.resolve(
        id === "schedule-1" && context.authorizedMinistryIds?.includes("ministry-1")
          ? scheduleRecord()
          : context.scope === ScheduleScope.ALL && id === "schedule-1"
            ? scheduleRecord()
            : null
      )
    );

    const authorized = await scheduleService.getById(
      "schedule-1",
      authorization(restrictedContext)
    );
    assert.equal(authorized.id, "schedule-1", "7: consulta por ID autorizada funciona");

    const outsideGet = await captureError(() =>
      scheduleService.getById(
        "schedule-outside",
        authorization(restrictedContext)
      )
    );
    assertNotFound(outsideGet, "8: consulta fora do escopo");

    let createCalls = 0;
    replace("findMinistryById", (id: string) =>
      Promise.resolve({ id, name: "Ministerio", isActive: true })
    );
    replace("create", (data: ScheduleCreateInput, userId: string) => {
      createCalls += 1;
      assert.equal(userId, "user-1");
      return Promise.resolve(scheduleRecord(data.ministryId));
    });

    const createInput: ScheduleCreateInput = {
      title: "Escala criada",
      ministryId: "ministry-1",
      date: "2026-07-27",
      status: ScheduleStatus.DRAFT
    };

    await scheduleService.create(createInput, authorization(allContext));
    assert.equal(createCalls, 1, "9: ALL pode criar em qualquer ministerio ativo");

    await scheduleService.create(createInput, authorization(restrictedContext));
    assert.equal(createCalls, 2, "10: restrito pode criar em ministerio autorizado");

    const forbiddenCreate = await captureError(() =>
      scheduleService.create(
        { ...createInput, ministryId: "ministry-2" },
        authorization(restrictedContext)
      )
    );
    assert(forbiddenCreate instanceof AppError, "11: criacao proibida retorna AppError");
    assert.equal(forbiddenCreate.statusCode, 403, "11: criacao fora do escopo retorna 403");
    assert.equal(createCalls, 2, "11: criacao proibida nao grava no banco");

    let updatedMinistryId: string | undefined;
    replace(
      "updateWithinScope",
      (
        _id: string,
        data: ScheduleUpdateInput,
        userId: string,
        context: ScheduleAccessContext
      ) => {
        assert.equal(userId, "user-1");
        assert.equal(context, restrictedContext);
        updatedMinistryId = data.ministryId;
        return Promise.resolve(scheduleRecord(data.ministryId ?? "ministry-1"));
      }
    );

    await scheduleService.update(
      "schedule-1",
      { title: "Escala atualizada" },
      authorization(restrictedContext)
    );
    assert.equal(updatedMinistryId, undefined, "12: edicao autorizada preserva o ministerio");

    const destinationContext = accessContext(
      ScheduleScope.MEMBER_MINISTRIES,
      ["ministry-1", "ministry-2"]
    );
    replace("findByIdWithinScope", (id: string) =>
      Promise.resolve(id === "schedule-1" ? scheduleRecord() : null)
    );
    replace(
      "updateWithinScope",
      (_id: string, data: ScheduleUpdateInput) => {
        updatedMinistryId = data.ministryId;
        return Promise.resolve(scheduleRecord(data.ministryId ?? "ministry-1"));
      }
    );

    await scheduleService.update(
      "schedule-1",
      { ministryId: "ministry-2" },
      authorization(destinationContext)
    );
    assert.equal(updatedMinistryId, "ministry-2", "13: troca para ministerio autorizado funciona");

    const forbiddenUpdate = await captureError(() =>
      scheduleService.update(
        "schedule-1",
        { ministryId: "ministry-2" },
        authorization(restrictedContext)
      )
    );
    assert(forbiddenUpdate instanceof AppError, "14: troca proibida retorna AppError");
    assert.equal(forbiddenUpdate.statusCode, 403, "14: troca para ministerio sem acesso retorna 403");

    replace("findByIdWithinScope", () => Promise.resolve(null));
    const outsideUpdate = await captureError(() =>
      scheduleService.update(
        "schedule-outside",
        { title: "Tentativa" },
        authorization(restrictedContext)
      )
    );
    assertNotFound(outsideUpdate, "15: edicao fora do escopo");

    let deleteCalls = 0;
    replace("findByIdWithinScope", () => Promise.resolve(scheduleRecord()));
    replace(
      "softDeleteWithinScope",
      (_id: string, userId: string, context: ScheduleAccessContext) => {
        deleteCalls += 1;
        assert.equal(userId, "user-1");
        assert.equal(context, restrictedContext);
        return Promise.resolve({ id: "schedule-1", deletedAt: new Date() });
      }
    );

    await scheduleService.remove("schedule-1", authorization(restrictedContext));
    assert.equal(deleteCalls, 1, "16: exclusao autorizada usa soft delete com escopo");

    replace("findByIdWithinScope", () => Promise.resolve(null));
    const outsideDelete = await captureError(() =>
      scheduleService.remove("schedule-outside", authorization(restrictedContext))
    );
    assertNotFound(outsideDelete, "17: exclusao fora do escopo");
    assert.equal(deleteCalls, 1, "17: exclusao fora do escopo nao grava");

    const collectionRoute = readFileSync("src/app/api/schedules/route.ts", "utf8");
    const itemRoute = readFileSync("src/app/api/schedules/[id]/route.ts", "utf8");
    const affectedRoutes = `${collectionRoute}\n${itemRoute}`;

    assert.match(affectedRoutes, /requireScheduleAccess/, "18: CRUD usa o helper centralizado");
    assert(!affectedRoutes.includes("requirePermission"), "18: CRUD nao chama requirePermission diretamente");
    assert(!affectedRoutes.includes("requireCurrentUser"), "18: CRUD nao chama requireCurrentUser diretamente");
    assert(
      !affectedRoutes.includes("resolveScheduleAccessContext"),
      "18: CRUD nao resolve contexto diretamente"
    );

    const repositorySource = readFileSync("src/repositories/schedule.repository.ts", "utf8");
    assert.match(
      repositorySource,
      /const where = buildScheduleWhere\(filters, accessContext\)/,
      "19: listagem aplica o escopo antes do findMany e count"
    );
    assert.match(
      repositorySource,
      /findByIdWithinScope[\s\S]*buildScheduleScopeWhere\(accessContext\)/,
      "19: consultas por ID compoem o escopo no Prisma"
    );

    console.log("Schedule scope CRUD: 19 scenarios passed.");
  } finally {
    for (const [name, implementation] of originals) {
      mutableRepository[name] = implementation;
    }
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Schedule scope CRUD tests failed.");
  process.exitCode = 1;
});
