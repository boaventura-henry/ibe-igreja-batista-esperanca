import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ScheduleScope, ScheduleStatus } from "@prisma/client";
import { buildUpcomingSchedulesWhere } from "../src/repositories/dashboard.repository";
import { buildMemberScheduleHistoryWhere } from "../src/repositories/member.repository";
import { buildScheduleReportWhere } from "../src/repositories/report.repository";
import type { ScheduleAccessContext } from "../src/types/schedule-access.types";
import type { ScheduleReportInput } from "../src/validators/report.validator";

function context(
  scope: ScheduleScope,
  authorizedMinistryIds: readonly string[] | null,
  memberId: string | null = "member-a"
): ScheduleAccessContext {
  return { scope, memberId, authorizedMinistryIds };
}

const reportInput = {
  filters: {},
  page: 1,
  pageSize: 20,
  sortBy: "date",
  sortOrder: "asc",
  exportFormat: "view"
} as ScheduleReportInput;

const all = context(ScheduleScope.ALL, null);
const restricted = context(ScheduleScope.MEMBER_MINISTRIES, [
  "ministry-a",
  "ministry-b"
]);
const withoutMember = context(ScheduleScope.MEMBER_MINISTRIES, [], null);
const withoutMinistries = context(ScheduleScope.MEMBER_MINISTRIES, []);

function andClauses(where: { AND?: unknown }) {
  assert(Array.isArray(where.AND), "O filtro deve combinar regras com AND.");
  return where.AND as Array<Record<string, unknown>>;
}

async function main() {
  let scenarios = 0;

  const test = async (name: string, run: () => Promise<void> | void) => {
    await run();
    scenarios += 1;
    console.log(`PASS ${scenarios}: ${name}`);
  };

  await test("Relatorio ALL preserva acesso global", () => {
    const clauses = andClauses(buildScheduleReportWhere(reportInput, all));
    assert.deepEqual(clauses[1], {});
  });

  await test("Relatorio restrito filtra por ministerios autorizados", () => {
    const clauses = andClauses(buildScheduleReportWhere(reportInput, restricted));
    assert.deepEqual(clauses[1], {
      ministryId: { in: ["ministry-a", "ministry-b"] }
    });
  });

  for (const [name, accessContext] of [
    ["sem Member", withoutMember],
    ["sem ministerios", withoutMinistries]
  ] as const) {
    await test(`Relatorio ${name} falha fechado com IN vazio`, () => {
      const clauses = andClauses(
        buildScheduleReportWhere(reportInput, accessContext)
      );
      assert.deepEqual(clauses[1], { ministryId: { in: [] } });
    });
  }

  await test("Relatorio combina escopo e filtros solicitados sem sobrescrever acesso", () => {
    const input = {
      ...reportInput,
      filters: {
        ministryId: "ministry-a",
        status: ScheduleStatus.PUBLISHED,
        memberId: "member-x",
        startDate: "2026-07-01",
        endDate: "2026-07-31"
      }
    } as ScheduleReportInput;
    const clauses = andClauses(buildScheduleReportWhere(input, restricted));

    assert.deepEqual(clauses[1], {
      ministryId: { in: ["ministry-a", "ministry-b"] }
    });
    assert.equal(clauses[2].ministryId, "ministry-a");
    assert.equal(clauses[2].status, ScheduleStatus.PUBLISHED);
    assert.deepEqual(clauses[2].members, {
      some: { memberId: "member-x", deletedAt: null }
    });
    assert("date" in clauses[2]);
  });

  await test("Dashboard ALL preserva escalas globais", () => {
    const clauses = andClauses(buildUpcomingSchedulesWhere(all));
    assert.deepEqual(clauses[1], {});
  });

  await test("Dashboard restrito filtra proximas escalas por ministerio", () => {
    const clauses = andClauses(buildUpcomingSchedulesWhere(restricted));
    assert.deepEqual(clauses[1], {
      ministryId: { in: ["ministry-a", "ministry-b"] }
    });
  });

  for (const [name, accessContext] of [
    ["sem Member", withoutMember],
    ["sem ministerios", withoutMinistries]
  ] as const) {
    await test(`Dashboard ${name} retorna zero escalas pelo filtro vazio`, () => {
      const clauses = andClauses(buildUpcomingSchedulesWhere(accessContext));
      assert.deepEqual(clauses[1], { ministryId: { in: [] } });
    });
  }

  await test("Dashboard mantem regras de data, cancelamento e soft delete", () => {
    const clauses = andClauses(buildUpcomingSchedulesWhere(restricted));
    assert.equal(clauses[0].deletedAt, null);
    assert.deepEqual(clauses[0].status, { not: ScheduleStatus.CANCELED });
    assert("date" in clauses[0]);
  });

  await test("Perfil ALL preserva o historico global do membro consultado", () => {
    assert.deepEqual(buildMemberScheduleHistoryWhere(all), {
      deletedAt: null,
      schedule: { deletedAt: null }
    });
  });

  await test("Perfil restrito filtra somente o historico de escalas", () => {
    assert.deepEqual(buildMemberScheduleHistoryWhere(restricted), {
      deletedAt: null,
      schedule: {
        deletedAt: null,
        ministryId: { in: ["ministry-a", "ministry-b"] }
      }
    });
  });

  for (const [name, accessContext] of [
    ["sem Member", withoutMember],
    ["sem ministerios", withoutMinistries]
  ] as const) {
    await test(`Perfil ${name} mantem o membro e esvazia apenas as escalas`, () => {
      assert.deepEqual(buildMemberScheduleHistoryWhere(accessContext), {
        deletedAt: null,
        schedule: {
          deletedAt: null,
          ministryId: { in: [] }
        }
      });
    });
  }

  await test("Rota de relatorio resolve permissao e escopo uma unica vez", () => {
    const source = readFileSync(
      "src/app/api/reports/schedules/route.ts",
      "utf8"
    );

    assert(source.includes("requireScheduleAccess("));
    assert(source.includes('"report.view"'));
    assert(source.includes('"report.export"'));
    assert(source.includes("reportService.schedules(payload, authorization)"));
    assert(!source.includes("@/lib/session"));
    assert(!source.includes("resolveScheduleAccessContext"));
  });

  await test("Dashboard administrativo injeta o contexto na consulta de escalas", () => {
    const route = readFileSync("src/app/api/dashboard/admin/route.ts", "utf8");
    const service = readFileSync("src/services/dashboard.service.ts", "utf8");

    assert(route.includes('requireScheduleAccess("dashboard.admin.view")'));
    assert(route.includes("scheduleAccessContext: authorization.accessContext"));
    assert(
      service.includes(
        "dashboardRepository.getUpcomingSchedules(input.scheduleAccessContext)"
      )
    );
    assert(!route.includes("@/lib/session"));
  });

  await test("Dashboard nao carrega escalas quando o widget nao esta autorizado", () => {
    const service = readFileSync("src/services/dashboard.service.ts", "utf8");

    assert.match(
      service,
      /const schedules = queryPlan\.schedules[\s\S]*\? dashboardRepository\.getUpcomingSchedules/
    );
  });

  await test("Perfil administrativo exige member.view e injeta o mesmo contexto", () => {
    const page = readFileSync(
      "src/app/(app)/membros/[id]/page.tsx",
      "utf8"
    );
    const route = readFileSync("src/app/api/members/[id]/route.ts", "utf8");

    assert(page.includes('requireScheduleAccess("member.view")'));
    assert(page.includes("memberService.getById(id, authorization)"));
    assert(route.includes('requireScheduleAccess("member.view")'));
    assert(route.includes('requireScheduleAccess("member.update")'));
  });

  await test("Repository filtra o relacionamento sem restringir o cadastro do membro", () => {
    const source = readFileSync("src/repositories/member.repository.ts", "utf8");

    assert(source.includes("where: { id, deletedAt: null }"));
    assert(source.includes("buildMemberScheduleHistoryWhere(accessContext)"));
    assert(!source.includes("accessContext?: ScheduleAccessContext"));
    assert(!source.includes("filter((schedule"));
  });

  await test("Portal e Minhas Escalas permanecem isolados pelo memberId da sessao", () => {
    const dashboardService = readFileSync(
      "src/services/dashboard.service.ts",
      "utf8"
    );
    const portalRoute = readFileSync(
      "src/app/api/dashboard/portal/route.ts",
      "utf8"
    );
    const mySchedulesRoute = readFileSync(
      "src/app/api/my-schedules/route.ts",
      "utf8"
    );

    assert(
      dashboardService.includes(
        "dashboardRepository.findNextScheduleForMember(input.memberId)"
      )
    );
    assert(!portalRoute.includes("requireScheduleAccess"));
    assert(!mySchedulesRoute.includes("requireScheduleAccess"));
  });

  console.log(
    `Schedule indirect surfaces: ${scenarios} scenarios passed.`
  );
}

void main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Schedule indirect surfaces tests failed."
  );
  process.exitCode = 1;
});
