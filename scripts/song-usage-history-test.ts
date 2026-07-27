import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ScheduleScope, ScheduleStatus } from "@prisma/client";
import { AppError } from "../src/lib/errors";
import {
  requireScheduleAccess,
  type ScheduleAuthorization,
  type ScheduleAuthorizationDependencies
} from "../src/lib/schedule-authorization";
import {
  buildSongUsageHistoryWhere,
  songUsageHistoryRepository
} from "../src/repositories/song-usage-history.repository";
import { songUsageHistoryService } from "../src/services/song-usage-history.service";
import type { ScheduleAccessContext } from "../src/types/schedule-access.types";
import type { SongUsageHistoryQueryInput } from "../src/validators";
import { songUsageHistoryQuerySchema } from "../src/validators";

type RepositoryMethod = (...args: never[]) => unknown;

const songId = "cm00000000000000000000001";
const ministryId = "cm00000000000000000000002";
const eventId = "cm00000000000000000000003";
const otherMinistryId = "cm00000000000000000000004";

const defaultFilters: SongUsageHistoryQueryInput = {
  sortOrder: "desc",
  page: 1,
  pageSize: 10
};

function context(
  scope: ScheduleScope,
  authorizedMinistryIds: readonly string[] | null,
  memberId: string | null = "member-1"
): ScheduleAccessContext {
  return { scope, memberId, authorizedMinistryIds };
}

function authorization(accessContext: ScheduleAccessContext): ScheduleAuthorization {
  return {
    user: { id: "user-1" },
    accessContext
  } as ScheduleAuthorization;
}

function repositoryResult(overrides: Record<string, unknown> = {}) {
  return {
    usages: [],
    total: 0,
    firstUsedAt: null,
    lastUsedAt: null,
    ministries: [],
    events: [],
    ...overrides
  };
}

function scheduleConditions(
  where: ReturnType<typeof buildSongUsageHistoryWhere>
) {
  const schedule = where.schedule as { AND?: unknown[] };

  return schedule.AND ?? [];
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
  let scenarios = 0;
  const check = (condition: unknown, message: string) => {
    assert(condition, message);
    scenarios += 1;
  };

  const parsedDefaults = songUsageHistoryQuerySchema.parse({});
  check(
    parsedDefaults.page === 1 &&
      parsedDefaults.pageSize === 10 &&
      parsedDefaults.sortOrder === "desc",
    "1: filtros usam paginacao segura e ordem mais recente"
  );

  const invalidRange = songUsageHistoryQuerySchema.safeParse({
    dateFrom: "2026-07-20",
    dateTo: "2026-07-10"
  });
  check(!invalidRange.success, "2: periodo invertido e rejeitado");

  const excessivePage = songUsageHistoryQuerySchema.safeParse({ pageSize: 51 });
  check(!excessivePage.success, "3: pageSize acima de 50 e rejeitado");

  check(
    songUsageHistoryQuerySchema.parse({ sortOrder: "asc" }).sortOrder === "asc",
    "4: ordenacao mais antiga e aceita"
  );

  const allWhere = buildSongUsageHistoryWhere(
    songId,
    defaultFilters,
    context(ScheduleScope.ALL, null)
  );
  check(
    JSON.stringify(allWhere).includes('"deletedAt":null') &&
      !JSON.stringify(allWhere).includes("ministryId"),
    "5: ALL mantem apenas os filtros estruturais"
  );

  const restrictedWhere = buildSongUsageHistoryWhere(
    songId,
    defaultFilters,
    context(ScheduleScope.MEMBER_MINISTRIES, [ministryId])
  );
  check(
    JSON.stringify(restrictedWhere).includes(
      `"ministryId":{"in":["${ministryId}"]}`
    ),
    "6: MEMBER_MINISTRIES aplica os ministerios autorizados no Prisma"
  );

  const noMemberWhere = buildSongUsageHistoryWhere(
    songId,
    defaultFilters,
    context(ScheduleScope.MEMBER_MINISTRIES, [], null)
  );
  check(
    JSON.stringify(noMemberWhere).includes('"ministryId":{"in":[]}'),
    "7: usuario restrito sem memberId recebe escopo vazio"
  );

  const noMinistryWhere = buildSongUsageHistoryWhere(
    songId,
    defaultFilters,
    context(ScheduleScope.MEMBER_MINISTRIES, [])
  );
  check(
    JSON.stringify(noMinistryWhere).includes('"ministryId":{"in":[]}'),
    "8: usuario restrito sem ministerios recebe escopo vazio"
  );

  const ministryWhere = buildSongUsageHistoryWhere(
    songId,
    { ...defaultFilters, ministryId },
    context(ScheduleScope.ALL, null)
  );
  check(
    JSON.stringify(ministryWhere).includes(`"ministryId":"${ministryId}"`),
    "9: filtro por Ministerio ocorre no Prisma"
  );

  const eventWhere = buildSongUsageHistoryWhere(
    songId,
    { ...defaultFilters, eventId },
    context(ScheduleScope.ALL, null)
  );
  check(
    JSON.stringify(eventWhere).includes(`"eventId":"${eventId}"`),
    "10: filtro por Evento ocorre no Prisma"
  );

  const statusWhere = buildSongUsageHistoryWhere(
    songId,
    { ...defaultFilters, status: ScheduleStatus.CANCELED },
    context(ScheduleScope.ALL, null)
  );
  check(
    JSON.stringify(statusWhere).includes('"status":"CANCELED"'),
    "11: filtro por status ocorre no Prisma"
  );

  const searchWhere = buildSongUsageHistoryWhere(
    songId,
    { ...defaultFilters, search: "Culto" },
    context(ScheduleScope.ALL, null)
  );
  check(
    JSON.stringify(searchWhere).includes('"contains":"Culto"'),
    "12: filtro pelo titulo da escala ocorre no Prisma"
  );

  const periodWhere = buildSongUsageHistoryWhere(
    songId,
    {
      ...defaultFilters,
      dateFrom: "2026-07-01",
      dateTo: "2026-07-31"
    },
    context(ScheduleScope.ALL, null)
  );
  check(
    JSON.stringify(periodWhere).includes('"gte"') &&
      JSON.stringify(periodWhere).includes('"lte"'),
    "13: filtro por periodo ocorre no Prisma"
  );

  const defaultWhere = buildSongUsageHistoryWhere(
    songId,
    defaultFilters,
    context(ScheduleScope.ALL, null)
  );
  check(
    !JSON.stringify(defaultWhere).includes('"status"'),
    "14: rascunhos, publicadas, concluidas e canceladas permanecem no historico"
  );

  check(
    JSON.stringify(defaultWhere).includes(
      `"songId":"${songId}","deletedAt":null`
    ),
    "15: vinculo removido do repertorio nao entra no historico"
  );

  check(
    JSON.stringify(defaultWhere).includes(
      '"schedule":{"deletedAt":null'
    ),
    "16: escala removida por soft delete nao entra no historico"
  );

  const mutableRepository = songUsageHistoryRepository as unknown as Record<
    string,
    RepositoryMethod
  >;
  const originals = new Map<string, RepositoryMethod>();
  const replace = (name: string, implementation: RepositoryMethod) => {
    if (!originals.has(name)) {
      originals.set(name, mutableRepository[name]);
    }
    mutableRepository[name] = implementation;
  };
  const allAuthorization = authorization(context(ScheduleScope.ALL, null));

  try {
    replace("findSong", () => Promise.resolve(null));
    const missingSong = await captureError(() =>
      songUsageHistoryService.getHistory(
        songId,
        defaultFilters,
        allAuthorization
      )
    );
    check(
      missingSong instanceof AppError &&
        missingSong.statusCode === 404 &&
        missingSong.code === "SONG_NOT_FOUND",
      "17: musica inexistente retorna 404"
    );

    replace("findSong", () =>
      Promise.resolve({ id: songId, title: "Musica", artist: null })
    );
    replace("list", () => Promise.resolve(repositoryResult()));
    const emptyHistory = await songUsageHistoryService.getHistory(
      songId,
      defaultFilters,
      allAuthorization
    );
    check(
      emptyHistory.usages.length === 0 &&
        emptyHistory.summary.usageCount === 0 &&
        emptyHistory.pagination.totalPages === 1,
      "18: musica sem utilizacao retorna estado vazio paginado"
    );

    replace("list", () =>
      Promise.resolve(
        repositoryResult({
          usages: [
            {
              id: "usage-1",
              position: 2,
              referenceKey: "C",
              performanceKey: "D",
              resourceUrlOverride: "https://example.com/override",
              notes: "Observacao",
              leadMember: {
                id: "member-1",
                name: "Carlos da Silva",
                nickname: "Caca"
              },
              song: { resourceUrl: "https://example.com/default" },
              schedule: {
                id: "schedule-1",
                title: "Culto de domingo",
                date: new Date("2026-07-20T00:00:00.000Z"),
                status: ScheduleStatus.PUBLISHED,
                ministry: { id: ministryId, name: "Louvor" },
                event: { id: eventId, title: "Conferencia" }
              }
            }
          ],
          total: 1,
          firstUsedAt: new Date("2026-07-20T00:00:00.000Z"),
          lastUsedAt: new Date("2026-07-20T00:00:00.000Z")
        })
      )
    );
    const oneUsage = await songUsageHistoryService.getHistory(
      songId,
      defaultFilters,
      allAuthorization
    );
    check(
      oneUsage.usages[0]?.leadMember?.displayName === "Caca" &&
        oneUsage.usages[0]?.materialUrl === "https://example.com/override" &&
        oneUsage.usages[0]?.event?.title === "Conferencia",
      "19: uma utilizacao serializa ministro, material e Evento"
    );

    replace("list", () =>
      Promise.resolve(
        repositoryResult({
          usages: [],
          total: 25,
          firstUsedAt: new Date("2026-01-01T00:00:00.000Z"),
          lastUsedAt: new Date("2026-07-20T00:00:00.000Z")
        })
      )
    );
    const paged = await songUsageHistoryService.getHistory(
      songId,
      { ...defaultFilters, page: 2 },
      allAuthorization
    );
    check(
      paged.pagination.page === 2 && paged.pagination.totalPages === 3,
      "20: multiplas utilizacoes retornam paginacao correta"
    );

    replace("listSummaries", () =>
      Promise.resolve([
        {
          songId,
          usageCount: 3,
          firstUsedAt: new Date("2026-01-01T00:00:00.000Z"),
          lastUsedAt: new Date("2026-07-20T00:00:00.000Z"),
          lastPerformanceKey: "G"
        }
      ])
    );
    const summaries = await songUsageHistoryService.summarize(
      [songId],
      allAuthorization
    );
    check(
      summaries.get(songId)?.usageCount === 3 &&
        summaries.get(songId)?.lastPerformanceKey === "G",
      "21: resumo agrega quantidade, datas e ultimo tom"
    );
  } finally {
    for (const [name, implementation] of originals) {
      mutableRepository[name] = implementation;
    }
  }

  const routeSource = readFileSync(
    "src/app/api/songs/[id]/usage-history/route.ts",
    "utf8"
  );
  check(
    routeSource.includes('requireScheduleAccess("song.view")') &&
      !routeSource.includes("requirePermission("),
    "22: API exige permissao funcional pelo helper oficial"
  );

  const permissionError = await captureError(() =>
    requireScheduleAccess(
      "song.view",
      {
        requirePermission: async () => {
          throw new AppError("Acesso negado.", 403, "FORBIDDEN");
        },
        requireAnyPermission: async () => {
          throw new AppError("Acesso negado.", 403, "FORBIDDEN");
        },
        resolveScheduleAccessContext: async () =>
          context(ScheduleScope.ALL, null)
      } as ScheduleAuthorizationDependencies
    )
  );
  check(
    permissionError instanceof AppError && permissionError.statusCode === 403,
    "23: API sem permissao funcional permanece bloqueada"
  );

  check(
    routeSource.includes('"Cache-Control": "no-store, max-age=0"'),
    "24: API administrativa nao permite cache do historico"
  );

  const repositorySource = readFileSync(
    "src/repositories/song-usage-history.repository.ts",
    "utf8"
  );
  check(
    repositorySource.includes("skip,") &&
      repositorySource.includes("take: filters.pageSize"),
    "25: paginacao e aplicada no banco"
  );

  check(
    repositorySource.includes("{ schedule: { date: filters.sortOrder } }"),
    "26: ordenacao recente ou antiga e delegada ao Prisma"
  );

  check(
    !repositorySource.includes(".filter(") &&
      repositorySource.includes("buildSongUsageHistoryWhere"),
    "27: filtros do historico nao sao executados em memoria"
  );

  check(
    repositorySource.includes("COUNT(*)::integer") &&
      repositorySource.includes('GROUP BY usage."songId"'),
    "28: resumo usa agregacao no PostgreSQL e evita N+1"
  );

  const schemaSource = readFileSync("prisma/schema.prisma", "utf8");
  check(
    schemaSource.includes("eventId       String?") &&
      schemaSource.includes("@@index([songId, deletedAt])"),
    "29: schema suporta Evento e possui indice para o historico"
  );

  const migrationSource = readFileSync(
    "prisma/migrations/20260726190000_add_schedule_event_relation/migration.sql",
    "utf8"
  );
  check(
    migrationSource.includes('ADD COLUMN "eventId" TEXT') &&
      migrationSource.includes("ON DELETE SET NULL"),
    "30: migration opcional preserva Escalas existentes"
  );

  const managerSource = readFileSync(
    "src/components/songs/SongUsageHistoryModal.tsx",
    "utf8"
  );
  check(
    managerSource.includes("Carregando historico") &&
      managerSource.includes("Nenhuma utilizacao encontrada") &&
      managerSource.includes("Nao foi possivel carregar"),
    "31: interface cobre carregamento, vazio e erro"
  );

  const songsRouteSource = readFileSync("src/app/api/songs/route.ts", "utf8");
  check(
    songsRouteSource.includes('requireScheduleAccess("song.view")'),
    "32: resumo do catalogo utiliza o mesmo ScheduleScope"
  );

  const allowedMinistryWhere = buildSongUsageHistoryWhere(
    songId,
    { ...defaultFilters, ministryId },
    context(ScheduleScope.MEMBER_MINISTRIES, [ministryId])
  );
  const allowedConditions = scheduleConditions(allowedMinistryWhere);
  check(
    allowedConditions.length === 2 &&
      JSON.stringify(allowedConditions[0]).includes(
        `"ministryId":{"in":["${ministryId}"]}`
      ) &&
      JSON.stringify(allowedConditions[1]).includes(
        `"ministryId":"${ministryId}"`
      ),
    "33: MEMBER_MINISTRIES combina escopo e Ministerio permitido por intersecao"
  );

  const forbiddenMinistryWhere = buildSongUsageHistoryWhere(
    songId,
    { ...defaultFilters, ministryId: otherMinistryId },
    context(ScheduleScope.MEMBER_MINISTRIES, [ministryId])
  );
  const forbiddenConditions = scheduleConditions(forbiddenMinistryWhere);
  check(
    forbiddenConditions.length === 2 &&
      JSON.stringify(forbiddenConditions[0]).includes(
        `"ministryId":{"in":["${ministryId}"]}`
      ) &&
      JSON.stringify(forbiddenConditions[1]).includes(
        `"ministryId":"${otherMinistryId}"`
      ),
    "34: MEMBER_MINISTRIES mantem o escopo ao solicitar Ministerio nao permitido"
  );

  const allMinistryWhere = buildSongUsageHistoryWhere(
    songId,
    { ...defaultFilters, ministryId: otherMinistryId },
    context(ScheduleScope.ALL, null)
  );
  const allConditions = scheduleConditions(allMinistryWhere);
  check(
    allConditions.length === 2 &&
      JSON.stringify(allConditions[0]) === "{}" &&
      JSON.stringify(allConditions[1]).includes(
        `"ministryId":"${otherMinistryId}"`
      ),
    "35: ALL permite filtrar qualquer Ministerio sem restricao adicional"
  );

  const noMinistryFilterWhere = buildSongUsageHistoryWhere(
    songId,
    defaultFilters,
    context(ScheduleScope.MEMBER_MINISTRIES, [ministryId])
  );
  const noFilterConditions = scheduleConditions(noMinistryFilterWhere);
  check(
    noFilterConditions.length === 1 &&
      JSON.stringify(noFilterConditions[0]).includes(
        `"ministryId":{"in":["${ministryId}"]}`
      ),
    "36: ausencia de filtro preserva integralmente o ScheduleScope"
  );

  const combinedFilterWhere = buildSongUsageHistoryWhere(
    songId,
    {
      ...defaultFilters,
      ministryId,
      eventId,
      status: ScheduleStatus.PUBLISHED,
      search: "Culto"
    },
    context(ScheduleScope.MEMBER_MINISTRIES, [ministryId])
  );
  const combinedJson = JSON.stringify(combinedFilterWhere);
  check(
    scheduleConditions(combinedFilterWhere).length === 2 &&
      combinedJson.includes(`"eventId":"${eventId}"`) &&
      combinedJson.includes('"status":"PUBLISHED"') &&
      combinedJson.includes('"contains":"Culto"'),
    "37: filtros combinados preservam a intersecao de autorizacao"
  );

  console.log(`Song usage history: ${scenarios} scenarios passed.`);
}

void main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Song usage history tests failed."
  );
  process.exitCode = 1;
});
