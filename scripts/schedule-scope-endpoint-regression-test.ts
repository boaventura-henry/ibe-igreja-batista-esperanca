import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ScheduleScope, ScheduleStatus } from "@prisma/client";
import { AppError } from "../src/lib/errors";
import type { ScheduleAuthorization } from "../src/lib/schedule-authorization";
import {
  scheduleRepository,
  type ScheduleRecord
} from "../src/repositories/schedule.repository";
import { scheduleService } from "../src/services/schedule.service";
import type { ScheduleAccessContext } from "../src/types/schedule-access.types";
import type {
  ScheduleListQueryInput,
  ScheduleUpdateInput
} from "../src/validators/schedule.validator";

type RepositoryMethod = (...args: never[]) => unknown;
type EndpointResult = {
  status: number;
  code: string;
  message: string;
  count?: number;
};

type StoredSchedule = {
  record: ScheduleRecord;
  deleted: boolean;
};

const filters: ScheduleListQueryInput = {
  page: 1,
  pageSize: 10,
  sortBy: "date",
  sortOrder: "asc"
};

function scheduleRecord(id: string, ministryId: string): ScheduleRecord {
  return {
    id,
    title: `Escala ${id}`,
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
    members: []
  };
}

function context(
  scope: ScheduleScope,
  ministryIds: readonly string[] | null,
  memberId: string | null = "member-a"
): ScheduleAccessContext {
  return {
    scope,
    memberId,
    authorizedMinistryIds: ministryIds
  };
}

function authorization(accessContext: ScheduleAccessContext): ScheduleAuthorization {
  return {
    user: { id: "user-restricted" },
    accessContext
  } as ScheduleAuthorization;
}

function canAccess(schedule: StoredSchedule | undefined, accessContext: ScheduleAccessContext) {
  if (!schedule || schedule.deleted) {
    return false;
  }

  return (
    accessContext.scope === ScheduleScope.ALL ||
    Boolean(accessContext.authorizedMinistryIds?.includes(schedule.record.ministry.id))
  );
}

function normalizedError(error: unknown): EndpointResult {
  if (error instanceof AppError) {
    return {
      status: error.statusCode,
      code: error.code,
      message: error.message
    };
  }

  return {
    status: 500,
    code: "INTERNAL_ERROR",
    message: "Unexpected application error"
  };
}

async function invokeList(auth: ScheduleAuthorization): Promise<EndpointResult> {
  try {
    const result = await scheduleService.list(filters, auth);

    return {
      status: 200,
      code: "OK",
      message: "OK",
      count: result.schedules.length
    };
  } catch (error) {
    return normalizedError(error);
  }
}

async function invokeById(
  method: "GET" | "PUT" | "DELETE",
  id: string,
  auth: ScheduleAuthorization
): Promise<EndpointResult> {
  try {
    if (method === "GET") {
      await scheduleService.getById(id, auth);
    } else if (method === "PUT") {
      await scheduleService.update(id, { title: `Atualizada ${id}` }, auth);
    } else {
      await scheduleService.remove(id, auth);
    }

    return { status: 200, code: "OK", message: "OK" };
  } catch (error) {
    return normalizedError(error);
  }
}

function assertConcealed(result: EndpointResult, scenario: string) {
  assert.deepEqual(
    result,
    {
      status: 404,
      code: "SCHEDULE_NOT_FOUND",
      message: "Escala nao encontrada."
    },
    scenario
  );
}

async function main() {
  const mutableRepository = scheduleRepository as unknown as Record<string, RepositoryMethod>;
  const originals = new Map<string, RepositoryMethod>();
  const store = new Map<string, StoredSchedule>();
  let scenarios = 0;

  const test = async (name: string, run: () => Promise<void> | void) => {
    await run();
    scenarios += 1;
    console.log(`PASS ${scenarios}: ${name}`);
  };

  const replace = (name: string, implementation: RepositoryMethod) => {
    originals.set(name, mutableRepository[name]);
    mutableRepository[name] = implementation;
  };

  const resetStore = () => {
    store.clear();
    store.set("schedule-a", {
      record: scheduleRecord("schedule-a", "ministry-a"),
      deleted: false
    });
    store.set("schedule-b", {
      record: scheduleRecord("schedule-b", "ministry-b"),
      deleted: false
    });
  };

  const restricted = authorization(
    context(ScheduleScope.MEMBER_MINISTRIES, ["ministry-a"])
  );
  const withoutMember = authorization(
    context(ScheduleScope.MEMBER_MINISTRIES, [], null)
  );
  const withoutMinistries = authorization(
    context(ScheduleScope.MEMBER_MINISTRIES, [])
  );
  const all = authorization(context(ScheduleScope.ALL, null));

  try {
    replace(
      "list",
      (_receivedFilters: ScheduleListQueryInput, accessContext: ScheduleAccessContext) => {
        const schedules = [...store.values()]
          .filter((schedule) => canAccess(schedule, accessContext))
          .map((schedule) => schedule.record);

        return Promise.resolve({ schedules, total: schedules.length });
      }
    );
    replace("listMinistries", () => Promise.resolve([]));
    replace("listMembers", () => Promise.resolve([]));
    replace("findByIdWithinScope", (id: string, accessContext: ScheduleAccessContext) => {
      const schedule = store.get(id);
      return Promise.resolve(canAccess(schedule, accessContext) ? schedule?.record ?? null : null);
    });
    replace("findMinistryById", (id: string) =>
      Promise.resolve({ id, name: `Ministerio ${id}`, isActive: true })
    );
    replace(
      "updateWithinScope",
      (
        id: string,
        data: ScheduleUpdateInput,
        _userId: string,
        accessContext: ScheduleAccessContext
      ) => {
        const schedule = store.get(id);

        if (!canAccess(schedule, accessContext) || !schedule) {
          return Promise.resolve(null);
        }

        schedule.record = {
          ...schedule.record,
          title: data.title ?? schedule.record.title,
          updatedAt: new Date()
        };

        return Promise.resolve(schedule.record);
      }
    );
    replace(
      "softDeleteWithinScope",
      (id: string, _userId: string, accessContext: ScheduleAccessContext) => {
        const schedule = store.get(id);

        if (!canAccess(schedule, accessContext) || !schedule) {
          return Promise.resolve(null);
        }

        schedule.deleted = true;
        return Promise.resolve({ id, deletedAt: new Date() });
      }
    );

    resetStore();

    await test("Routes CRUD usam somente requireScheduleAccess", () => {
      const collectionRoute = readFileSync("src/app/api/schedules/route.ts", "utf8");
      const itemRoute = readFileSync("src/app/api/schedules/[id]/route.ts", "utf8");
      const routes = `${collectionRoute}\n${itemRoute}`;

      assert.match(collectionRoute, /requireScheduleAccess\("schedule\.view"\)/);
      assert.match(collectionRoute, /requireScheduleAccess\("schedule\.create"\)/);
      assert.match(itemRoute, /requireScheduleAccess\("schedule\.view"\)/);
      assert.match(itemRoute, /requireScheduleAccess\("schedule\.update"\)/);
      assert.match(itemRoute, /requireScheduleAccess\("schedule\.delete"\)/);
      assert(!routes.includes("requirePermission"));
      assert(!routes.includes("requireCurrentUser"));
      assert(!routes.includes("resolveScheduleAccessContext"));
    });

    await test("Services por ID convergem em findByIdWithinScope", () => {
      const service = readFileSync("src/services/schedule.service.ts", "utf8");
      const repository = readFileSync("src/repositories/schedule.repository.ts", "utf8");

      assert.match(service, /getById[\s\S]*findByIdWithinScope/);
      assert.match(service, /update[\s\S]*findByIdWithinScope/);
      assert.match(service, /remove[\s\S]*this\.getById\(id, authorization\)/);
      assert.match(repository, /findByIdWithinScope[\s\S]*buildScheduleScopeWhere/);
    });

    await test("Listagem restrita retorna somente a Escala A", async () => {
      const result = await invokeList(restricted);
      assert.equal(result.status, 200);
      assert.equal(result.count, 1);
    });

    await test("GET autorizado retorna 200", async () => {
      assert.equal((await invokeById("GET", "schedule-a", restricted)).status, 200);
    });

    await test("PUT autorizado retorna 200", async () => {
      assert.equal((await invokeById("PUT", "schedule-a", restricted)).status, 200);
    });

    await test("GET protegido retorna 404", async () => {
      assertConcealed(
        await invokeById("GET", "schedule-b", restricted),
        "GET protegido deve ser indistinguivel de inexistente"
      );
    });

    await test("PUT protegido retorna 404", async () => {
      assertConcealed(
        await invokeById("PUT", "schedule-b", restricted),
        "PUT protegido deve ser indistinguivel de inexistente"
      );
    });

    await test("DELETE protegido retorna 404", async () => {
      assertConcealed(
        await invokeById("DELETE", "schedule-b", restricted),
        "DELETE protegido deve ser indistinguivel de inexistente"
      );
    });

    await test("DELETE autorizado retorna 200 e aplica soft delete", async () => {
      assert.equal((await invokeById("DELETE", "schedule-a", restricted)).status, 200);
      assert.equal(store.get("schedule-a")?.deleted, true);
    });

    for (const method of ["GET", "PUT", "DELETE"] as const) {
      await test(`${method} de escala removida retorna 404`, async () => {
        assertConcealed(
          await invokeById(method, "schedule-a", restricted),
          `${method} removido deve ser indistinguivel de inexistente`
        );
      });
    }

    await test("Usuario sem Member recebe listagem vazia", async () => {
      const result = await invokeList(withoutMember);
      assert.equal(result.status, 200);
      assert.equal(result.count, 0);
    });

    for (const method of ["GET", "PUT", "DELETE"] as const) {
      await test(`Usuario sem Member recebe 404 em ${method}`, async () => {
        assertConcealed(
          await invokeById(method, "schedule-b", withoutMember),
          `${method} sem Member deve falhar fechado`
        );
      });
    }

    await test("Usuario sem ministerios recebe listagem vazia", async () => {
      const result = await invokeList(withoutMinistries);
      assert.equal(result.status, 200);
      assert.equal(result.count, 0);
    });

    for (const method of ["GET", "PUT", "DELETE"] as const) {
      await test(`Usuario sem ministerios recebe 404 em ${method}`, async () => {
        assertConcealed(
          await invokeById(method, "schedule-b", withoutMinistries),
          `${method} sem ministerios deve falhar fechado`
        );
      });
    }

    resetStore();

    await test("Perfil ALL lista escalas de ambos os ministerios", async () => {
      const result = await invokeList(all);
      assert.equal(result.status, 200);
      assert.equal(result.count, 2);
    });

    await test("Perfil ALL acessa escala de qualquer ministerio", async () => {
      assert.equal((await invokeById("GET", "schedule-b", all)).status, 200);
    });

    await test("Perfil ALL edita escala de qualquer ministerio", async () => {
      assert.equal((await invokeById("PUT", "schedule-b", all)).status, 200);
    });

    await test("Perfil ALL exclui escala de qualquer ministerio", async () => {
      assert.equal((await invokeById("DELETE", "schedule-b", all)).status, 200);
    });

    resetStore();
    store.get("schedule-a")!.deleted = true;

    await test("Enumeracao nao distingue inexistente, protegido e removido", async () => {
      const ids = ["1", "2", "999", "999999", "schedule-b", "schedule-a"];
      const responses = await Promise.all(
        ids.map((id) => invokeById("GET", id, restricted))
      );

      for (const response of responses) {
        assertConcealed(response, "Toda enumeracao deve retornar o mesmo contrato 404");
      }

      assert.equal(new Set(responses.map((response) => JSON.stringify(response))).size, 1);
    });

    await test("Nenhum acesso protegido retorna 200, 403 ou 500", async () => {
      const responses = await Promise.all(
        (["GET", "PUT", "DELETE"] as const).map((method) =>
          invokeById(method, "schedule-b", restricted)
        )
      );

      assert.deepEqual(responses.map((response) => response.status), [404, 404, 404]);
    });

    console.log(`Schedule scope endpoint regression: ${scenarios} scenarios passed.`);
  } finally {
    for (const [name, implementation] of originals) {
      mutableRepository[name] = implementation;
    }
  }
}

void main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Schedule scope endpoint regression tests failed."
  );
  process.exitCode = 1;
});
