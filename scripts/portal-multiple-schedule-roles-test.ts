import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  PrismaClient,
  ScheduleInstrumentSource,
  ScheduleMemberRole,
  ScheduleMemberStatus,
  ScheduleStatus
} from "@prisma/client";
import { AppError } from "../src/lib/errors";
import {
  getScheduleMemberDisplayRoles,
  hasInstrumentRole
} from "../src/lib/schedule-member-role";
import { dashboardRepository } from "../src/repositories/dashboard.repository";
import { myScheduleService } from "../src/services/my-schedule.service";

const prisma = new PrismaClient();
const stamp = Date.now().toString();
const key = (suffix: string) => `__portal_multi_role_${stamp}_${suffix}`;
let scenarios = 0;

async function test(name: string, run: () => Promise<void> | void) {
  await run();
  scenarios += 1;
  console.log(`PASS ${scenarios}: ${name}`);
}

function requireDevelopmentDatasource() {
  for (const variable of ["DATABASE_URL", "DIRECT_URL"] as const) {
    const value = process.env[variable];
    assert.ok(value, `${variable} deve estar configurada.`);
    const parsed = new URL(value);
    assert.ok(parsed.hostname.startsWith("ep-twilight-haze-adynpvs9"));
    assert.equal(parsed.pathname.replace(/^\//, ""), "ibe");
  }
}

function errorCode(error: unknown) {
  return error instanceof AppError ? error.code : null;
}

async function main() {
  requireDevelopmentDatasource();
  const [managerSource, portalSource, myRepositorySource, myServiceSource, dashboardRepositorySource, dashboardServiceSource, notificationSource, adminSource, docsSource] = await Promise.all([
    readFile("src/components/my-schedules/MyScheduleManager.tsx", "utf8"),
    readFile("src/components/portal/PortalDashboard.tsx", "utf8"),
    readFile("src/repositories/my-schedule.repository.ts", "utf8"),
    readFile("src/services/my-schedule.service.ts", "utf8"),
    readFile("src/repositories/dashboard.repository.ts", "utf8"),
    readFile("src/services/dashboard.service.ts", "utf8"),
    readFile("src/services/schedule-notification.service.ts", "utf8"),
    readFile("src/components/schedules/ScheduleDetailManager.tsx", "utf8"),
    readFile("docs/schedule-member-multiple-roles.md", "utf8")
  ]);
  const bass = { instrumentCategory: { name: "Baixo" } };
  const guitar = { instrumentCategory: { name: "Violão" } };

  await test("role singular em Minhas Escalas", () => assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.VOCAL] }), "Vocal"));
  await test("LEADER e MINISTER", () => assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.MINISTER, ScheduleMemberRole.LEADER] }), "Líder • Ministro"));
  await test("BACKING e INSTRUMENT com Baixo", () => assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT] }, bass), "Baixo • Backing"));
  await test("MINISTER e INSTRUMENT com Violao", () => assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.INSTRUMENT, ScheduleMemberRole.MINISTER] }, guitar), "Ministro • Violão"));
  await test("tres roles aparecem integralmente", () => assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT, ScheduleMemberRole.LEADER] }, bass), "Líder • Baixo • Backing"));
  await test("ordem de entrada nao altera apresentacao", () => assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.MINISTER, ScheduleMemberRole.LEADER] }), getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.LEADER, ScheduleMemberRole.MINISTER] })));
  await test("roles vazias nao recorrem ao legado", () => assert.equal(getScheduleMemberDisplayRoles({ role: ScheduleMemberRole.VOCAL, roles: [] }), "Função não informada"));
  await test("roles nao carregadas usam fallback legado", () => assert.equal(getScheduleMemberDisplayRoles({ role: ScheduleMemberRole.VOCAL }), "Vocal"));
  await test("INSTRUMENT sem categoria permanece visivel", () => assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.INSTRUMENT, ScheduleMemberRole.BACKING] }), "Instrumento • Backing"));
  await test("categoria inativa permanece legivel", () => assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.INSTRUMENT] }, { instrumentCategory: { name: "Baixo", isActive: false } } as never), "Baixo"));
  await test("patrimonio nao aparece", () => assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.INSTRUMENT] }, { instrumentCategory: { name: "Baixo" }, instrument: { name: "Tagima Millennium" } } as never), "Baixo"));
  await test("OWN apresenta categoria e nao origem", () => assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.INSTRUMENT, ScheduleMemberRole.BACKING] }, { ...bass, source: ScheduleInstrumentSource.OWN } as never), "Baixo • Backing"));
  await test("BACKING e INSTRUMENT permitem self-service", () => assert.equal(hasInstrumentRole({ role: ScheduleMemberRole.BACKING, roles: [ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT] }), true));
  await test("BACKING isolado bloqueia self-service", () => assert.equal(hasInstrumentRole({ role: ScheduleMemberRole.INSTRUMENT, roles: [ScheduleMemberRole.BACKING] }), false));
  await test("colecao prevalece sobre role legado divergente", () => assert.equal(hasInstrumentRole({ role: ScheduleMemberRole.BACKING, roles: [ScheduleMemberRole.INSTRUMENT] }), true));
  await test("Minhas Escalas usa helper multiplo", () => assert.match(managerSource, /getScheduleMemberDisplayRoles\(schedule, schedule\.instrumentAssignment\)/));
  await test("Minhas Escalas nao usa helper singular", () => assert.doesNotMatch(managerSource, /getScheduleMemberDisplayRole\(/));
  await test("Dashboard Portal usa helper multiplo", () => assert.match(portalSource, /getScheduleMemberDisplayRoles\(data\.nextSchedule, data\.nextSchedule\.instrumentAssignment\)/));
  await test("Dashboard Portal nao usa helper singular", () => assert.doesNotMatch(portalSource, /getScheduleMemberDisplayRole\(/));
  await test("label admite multiplas funcoes", () => assert.match(managerSource, />Funções<\/th>/));
  await test("mobile permite quebra natural", () => {
    assert.match(managerSource, /whitespace-normal break-words/);
    assert.match(portalSource, /whitespace-normal break-words/);
  });
  await test("leitor de tela recebe contexto de funcoes", () => assert.match(portalSource, /sr-only">Funções:/));
  await test("um card continua por ScheduleMember", () => assert.match(managerSource, /data\.schedules\.map\(\(schedule\)/));
  await test("status continua unico", () => assert.equal((managerSource.match(/ScheduleMemberStatusBadge status=\{schedule\.status\}/g) ?? []).length, 1));
  await test("confirmacao continua unica", () => assert.equal((managerSource.match(/postAction\(schedule\.id, "confirm"\)/g) ?? []).length, 1));
  await test("recusa continua unica", () => assert.equal((managerSource.match(/decline\(schedule\.id\)/g) ?? []).length, 1));
  await test("REPLACED preserva bloqueio de troca", () => assert.match(managerSource, /schedule\.status !== ScheduleMemberStatus\.REPLACED/));
  await test("self-service visual usa colecao de roles", () => assert.match(managerSource, /hasInstrumentRole\(schedule\)/));
  await test("service self-service usa helper central", () => assert.match(myServiceSource, /hasInstrumentRole\(participant\)/));
  await test("DTO Minhas Escalas seleciona roles e categoria", () => {
    assert.match(myRepositorySource, /roles: \{ select: \{ role: true \} \}/);
    assert.match(myRepositorySource, /instrumentCategory: \{ select: \{ id: true, name: true \} \}/);
  });
  await test("DTO principal nao seleciona patrimonio", () => {
    const select = myRepositorySource.match(/const myScheduleMemberSelect[\s\S]*?satisfies Prisma\.ScheduleMemberSelect/)?.[0] ?? "";
    assert.doesNotMatch(select, /instrument:\s*\{/);
  });
  await test("Dashboard DTO seleciona roles e categoria sem patrimonio", () => {
    const select = dashboardRepositorySource.match(/const portalScheduleSelect[\s\S]*?satisfies Prisma\.ScheduleMemberSelect/)?.[0] ?? "";
    assert.match(select, /roles:/);
    assert.match(select, /instrumentCategory:/);
    assert.doesNotMatch(select, /instrument:\s*\{/);
  });
  await test("consultas relacionais evitam N mais 1", () => {
    assert.match(myRepositorySource, /select: myScheduleMemberSelect/);
    assert.match(dashboardRepositorySource, /select: portalScheduleSelect/);
  });
  await test("paginacao e filtros permanecem por participacao", () => {
    assert.match(myRepositorySource, /buildMyScheduleWhere\(memberId, filters\)/);
    assert.match(myRepositorySource, /filters\.includeCompleted/);
  });
  await test("IDOR permanece restrito ao membro da sessao", () => assert.match(myRepositorySource, /OR: \[\{ memberId \}, \{ replacedByMemberId: memberId \}\]/));
  await test("Dashboard carrega escala somente para o memberId", () => assert.match(dashboardRepositorySource, /findNextScheduleForMember\(memberId: string\)/));
  await test("Dashboard serializa colecao de roles", () => assert.match(dashboardServiceSource, /roles: schedule\.roles\.map/));
  await test("administrativo continua usando helper multiplo", () => assert.match(adminSource, /getScheduleMemberDisplayRoles\(item, item\.instrumentAssignment\)/));
  await test("notificacoes usam o helper multiplo", () => {
    assert.match(notificationSource, /getScheduleMemberDisplayRoles\(/);
    assert.doesNotMatch(notificationSource, /getScheduleMemberDisplayRole\(/);
  });
  await test("documentacao registra apresentacao multipla nas notificacoes", () => assert.match(docsSource, /Initial schedule publication and later participant inclusion now use/));

  const author = await prisma.user.findFirst({ where: { isActive: true }, select: { id: true } });
  assert.ok(author, "Development precisa conter usuario ativo para autoria dos fixtures.");
  const ids = { ministry: "", categories: [] as string[], members: [] as string[], users: [] as string[], schedules: [] as string[] };

  try {
    const ministry = await prisma.ministry.create({ data: { name: key("ministry"), slug: key("ministry") } });
    ids.ministry = ministry.id;
    const [bassCategory, guitarCategory] = await Promise.all([
      prisma.instrumentCategory.create({ data: { name: key("Baixo"), createdById: author.id } }),
      prisma.instrumentCategory.create({ data: { name: key("Violão"), createdById: author.id } })
    ]);
    ids.categories.push(bassCategory.id, guitarCategory.id);
    const members = await Promise.all(["João", "Mirian", "Ana", "Três", "Backing", "Substituto", "Divergente"].map((name) => prisma.member.create({ data: { name: `${key(name)} ${name}` } })));
    ids.members.push(...members.map((member) => member.id));
    const [joaoUser, anaUser] = await Promise.all([
      prisma.user.create({ data: { name: key("user_joao"), username: key("user_joao"), email: `${key("user_joao")}@example.test`, passwordHash: key("hash_joao"), memberId: members[0].id } }),
      prisma.user.create({ data: { name: key("user_ana"), username: key("user_ana"), email: `${key("user_ana")}@example.test`, passwordHash: key("hash_ana"), memberId: members[2].id } })
    ]);
    ids.users.push(joaoUser.id, anaUser.id);
    const schedules = await Promise.all(members.map((_, index) => prisma.schedule.create({ data: { title: key(`schedule_${index}`), ministryId: ministry.id, date: new Date(`2099-03-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`), status: ScheduleStatus.PUBLISHED, publishedAt: new Date(), createdById: author.id } })));
    ids.schedules.push(...schedules.map((schedule) => schedule.id));
    const createParticipant = (index: number, role: ScheduleMemberRole, roles: ScheduleMemberRole[], status: ScheduleMemberStatus, replacedByMemberId?: string) => prisma.scheduleMember.create({ data: { scheduleId: schedules[index].id, memberId: members[index].id, role, status, replacedByMemberId, createdById: author.id, roles: { create: roles.map((assignedRole) => ({ role: assignedRole })) } } });
    const [joao, mirian, ana, three, backing, replaced, divergent] = await Promise.all([
      createParticipant(0, ScheduleMemberRole.BACKING, [ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT], ScheduleMemberStatus.PENDING),
      createParticipant(1, ScheduleMemberRole.LEADER, [ScheduleMemberRole.LEADER, ScheduleMemberRole.MINISTER], ScheduleMemberStatus.CONFIRMED),
      createParticipant(2, ScheduleMemberRole.MINISTER, [ScheduleMemberRole.MINISTER, ScheduleMemberRole.INSTRUMENT], ScheduleMemberStatus.DECLINED),
      createParticipant(3, ScheduleMemberRole.BACKING, [ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT, ScheduleMemberRole.LEADER], ScheduleMemberStatus.ABSENT),
      createParticipant(4, ScheduleMemberRole.BACKING, [ScheduleMemberRole.BACKING], ScheduleMemberStatus.PENDING),
      createParticipant(5, ScheduleMemberRole.BACKING, [ScheduleMemberRole.BACKING], ScheduleMemberStatus.REPLACED, members[0].id),
      createParticipant(6, ScheduleMemberRole.BACKING, [ScheduleMemberRole.INSTRUMENT], ScheduleMemberStatus.PENDING)
    ]);
    await Promise.all([
      prisma.scheduleMemberInstrumentAssignment.create({ data: { scheduleMemberId: joao.id, instrumentCategoryId: bassCategory.id, source: ScheduleInstrumentSource.OWN, createdById: author.id } }),
      prisma.scheduleMemberInstrumentAssignment.create({ data: { scheduleMemberId: ana.id, instrumentCategoryId: guitarCategory.id, source: ScheduleInstrumentSource.OWN, createdById: author.id } }),
      prisma.scheduleMemberInstrumentAssignment.create({ data: { scheduleMemberId: three.id, instrumentCategoryId: bassCategory.id, source: ScheduleInstrumentSource.OWN, createdById: author.id } }),
      prisma.scheduleMemberInstrumentAssignment.create({ data: { scheduleMemberId: divergent.id, instrumentCategoryId: bassCategory.id, source: ScheduleInstrumentSource.OWN, createdById: author.id } })
    ]);
    await prisma.instrumentCategory.update({ where: { id: bassCategory.id }, data: { isActive: false } });

    const sessions = members.map((member, index) => ({ id: index === 0 ? joaoUser.id : index === 2 ? anaUser.id : author.id, memberId: member.id }));
    const [joaoList, mirianList, anaList, threeList, backingList, replacedList, divergentList] = await Promise.all(sessions.map((session) => myScheduleService.list(session, { includeCompleted: true })));
    await test("fixture Joao retorna um card", () => assert.equal(joaoList.schedules.filter((item) => item.id === joao.id).length, 1));
    await test("fixture Joao apresenta Baixo e Backing", () => assert.equal(getScheduleMemberDisplayRoles(joaoList.schedules[0], joaoList.schedules[0].instrumentAssignment), `${bassCategory.name} • Backing`));
    await test("fixture Mirian apresenta Lider e Ministro", () => {
      assert.equal(mirianList.schedules[0].id, mirian.id);
      assert.equal(getScheduleMemberDisplayRoles(mirianList.schedules[0], mirianList.schedules[0].instrumentAssignment), "Líder • Ministro");
    });
    await test("fixture Ana apresenta Ministro e Violao", () => assert.equal(getScheduleMemberDisplayRoles(anaList.schedules[0], anaList.schedules[0].instrumentAssignment), `Ministro • ${guitarCategory.name}`));
    await test("fixture de tres roles preserva todas", () => assert.equal(getScheduleMemberDisplayRoles(threeList.schedules[0], threeList.schedules[0].instrumentAssignment), `Líder • ${bassCategory.name} • Backing`));
    await test("categoria inativa continua no DTO funcional", () => assert.equal(joaoList.schedules[0].instrumentAssignment?.instrumentCategory.name, bassCategory.name));
    await test("status PENDING permanece unico", () => assert.equal(joaoList.schedules[0].status, ScheduleMemberStatus.PENDING));
    await test("status CONFIRMED permanece unico", () => assert.equal(mirianList.schedules[0].status, ScheduleMemberStatus.CONFIRMED));
    await test("status DECLINED permanece unico", () => assert.equal(anaList.schedules[0].status, ScheduleMemberStatus.DECLINED));
    await test("status ABSENT permanece unico", () => assert.equal(threeList.schedules[0].status, ScheduleMemberStatus.ABSENT));
    await test("status REPLACED permanece unico", () => assert.equal(replacedList.schedules.find((item) => item.id === replaced.id)?.status, ScheduleMemberStatus.REPLACED));
    await test("membro excecao nao depende de vinculo ministerial", async () => assert.equal(await prisma.memberMinistry.count({ where: { memberId: joao.memberId } }), 0));
    await test("BACKING e INSTRUMENT permanecem elegiveis no service", async () => assert.equal((await myScheduleService.getInstrumentChange(joao.id, sessions[0])).category?.id, bassCategory.id));
    await test("BACKING isolado e bloqueado no service", async () => assert.rejects(() => myScheduleService.getInstrumentChange(backing.id, sessions[4]), (error: unknown) => errorCode(error) === "SCHEDULE_INSTRUMENT_ROLE_REQUIRED"));
    await test("role legado divergente nao bloqueia self-service", async () => {
      assert.equal(hasInstrumentRole(divergentList.schedules[0]), true);
      assert.equal((await myScheduleService.getInstrumentChange(divergent.id, sessions[6])).category?.id, bassCategory.id);
    });
    await test("IDOR usa dois usuarios temporarios distintos", () => {
      assert.notEqual(sessions[0].id, sessions[2].id);
      assert.equal(sessions[0].memberId, members[0].id);
      assert.equal(sessions[2].memberId, members[2].id);
    });
    await test("IDOR funcional nao revela participacao de outro membro", async () => assert.rejects(() => myScheduleService.getById(ana.id, sessions[0]), (error: unknown) => errorCode(error) === "MY_SCHEDULE_NOT_FOUND"));
    const portalSchedule = await dashboardRepository.findNextScheduleForMember(members[0].id);
    await test("Dashboard funcional carrega uma participacao", () => assert.equal(portalSchedule?.id, joao.id));
    await test("Dashboard funcional carrega roles e categoria", () => {
      assert.ok(portalSchedule);
      assert.equal(getScheduleMemberDisplayRoles(portalSchedule, portalSchedule.instrumentAssignments[0]), `${bassCategory.name} • Backing`);
    });
    await test("DTO funcional nao expoe patrimonio ou usuario", () => {
      const serialized = JSON.stringify(joaoList.schedules[0]);
      assert.doesNotMatch(serialized, /passwordHash|username|createdBy|Tagima|Yamaha/);
    });
    await test("BACKING isolado continua sem assignment", () => assert.equal(backingList.schedules[0].instrumentAssignment, null));
  } finally {
    if (ids.schedules.length) {
      await prisma.scheduleMemberInstrumentAssignment.deleteMany({ where: { scheduleMember: { scheduleId: { in: ids.schedules } } } });
      await prisma.scheduleMemberRoleAssignment.deleteMany({ where: { scheduleMember: { scheduleId: { in: ids.schedules } } } });
      await prisma.scheduleMember.deleteMany({ where: { scheduleId: { in: ids.schedules } } });
      await prisma.schedule.deleteMany({ where: { id: { in: ids.schedules } } });
    }
    if (ids.categories.length) await prisma.instrumentCategory.deleteMany({ where: { id: { in: ids.categories } } });
    if (ids.users.length) await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
    if (ids.members.length) await prisma.member.deleteMany({ where: { id: { in: ids.members } } });
    if (ids.ministry) await prisma.ministry.deleteMany({ where: { id: ids.ministry } });
    await prisma.$disconnect();
  }

  assert.ok(scenarios >= 34, "A suite deve manter ao menos 34 cenarios permanentes.");
  console.log(`Portal multiple schedule roles: ${scenarios} scenarios passed.`);
}

void main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : "Portal multiple schedule roles tests failed.");
  await prisma.$disconnect();
  process.exitCode = 1;
});
