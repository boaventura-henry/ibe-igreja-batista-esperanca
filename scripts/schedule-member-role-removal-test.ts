import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

let scenarios = 0;

async function test(name: string, run: () => void | Promise<void>) {
  await run();
  scenarios += 1;
  console.log(`PASS ${scenarios}: ${name}`);
}

async function main() {
  const paths = {
    schema: "prisma/schema.prisma",
    migration: "prisma/migrations/20260827120000_remove_schedule_member_legacy_role/migration.sql",
    repository: "src/repositories/schedule.repository.ts",
    service: "src/services/schedule.service.ts",
    helper: "src/lib/schedule-member-role.ts",
    validator: "src/validators/schedule.validator.ts",
    createRoute: "src/app/api/schedules/[id]/members/route.ts",
    updateRoute: "src/app/api/schedules/[id]/members/[memberScheduleId]/route.ts",
    dashboardRepository: "src/repositories/dashboard.repository.ts",
    portalRepository: "src/repositories/member-portal.repository.ts",
    myScheduleRepository: "src/repositories/my-schedule.repository.ts",
    memberRepository: "src/repositories/member.repository.ts",
    notificationService: "src/services/schedule-notification.service.ts",
    myScheduleService: "src/services/my-schedule.service.ts",
    instrumentService: "src/services/schedule-instrument-assignment.service.ts",
    instrumentRepository: "src/repositories/schedule-instrument-assignment.repository.ts",
    adminPage: "src/app/(app)/membros/[id]/page.tsx",
    manager: "src/components/schedules/ScheduleDetailManager.tsx",
    docs: "docs/schedule-member-multiple-roles.md"
  } as const;
  const entries = await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readFile(path, "utf8")] as const));
  const source = Object.fromEntries(entries) as Record<keyof typeof paths, string>;
  const model = source.schema.match(/model ScheduleMember \{[\s\S]*?\n\}/)?.[0] ?? "";

  await test("ScheduleMember nao possui role singular", () => assert.doesNotMatch(model, /\n\s*role\s+ScheduleMemberRole/));
  await test("ScheduleMember nao possui indice por role", () => assert.doesNotMatch(model, /@@index\(\[role\]\)/));
  await test("enum ScheduleMemberRole foi preservado", () => assert.match(source.schema, /enum ScheduleMemberRole \{/));
  await test("modelo de assignments foi preservado", () => assert.match(source.schema, /model ScheduleMemberRoleAssignment \{/));
  await test("unicidade de assignment foi preservada", () => assert.match(source.schema, /@@unique\(\[scheduleMemberId, role\]\)/));
  await test("indice de assignment por role foi preservado", () => assert.match(source.schema, /model ScheduleMemberRoleAssignment[\s\S]*@@index\(\[role\]\)/));
  await test("migration remove o indice legado", () => assert.match(source.migration, /DROP INDEX "ScheduleMember_role_idx"/));
  await test("migration remove a coluna legada", () => assert.match(source.migration, /ALTER TABLE "ScheduleMember" DROP COLUMN "role"/));
  await test("migration nao altera assignments", () => assert.doesNotMatch(source.migration, /ScheduleMemberRoleAssignment/));
  await test("repository nao seleciona role singular", () => assert.doesNotMatch(source.repository, /^\s{2}role:\s*true,/m));
  await test("repository nao grava legacyRole", () => assert.doesNotMatch(source.repository, /legacyRole/));
  await test("repository cria assignments aninhados", () => assert.match(source.repository, /scheduleMember\.create\([\s\S]*roles:\s*\{\s*create:/));
  await test("repository atualiza assignments", () => assert.match(source.repository, /roles:\s*\{\s*deleteMany:/));
  await test("update sem roles preserva assignments atuais", () => assert.match(source.service, /const currentRoles = current \? getScheduleMemberRoles\(current\) : \[\][\s\S]*: currentRoles/));
  await test("status nao exige roles no payload", () => assert.match(source.service, /data\.roles !== undefined[\s\S]*: currentRoles/));
  await test("service nao resolve projecao legada", () => assert.doesNotMatch(source.service, /resolveLegacyScheduleMemberRole/));
  await test("helper nao possui fallback por source.role", () => assert.doesNotMatch(source.helper, /source\.role\b/));
  await test("helper plural continua disponivel", () => assert.match(source.helper, /export function getScheduleMemberRoles/));
  await test("create exige roles", () => assert.match(source.validator, /roles:\s*z\.array\(z\.enum\(ScheduleMemberRole\)\)[\s\S]*\.min\(1,/));
  await test("validator nao aceita role singular", () => assert.doesNotMatch(source.validator, /role:\s*z\.enum\(ScheduleMemberRole\)/));
  await test("rota create rejeita payload legado", () => assert.match(source.createRoute, /SCHEDULE_MEMBER_ROLE_LEGACY_UNSUPPORTED/));
  await test("rota update rejeita payload legado", () => assert.match(source.updateRoute, /SCHEDULE_MEMBER_ROLE_LEGACY_UNSUPPORTED/));
  await test("Dashboard carrega assignments", () => assert.match(source.dashboardRepository, /roles:\s*\{\s*select:\s*\{\s*role:\s*true/));
  await test("Portal carrega assignments", () => assert.match(source.portalRepository, /roles:\s*\{\s*select:\s*\{\s*role:\s*true/));
  await test("My Schedules carrega assignments", () => assert.match(source.myScheduleRepository, /roles:\s*\{\s*select:\s*\{\s*role:\s*true/));
  await test("historico de membro carrega assignments", () => assert.match(source.memberRepository, /roles:\s*\{\s*select:\s*\{\s*role:\s*true/));
  await test("notificacoes usam apresentacao plural", () => assert.match(source.notificationService, /getScheduleMemberDisplayRoles/));
  await test("self-service usa exclusivamente a colecao", () => assert.match(source.myScheduleService, /hasInstrumentRole\(participant\)/));
  await test("suggestion deriva historico dos assignments", () => {
    assert.match(source.instrumentService, /findLatestInstrumentSuggestionHistory/);
    assert.match(source.instrumentRepository, /instrumentAssignments:/);
    assert.doesNotMatch(source.instrumentRepository, /^\s*role:\s*true,/m);
  });
  await test("writers oficiais nao usam createMany ou upsert do participante", () => {
    assert.doesNotMatch(source.repository, /scheduleMember\.(?:createMany|upsert)\(/);
    assert.match(source.repository, /scheduleMember\.create\([\s\S]*roles:\s*\{\s*create:/);
  });
  await test("historico administrativo usa apresentacao plural", () => assert.match(source.adminPage, /getScheduleMemberDisplayRoles/));
  await test("formulario administrativo envia roles", () => assert.match(source.manager, /roles:\s*form\.roles/));
  await test("documentacao registra roles como fonte unica", () => assert.match(source.docs, /only source of truth/i));

  assert.ok(scenarios >= 25, "A suite de remocao deve cobrir pelo menos 25 cenarios.");
  console.log(`ScheduleMember.role removal: ${scenarios} scenarios passed.`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
