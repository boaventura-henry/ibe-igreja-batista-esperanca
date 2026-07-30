import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ScheduleScope, ScheduleStatus } from "@prisma/client";
import { AppError } from "../src/lib/errors";
import type { ScheduleAuthorization } from "../src/lib/schedule-authorization";
import {
  scheduleRepository,
  type ScheduleRecord
} from "../src/repositories/schedule.repository";
import { scheduleSongRepository } from "../src/repositories/schedule-song.repository";
import { scheduleService } from "../src/services/schedule.service";
import { scheduleSongService } from "../src/services/schedule-song.service";
import type { ScheduleAccessContext } from "../src/types/schedule-access.types";
import type {
  ScheduleMemberCreateInput,
  ScheduleMemberUpdateInput
} from "../src/validators/schedule.validator";
import type {
  ScheduleSongCopyInput,
  ScheduleSongCreateInput,
  ScheduleSongUpdateInput
} from "../src/validators/schedule-song.validator";

type RepositoryMethod = (...args: never[]) => unknown;

type StoredSchedule = {
  record: ScheduleRecord;
  deleted: boolean;
};

type DerivedOperation = {
  name: string;
  invoke(scheduleId: string, authorization: ScheduleAuthorization): Promise<unknown>;
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
    publishedAt: null,
    notificationVersion: 0,
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

function accessContext(
  scope: ScheduleScope,
  authorizedMinistryIds: readonly string[] | null,
  memberId: string | null = "member-a"
): ScheduleAccessContext {
  return {
    scope,
    memberId,
    authorizedMinistryIds
  };
}

function authorization(context: ScheduleAccessContext): ScheduleAuthorization {
  return {
    user: { id: "user-1" },
    accessContext: context
  } as ScheduleAuthorization;
}

async function captureError(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    return error;
  }

  assert.fail("A operacao deveria ter falhado.");
}

function assertScheduleNotFound(error: unknown, scenario: string) {
  assert(error instanceof AppError, `${scenario}: retorna AppError`);
  assert.equal(error.statusCode, 404, `${scenario}: retorna HTTP 404`);
  assert.equal(error.code, "SCHEDULE_NOT_FOUND", `${scenario}: usa o codigo padronizado`);
  assert.equal(error.message, "Escala nao encontrada.", `${scenario}: usa a mensagem padronizada`);
}

async function main() {
  const mutableScheduleRepository = scheduleRepository as unknown as Record<
    string,
    RepositoryMethod
  >;
  const mutableSongRepository = scheduleSongRepository as unknown as Record<
    string,
    RepositoryMethod
  >;
  const originals = new Map<string, { target: Record<string, RepositoryMethod>; value: RepositoryMethod }>();
  const store = new Map<string, StoredSchedule>([
    ["schedule-a", { record: scheduleRecord("schedule-a", "ministry-a"), deleted: false }],
    ["schedule-a-source", { record: scheduleRecord("schedule-a-source", "ministry-a"), deleted: false }],
    ["schedule-b", { record: scheduleRecord("schedule-b", "ministry-b"), deleted: false }],
    ["schedule-deleted", { record: scheduleRecord("schedule-deleted", "ministry-a"), deleted: true }]
  ]);
  let scenarios = 0;
  let childCalls = 0;

  const test = async (name: string, run: () => Promise<void> | void) => {
    await run();
    scenarios += 1;
    console.log(`PASS ${scenarios}: ${name}`);
  };

  const replace = (
    targetName: "schedule" | "song",
    method: string,
    implementation: RepositoryMethod
  ) => {
    const target =
      targetName === "schedule" ? mutableScheduleRepository : mutableSongRepository;
    originals.set(`${targetName}:${method}`, { target, value: target[method] });
    target[method] = implementation;
  };

  const canAccess = (
    stored: StoredSchedule | undefined,
    context: ScheduleAccessContext
  ) =>
    Boolean(
      stored &&
        !stored.deleted &&
        (context.scope === ScheduleScope.ALL ||
          context.authorizedMinistryIds?.includes(stored.record.ministry.id))
    );

  const restricted = authorization(
    accessContext(ScheduleScope.MEMBER_MINISTRIES, ["ministry-a"])
  );
  const all = authorization(accessContext(ScheduleScope.ALL, null));
  const withoutMember = authorization(
    accessContext(ScheduleScope.MEMBER_MINISTRIES, [], null)
  );
  const withoutMinistries = authorization(
    accessContext(ScheduleScope.MEMBER_MINISTRIES, [])
  );

  const memberCreateInput = {
    memberId: "member-1"
  } as ScheduleMemberCreateInput;
  const memberUpdateInput = {} as ScheduleMemberUpdateInput;
  const songCreateInput = { songId: "song-1" } as ScheduleSongCreateInput;
  const songUpdateInput = {} as ScheduleSongUpdateInput;

  const operations: DerivedOperation[] = [
    {
      name: "listar participantes",
      invoke: (id, auth) => scheduleService.listMembers(id, auth)
    },
    {
      name: "listar membros disponiveis",
      invoke: (id, auth) => scheduleService.listAvailableMembers(id, false, auth)
    },
    {
      name: "adicionar participante",
      invoke: (id, auth) => scheduleService.addMember(id, memberCreateInput, auth)
    },
    {
      name: "editar participante",
      invoke: (id, auth) =>
        scheduleService.updateMember(id, "schedule-member-1", memberUpdateInput, auth)
    },
    {
      name: "remover participante",
      invoke: (id, auth) =>
        scheduleService.removeMember(id, "schedule-member-1", auth)
    },
    {
      name: "listar repertorio",
      invoke: (id, auth) => scheduleSongService.list(id, auth)
    },
    {
      name: "adicionar musica",
      invoke: (id, auth) => scheduleSongService.add(id, songCreateInput, auth)
    },
    {
      name: "editar musica",
      invoke: (id, auth) =>
        scheduleSongService.update(id, "schedule-song-1", songUpdateInput, auth)
    },
    {
      name: "remover musica",
      invoke: (id, auth) =>
        scheduleSongService.remove(id, "schedule-song-1", auth)
    },
    {
      name: "mover musica",
      invoke: (id, auth) =>
        scheduleSongService.reorder(id, "schedule-song-1", "up", auth)
    },
    {
      name: "publicar",
      invoke: (id, auth) => scheduleService.publish(id, auth)
    },
    {
      name: "cancelar",
      invoke: (id, auth) => scheduleService.cancel(id, auth)
    },
    {
      name: "concluir",
      invoke: (id, auth) => scheduleService.complete(id, auth)
    }
  ];

  try {
    replace("schedule", "transaction", (callback: (database: unknown) => Promise<unknown>) =>
      callback({})
    );
    const scopedLookup = (id: string, context: ScheduleAccessContext) => {
      const stored = store.get(id);
      return Promise.resolve(canAccess(stored, context) ? stored?.record ?? null : null);
    };
    replace("schedule", "findByIdWithinScope", scopedLookup);
    replace("schedule", "lockByIdWithinScope", scopedLookup);
    replace(
      "schedule",
      "transitionStatusWithinScope",
      (
        id: string,
        _fromStatuses: ScheduleStatus[],
        status: ScheduleStatus,
        _userId: string,
        context: ScheduleAccessContext
      ) => {
        const stored = store.get(id);
        if (!canAccess(stored, context) || !stored) return Promise.resolve(null);
        stored.record = { ...stored.record, status, updatedAt: new Date() };
        return Promise.resolve(stored.record);
      }
    );
    replace(
      "schedule",
      "updateWithinScope",
      (
        id: string,
        data: { status?: ScheduleStatus },
        _userId: string,
        context: ScheduleAccessContext
      ) => {
        const stored = store.get(id);

        if (!canAccess(stored, context) || !stored) {
          return Promise.resolve(null);
        }

        stored.record = {
          ...stored.record,
          status: data.status ?? stored.record.status,
          updatedAt: new Date()
        };
        return Promise.resolve(stored.record);
      }
    );
    replace("schedule", "listAvailableMembers", () => {
      childCalls += 1;
      return Promise.resolve([]);
    });
    replace("schedule", "findMemberById", () => {
      childCalls += 1;
      return Promise.resolve({ id: "member-1", name: "Membro", status: "ACTIVE" });
    });
    replace("schedule", "findActiveScheduleMember", () => {
      childCalls += 1;
      return Promise.resolve(null);
    });
    replace("schedule", "findScheduleMemberTimeConflict", () => {
      childCalls += 1;
      return Promise.resolve(null);
    });
    replace("schedule", "findActiveMemberMinistry", () => {
      childCalls += 1;
      return Promise.resolve({ id: "member-ministry-1" });
    });
    replace("schedule", "findScheduleMemberById", () => {
      childCalls += 1;
      return Promise.resolve(null);
    });

    for (const method of [
      "list",
      "listScheduleMembers",
      "listSourceSchedules",
      "listForCopy"
    ]) {
      replace("song", method, () => {
        childCalls += 1;
        return Promise.resolve([]);
      });
    }
    replace("song", "copy", () => {
      childCalls += 1;
      return Promise.resolve(undefined);
    });

    await test("Handlers derivados usam exclusivamente requireScheduleAccess", () => {
      const routeFiles = [
        "src/app/api/schedules/[id]/available-members/route.ts",
        "src/app/api/schedules/[id]/members/route.ts",
        "src/app/api/schedules/[id]/members/[memberScheduleId]/route.ts",
        "src/app/api/schedules/[id]/publish/route.ts",
        "src/app/api/schedules/[id]/cancel/route.ts",
        "src/app/api/schedules/[id]/complete/route.ts",
        "src/app/api/schedules/[id]/songs/route.ts",
        "src/app/api/schedules/[id]/songs/[scheduleSongId]/route.ts",
        "src/app/api/schedules/[id]/songs/[scheduleSongId]/move/route.ts",
        "src/app/api/schedules/[id]/songs/copy/route.ts"
      ];

      for (const file of routeFiles) {
        const source = readFileSync(file, "utf8");
        assert(source.includes("requireScheduleAccess"), `${file} usa o helper central`);
        assert(!source.includes("@/lib/session"), `${file} nao usa helper paralelo`);
        assert(!source.includes("resolveScheduleAccessContext"), `${file} nao resolve o contexto`);
      }
    });

    await test("Services derivados nao possuem fallback administrativo sem escopo", () => {
      const service = readFileSync("src/services/schedule.service.ts", "utf8");
      const songService = readFileSync("src/services/schedule-song.service.ts", "utf8");
      const repository = readFileSync("src/repositories/schedule.repository.ts", "utf8");

      assert(!service.includes("authorization?: ScheduleAuthorization"));
      assert(!service.includes("scheduleRepository.findById("));
      assert(!service.includes("scheduleRepository.updateStatus("));
      assert(!songService.includes("scheduleRepository.findById("));
      assert(songService.includes("scheduleService.getById(scheduleId, authorization)"));
      assert(!/\n  findById\(id: string\)/.test(repository));
    });

    await test("Impressao valida a escala pelo mesmo contexto", () => {
      const source = readFileSync(
        "src/app/(app)/escalas/[id]/repertorio/imprimir/page.tsx",
        "utf8"
      );

      assert(source.includes('requireScheduleAccess("schedule.view")'));
      assert(source.includes("scheduleService.getById(id, authorization)"));
      assert(source.includes("scheduleSongService.list(id, authorization)"));
      assert(!source.includes("@/lib/session"));
    });

    for (const operation of operations) {
      for (const [state, id] of [
        ["protegida", "schedule-b"],
        ["inexistente", "schedule-missing"],
        ["removida", "schedule-deleted"]
      ] as const) {
        await test(`${operation.name}: escala ${state} retorna 404 uniforme`, async () => {
          const error = await captureError(() => operation.invoke(id, restricted));
          assertScheduleNotFound(error, `${operation.name} / ${state}`);
        });
      }
    }

    await test("Recurso protegido falha antes de consultar dados filhos", async () => {
      childCalls = 0;
      const error = await captureError(() =>
        scheduleSongService.list("schedule-b", restricted)
      );
      assertScheduleNotFound(error, "repertorio protegido");
      assert.equal(childCalls, 0);
    });

    await test("Participantes autorizados permanecem acessiveis", async () => {
      const members = await scheduleService.listMembers("schedule-a", restricted);
      assert.deepEqual(members, []);
    });

    await test("Repertorio autorizado permanece acessivel", async () => {
      const repertoire = await scheduleSongService.list("schedule-a", restricted);
      assert.deepEqual(repertoire.songs, []);
    });

    await test("Perfil ALL acessa recurso derivado de qualquer ministerio", async () => {
      const repertoire = await scheduleSongService.list("schedule-b", all);
      assert.deepEqual(repertoire.songs, []);
    });

    for (const operation of [
      ["publicar", (id: string) => scheduleService.publish(id, restricted)],
      ["cancelar", (id: string) => scheduleService.cancel(id, restricted)],
      ["concluir", (id: string) => scheduleService.complete(id, restricted)]
    ] as const) {
      await test(`${operation[0]} escala autorizada continua funcionando`, async () => {
        store.get("schedule-a")!.record.status = ScheduleStatus.DRAFT;
        store.get("schedule-a")!.record.publishedAt = null;
        const result = await operation[1]("schedule-a");
        assert.equal(result.id, "schedule-a");
      });
    }

    store.get("schedule-a")!.record.status = ScheduleStatus.DRAFT;

    const copyInput = (
      sourceScheduleId: string
    ): ScheduleSongCopyInput => ({
      sourceScheduleId,
      mode: "append"
    });

    await test("Copia valida e permite origem e destino autorizados", async () => {
      const result = await scheduleSongService.copy(
        "schedule-a",
        copyInput("schedule-a-source"),
        restricted
      );
      assert.deepEqual(result.songs, []);
    });

    for (const [name, destinationId, sourceId] of [
      ["destino protegido", "schedule-b", "schedule-a-source"],
      ["origem protegida", "schedule-a", "schedule-b"],
      ["destino inexistente", "schedule-missing", "schedule-a-source"],
      ["origem inexistente", "schedule-a", "schedule-missing"],
      ["destino removido", "schedule-deleted", "schedule-a-source"],
      ["origem removida", "schedule-a", "schedule-deleted"]
    ] as const) {
      await test(`Copia com ${name} retorna 404 uniforme`, async () => {
        const error = await captureError(() =>
          scheduleSongService.copy(
            destinationId,
            copyInput(sourceId),
            restricted
          )
        );
        assertScheduleNotFound(error, `copia / ${name}`);
      });
    }

    for (const [name, auth] of [
      ["usuario sem Member", withoutMember],
      ["usuario sem ministerios", withoutMinistries]
    ] as const) {
      await test(`${name} recebe 404 em recurso derivado`, async () => {
        const error = await captureError(() =>
          scheduleService.listMembers("schedule-a", auth)
        );
        assertScheduleNotFound(error, name);
      });
    }

    await test("Origem e destino da copia sao validados antes da operacao filha", async () => {
      const source = readFileSync("src/services/schedule-song.service.ts", "utf8");
      assert.match(
        source,
        /scheduleService\.getById\(scheduleId, authorization\)/
      );
      assert.match(
        source,
        /scheduleService\.getById\(\s*input\.sourceScheduleId,\s*authorization\s*\)/
      );
      assert(
        source.indexOf("scheduleService.getById(scheduleId, authorization)") <
          source.indexOf("scheduleSongRepository.copy(")
      );
      assert(
        source.indexOf("input.sourceScheduleId,\n      authorization") <
          source.indexOf("scheduleSongRepository.copy(")
      );
    });

    console.log(`Schedule derived access: ${scenarios} scenarios passed.`);
  } finally {
    for (const [key, { target, value }] of originals) {
      const method = key.split(":")[1];
      target[method] = value;
    }
  }
}

void main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Schedule derived access tests failed."
  );
  process.exitCode = 1;
});
