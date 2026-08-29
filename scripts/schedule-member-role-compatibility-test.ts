import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  MemberMinistryStatus,
  PrismaClient,
  ScheduleInstrumentSource,
  ScheduleMemberRole,
  ScheduleMemberStatus,
  ScheduleScope,
  ScheduleStatus
} from "@prisma/client";
import {
  compareScheduleMembersByRolePriority,
  getScheduleMemberDisplayRoles,
  getScheduleMemberRoles,
  resolveScheduleMemberRoleProjection
} from "../src/lib/schedule-member-role";
import type { ScheduleAuthorization } from "../src/lib/schedule-authorization";
import { memberService } from "../src/services/member.service";
import { myScheduleService } from "../src/services/my-schedule.service";
import { scheduleService } from "../src/services/schedule.service";
import {
  hasLegacyScheduleMemberRoleField,
  scheduleMemberCreateSchema,
  scheduleMemberUpdateSchema
} from "../src/validators/schedule.validator";

const prisma = new PrismaClient();
const stamp = Date.now().toString();
const fixture = (name: string) => `__role_compat_${stamp}_${name}`;
let scenarios = 0;

async function test(name: string, run: () => Promise<void> | void) {
  await run();
  scenarios += 1;
  console.log(`PASS ${scenarios}: ${name}`);
}

function requireDevelopmentDatasource() {
  for (const variable of ["DATABASE_URL", "DIRECT_URL"] as const) {
    const value = process.env[variable];
    assert.ok(value, `${variable} deve estar configurada somente para o teste Development.`);
    const parsed = new URL(value);
    assert.ok(
      parsed.hostname.startsWith("ep-twilight-haze-adynpvs9"),
      `${variable} deve apontar para o compute Development autorizado.`
    );
    assert.equal(parsed.pathname.replace(/^\//, ""), "ibe", `${variable} deve usar o database ibe.`);
  }
}

async function main() {
  const [helper, repository, service, validator, createRoute, updateRoute, adminPage, myRepository, portalService, notificationService, schema, seed] = await Promise.all([
    readFile("src/lib/schedule-member-role.ts", "utf8"),
    readFile("src/repositories/schedule.repository.ts", "utf8"),
    readFile("src/services/schedule.service.ts", "utf8"),
    readFile("src/validators/schedule.validator.ts", "utf8"),
    readFile("src/app/api/schedules/[id]/members/route.ts", "utf8"),
    readFile("src/app/api/schedules/[id]/members/[memberScheduleId]/route.ts", "utf8"),
    readFile("src/app/(app)/membros/[id]/page.tsx", "utf8"),
    readFile("src/repositories/my-schedule.repository.ts", "utf8"),
    readFile("src/services/dashboard.service.ts", "utf8"),
    readFile("src/services/schedule-notification.service.ts", "utf8"),
    readFile("prisma/schema.prisma", "utf8"),
    readFile("prisma/seed.ts", "utf8")
  ]);

  await test("create exige roles", () => assert.equal(scheduleMemberCreateSchema.safeParse({ memberId: "cm0000000000000000000000000" }).success, false));
  await test("create rejeita roles vazias", () => assert.equal(scheduleMemberCreateSchema.safeParse({ memberId: "cm0000000000000000000000000", roles: [] }).success, false));
  await test("payload role singular e identificado", () => assert.equal(hasLegacyScheduleMemberRoleField({ role: ScheduleMemberRole.VOCAL }), true));
  await test("payload role mais roles e identificado", () => assert.equal(hasLegacyScheduleMemberRoleField({ role: ScheduleMemberRole.VOCAL, roles: [ScheduleMemberRole.VOCAL] }), true));
  await test("payload roles nao e legado", () => assert.equal(hasLegacyScheduleMemberRoleField({ roles: [ScheduleMemberRole.VOCAL] }), false));
  await test("update de roles aceita colecao oficial", () => assert.equal(scheduleMemberUpdateSchema.safeParse({ roles: [ScheduleMemberRole.LEADER, ScheduleMemberRole.MINISTER] }).success, true));
  await test("update de funcao rejeita colecao vazia", () => assert.equal(scheduleMemberUpdateSchema.safeParse({ roles: [] }).success, false));
  await test("rotas rejeitam role legado explicitamente", () => {
    assert.match(createRoute, /SCHEDULE_MEMBER_ROLE_LEGACY_UNSUPPORTED/);
    assert.match(updateRoute, /SCHEDULE_MEMBER_ROLE_LEGACY_UNSUPPORTED/);
  });
  await test("update de status preserva permissao de confirmacao", () => {
    assert.match(updateRoute, /requiresScheduleUpdate/);
    assert.match(updateRoute, /payload\.roles/);
    assert.match(updateRoute, /schedule\.confirm/);
  });
  await test("helper singular possui zero export", () => assert.doesNotMatch(helper, /export function getScheduleMemberDisplayRole\(/));
  await test("helper plural nao possui fallback por role", () => {
    assert.doesNotMatch(helper, /source\.role\b/);
    assert.deepEqual(getScheduleMemberRoles({}), []);
    assert.equal(getScheduleMemberDisplayRoles({ roles: [] }), "Função não informada");
  });
  await test("projecao transitoria deriva da prioridade oficial", () => {
    assert.equal(
      resolveScheduleMemberRoleProjection([ScheduleMemberRole.INSTRUMENT, ScheduleMemberRole.BACKING]),
      ScheduleMemberRole.BACKING
    );
  });
  await test("comparador usa menor prioridade oficial", () => {
    const participants = [
      { id: "joao", member: { name: "João" }, roles: [ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT] },
      { id: "carlos", member: { name: "Carlos" }, roles: [ScheduleMemberRole.VOCAL] },
      { id: "mirian", member: { name: "Mírian" }, roles: [ScheduleMemberRole.LEADER, ScheduleMemberRole.MINISTER] }
    ].sort(compareScheduleMembersByRolePriority);
    assert.deepEqual(participants.map((participant) => participant.id), ["mirian", "carlos", "joao"]);
  });
  await test("repositories nao ordenam por role legado", () => {
    assert.doesNotMatch(repository, /orderBy:\s*\[[^\]]*\{\s*role:/);
    assert.doesNotMatch(myRepository, /orderBy:\s*\[[^\]]*\{\s*role:/);
  });
  await test("ordenacao nao introduz N mais 1", () => {
    assert.match(repository, /roles:\s*\{ select: \{ role: true \} \}/);
    assert.match(service, /compareScheduleMembersByRolePriority/);
    assert.doesNotMatch(service, /for \([^)]*\)[\s\S]{0,180}scheduleMemberRoleAssignment/);
  });
  await test("historico administrativo usa helper plural", () => {
    assert.match(adminPage, /getScheduleMemberDisplayRoles\(item, item\.instrumentAssignment\)/);
    assert.doesNotMatch(adminPage, /item\.role/);
  });
  await test("serializador interno nao expoe role singular", () => {
    const serializer = service.match(/function serializeMember[\s\S]*?\n\}/)?.[0] ?? "";
    assert.match(serializer, /roles:/);
    assert.doesNotMatch(serializer, /\brole:/);
  });
  await test("Portal e Dashboard usam roles", () => {
    assert.match(portalService, /roles:/);
    assert.doesNotMatch(portalService, /schedule\.role\b/);
  });
  await test("notificacoes usam helper plural", () => {
    assert.match(notificationService, /getScheduleMemberDisplayRoles/);
    assert.doesNotMatch(notificationService, /getScheduleMemberDisplayRole\(/);
  });
  await test("writer oficial cria assignments na mesma operacao", () => {
    assert.match(repository, /scheduleMember\.create\([\s\S]*?roles:\s*\{\s*create:/);
    assert.match(repository, /role:\s*projectionRole/);
  });
  await test("schema preserva role e indice legados durante compatibilidade", () => {
    const model = schema.match(/model ScheduleMember \{[\s\S]*?\n\}/)?.[0] ?? "";
    assert.match(model, /\n\s*role\s+ScheduleMemberRole/);
    assert.match(model, /@@index\(\[role\]\)/);
  });
  await test("service nao usa projecao como fonte funcional", () => {
    assert.doesNotMatch(service, /current\.role\b/);
    assert.doesNotMatch(service, /data\.role\b/);
  });
  await test("seed nao cria ScheduleMember sem assignments", () => assert.doesNotMatch(seed, /scheduleMember\.(?:create|createMany|upsert)/));
  await test("frontend oficial envia roles", async () => {
    assert.match(await readFile("src/components/schedules/ScheduleDetailManager.tsx", "utf8"), /roles:\s*form\.roles/);
  });
  await test("role legado nao existe nos validators", () => assert.doesNotMatch(validator, /role:\s*z\.enum\(ScheduleMemberRole\)/));

  requireDevelopmentDatasource();
  const author = await prisma.user.findFirst({ where: { isActive: true }, select: { id: true } });
  assert.ok(author, "Development precisa conter usuario ativo para autoria dos fixtures.");
  const ids = { ministry: "", category: "", members: [] as string[], links: [] as string[], schedule: "", participants: [] as string[] };
  const authorization = {
    user: { id: author.id },
    accessContext: { scope: ScheduleScope.ALL, memberId: null, authorizedMinistryIds: null }
  } as unknown as ScheduleAuthorization;

  try {
    const ministry = await prisma.ministry.create({ data: { name: fixture("ministry"), slug: fixture("ministry") } });
    ids.ministry = ministry.id;
    const category = await prisma.instrumentCategory.create({ data: { name: fixture("baixo") } });
    ids.category = category.id;
    const [mirian, joao, carlos] = await Promise.all([
      prisma.member.create({ data: { name: fixture("Mírian") } }),
      prisma.member.create({ data: { name: fixture("João") } }),
      prisma.member.create({ data: { name: fixture("Carlos") } })
    ]);
    ids.members.push(mirian.id, joao.id, carlos.id);
    const links = await Promise.all(ids.members.map((memberId) => prisma.memberMinistry.create({
      data: { memberId, ministryId: ministry.id, entryDate: new Date("2026-01-01T00:00:00.000Z"), status: MemberMinistryStatus.ACTIVE, createdById: author.id }
    })));
    ids.links.push(...links.map((link) => link.id));
    const schedule = await prisma.schedule.create({
      data: { title: fixture("schedule"), ministryId: ministry.id, date: new Date("2099-08-26T00:00:00.000Z"), createdById: author.id }
    });
    ids.schedule = schedule.id;

    const mirianParticipant = await scheduleService.addMember(schedule.id, {
      memberId: mirian.id,
      roles: [ScheduleMemberRole.LEADER, ScheduleMemberRole.MINISTER],
      status: ScheduleMemberStatus.PENDING,
      allowMinistryException: false
    }, authorization);
    const joaoParticipant = await scheduleService.addMember(schedule.id, {
      memberId: joao.id,
      roles: [ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT],
      status: ScheduleMemberStatus.PENDING,
      allowMinistryException: false,
      instrumentAssignment: { source: ScheduleInstrumentSource.OWN, instrumentCategoryId: category.id, instrumentId: null }
    }, authorization);
    const carlosParticipant = await scheduleService.addMember(schedule.id, {
      memberId: carlos.id,
      roles: [ScheduleMemberRole.VOCAL],
      status: ScheduleMemberStatus.PENDING,
      allowMinistryException: false
    }, authorization);
    ids.participants.push(mirianParticipant.id, joaoParticipant.id, carlosParticipant.id);
    await prisma.schedule.update({ where: { id: schedule.id }, data: { status: ScheduleStatus.PUBLISHED, publishedAt: new Date() } });

    await test("writer oficial cria pelo menos um assignment", async () => {
      const counts = await prisma.scheduleMemberRoleAssignment.groupBy({ by: ["scheduleMemberId"], where: { scheduleMemberId: { in: ids.participants } }, _count: true });
      assert.equal(counts.length, 3);
      assert.equal(counts.every((count) => count._count >= 1), true);
    });
    await test("writer mantem projecao legada sincronizada", async () => {
      const projections = await prisma.scheduleMember.findMany({
        where: { id: { in: ids.participants } },
        select: { id: true, role: true }
      });
      assert.equal(projections.find((item) => item.id === mirianParticipant.id)?.role, ScheduleMemberRole.MINISTER);
      assert.equal(projections.find((item) => item.id === joaoParticipant.id)?.role, ScheduleMemberRole.BACKING);
      assert.equal(projections.find((item) => item.id === carlosParticipant.id)?.role, ScheduleMemberRole.VOCAL);
    });
    await test("admin ordena Mírian Carlos João pelas roles", async () => {
      const result = await scheduleService.getById(schedule.id, authorization);
      assert.deepEqual(result.members.map((participant) => participant.member.id), [mirian.id, carlos.id, joao.id]);
    });
    await test("historico de João preserva uma participacao e duas funcoes", async () => {
      const detail = await memberService.getById(joao.id, authorization);
      const participation = detail.schedules.find((item) => item.id === joaoParticipant.id);
      assert.ok(participation);
      assert.deepEqual(participation.roles, [ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT]);
      assert.equal(detail.schedules.filter((item) => item.id === joaoParticipant.id).length, 1);
      assert.equal(getScheduleMemberDisplayRoles(participation, participation.instrumentAssignment), `${category.name} • Backing`);
    });
    await test("My Schedules usa roles e ordenacao deterministica", async () => {
      const result = await myScheduleService.list({ id: author.id, memberId: joao.id }, { includeCompleted: true });
      const item = result.schedules.find((scheduleItem) => scheduleItem.id === joaoParticipant.id);
      assert.ok(item);
      assert.deepEqual(item.roles, [ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT]);
      assert.deepEqual(item.participants.map((participant) => participant.member.id), [mirian.id, carlos.id, joao.id]);
    });

    await test("compatibilidade preserva admin", async () => {
      const result = await scheduleService.getById(schedule.id, authorization);
      assert.deepEqual(result.members.map((participant) => participant.member.id), [mirian.id, carlos.id, joao.id]);
      assert.deepEqual(result.members.find((participant) => participant.id === mirianParticipant.id)?.roles, [ScheduleMemberRole.MINISTER, ScheduleMemberRole.LEADER]);
    });
    await test("compatibilidade preserva historico", async () => {
      const detail = await memberService.getById(joao.id, authorization);
      assert.deepEqual(detail.schedules.find((item) => item.id === joaoParticipant.id)?.roles, [ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT]);
    });
    await test("compatibilidade preserva Portal", async () => {
      const item = (await myScheduleService.list({ id: author.id, memberId: joao.id }, { includeCompleted: true })).schedules.find((scheduleItem) => scheduleItem.id === joaoParticipant.id);
      assert.deepEqual(item?.roles, [ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT]);
    });

    assert.ok(scenarios >= 30, "A suite dedicada deve cobrir pelo menos 30 cenarios.");
    console.log(`ScheduleMember.role compatibility: ${scenarios} scenarios passed.`);
  } finally {
    if (ids.schedule) {
      await prisma.scheduleMemberInstrumentAssignment.deleteMany({ where: { scheduleMember: { scheduleId: ids.schedule } } });
      await prisma.scheduleMemberRoleAssignment.deleteMany({ where: { scheduleMember: { scheduleId: ids.schedule } } });
      await prisma.scheduleMember.deleteMany({ where: { scheduleId: ids.schedule } });
      await prisma.schedule.deleteMany({ where: { id: ids.schedule } });
    }
    if (ids.links.length) await prisma.memberMinistry.deleteMany({ where: { id: { in: ids.links } } });
    if (ids.members.length) await prisma.member.deleteMany({ where: { id: { in: ids.members } } });
    if (ids.category) await prisma.instrumentCategory.deleteMany({ where: { id: ids.category } });
    if (ids.ministry) await prisma.ministry.deleteMany({ where: { id: ids.ministry } });
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "ScheduleMember.role compatibility tests failed.");
  process.exitCode = 1;
});
