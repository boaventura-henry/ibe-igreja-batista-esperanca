import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  PrismaClient,
  ScheduleInstrumentSource,
  ScheduleMemberRole,
  ScheduleMemberStatus,
  ScheduleScope
} from "@prisma/client";
import {
  getScheduleMemberDisplayRoles,
  getScheduleMemberRoles
} from "../src/lib/schedule-member-role";
import {
  scheduleMemberCountLabel,
  scheduleRemainingMembersLabel,
  summarizeScheduleMembers
} from "../src/lib/schedule-member-summary";
import type { ScheduleAuthorization } from "../src/lib/schedule-authorization";
import { scheduleService } from "../src/services/schedule.service";
import { scheduleListQuerySchema } from "../src/validators/schedule.validator";

const prisma = new PrismaClient();
const stamp = Date.now().toString();
const key = (suffix: string) => `__schedule_display_${stamp}_${suffix}`;
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

function displayMember(id: string, displayName: string) {
  return { id: `participant-${id}`, member: { id, name: displayName, displayName } };
}

async function main() {
  requireDevelopmentDatasource();
  const [helperSource, summarySource, namesSource, detailSource, managerSource, repositorySource, serviceSource, portalSource, notificationSource] = await Promise.all([
    readFile("src/lib/schedule-member-role.ts", "utf8"),
    readFile("src/lib/schedule-member-summary.ts", "utf8"),
    readFile("src/components/schedules/ScheduleMemberNames.tsx", "utf8"),
    readFile("src/components/schedules/ScheduleDetailManager.tsx", "utf8"),
    readFile("src/components/schedules/ScheduleManager.tsx", "utf8"),
    readFile("src/repositories/schedule.repository.ts", "utf8"),
    readFile("src/services/schedule.service.ts", "utf8"),
    readFile("src/components/portal/PortalDashboard.tsx", "utf8"),
    readFile("src/services/schedule-notification.service.ts", "utf8")
  ]);
  const bass = { instrumentCategory: { name: "Baixo" } };
  const guitar = { instrumentCategory: { name: "Violão" } };

  await test("LEADER singular", () => assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.LEADER] }), "Líder"));
  await test("LEADER mais MINISTER", () => assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.LEADER, ScheduleMemberRole.MINISTER] }), "Líder • Ministro"));
  await test("BACKING mais INSTRUMENT", () => assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT] }, bass), "Baixo • Backing"));
  await test("MINISTER mais INSTRUMENT", () => assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.MINISTER, ScheduleMemberRole.INSTRUMENT] }, guitar), "Ministro • Violão"));
  await test("INSTRUMENT usa categoria", () => assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.INSTRUMENT] }, guitar), "Violão"));
  await test("INSTRUMENT sem categoria usa fallback", () => assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.INSTRUMENT] }), "Instrumento"));
  await test("patrimonio nao aparece", () => assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.INSTRUMENT] }, { instrumentCategory: { name: "Baixo" }, instrument: { name: "Tagima Millennium Top 5" } } as never), "Baixo"));
  await test("duas roles geram uma unica apresentacao", () => assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.LEADER, ScheduleMemberRole.MINISTER] }).split(" • ").length, 2));
  await test("tres roles", () => assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.BACKING, ScheduleMemberRole.LEADER, ScheduleMemberRole.INSTRUMENT] }, bass), "Líder • Baixo • Backing"));
  await test("ordem deterministica independe da entrada", () => assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.MINISTER, ScheduleMemberRole.LEADER] }), getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.LEADER, ScheduleMemberRole.MINISTER] })));
  await test("BACKING e INSTRUMENT independem da ordem de entrada", () => assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.INSTRUMENT, ScheduleMemberRole.BACKING] }, bass), "Baixo • Backing"));
  await test("VOCAL e INSTRUMENT seguem ordem visual unica", () => assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.INSTRUMENT, ScheduleMemberRole.VOCAL] }, bass), "Vocal • Baixo"));
  await test("tres roles independem da ordem de entrada", () => {
    const expected = "Líder • Baixo • Backing";
    assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.INSTRUMENT, ScheduleMemberRole.LEADER, ScheduleMemberRole.BACKING] }, bass), expected);
    assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT, ScheduleMemberRole.LEADER] }, bass), expected);
  });
  await test("duplicatas defensivas nao repetem labels", () => assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.BACKING, ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT] }, bass), "Baixo • Backing"));
  await test("INSTRUMENT sem categoria permanece visivel com BACKING", () => assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT] }), "Instrumento • Backing"));
  await test("roles carregadas prevalecem", () => assert.equal(getScheduleMemberDisplayRoles({ role: ScheduleMemberRole.VOCAL, roles: [ScheduleMemberRole.LEADER] }), "Líder"));
  await test("roles vazias nao recorrem ao legado", () => assert.equal(getScheduleMemberDisplayRoles({ role: ScheduleMemberRole.VOCAL, roles: [] }), "Função não informada"));
  await test("fallback legado somente sem colecao", () => assert.equal(getScheduleMemberDisplayRoles({ role: ScheduleMemberRole.VOCAL }), "Vocal"));
  await test("categoria historica inativa permanece legivel", () => assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.INSTRUMENT] }, { instrumentCategory: { name: "Baixo", isActive: false } } as never), "Baixo"));
  await test("instrumento inativo nao altera categoria", () => assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.INSTRUMENT] }, { instrumentCategory: { name: "Baixo" }, instrument: { status: "INACTIVE" } } as never), "Baixo"));
  await test("detalhe usa helper multiplo", () => assert.match(detailSource, /getScheduleMemberDisplayRoles\(item, item\.instrumentAssignment\)/));
  await test("detalhe usa label FUNÇÕES", () => assert.match(detailSource, />Funções<\/th>/));
  await test("zero membros possui label amigavel", () => assert.equal(scheduleMemberCountLabel(0), "Nenhum membro"));
  await test("um membro possui singular", () => assert.equal(scheduleMemberCountLabel(1), "1 membro"));
  await test("varios membros possuem plural", () => assert.equal(scheduleMemberCountLabel(6), "6 membros"));
  await test("quantidade permanece no componente", () => assert.match(managerSource, /memberCount=\{schedule\.memberCount\}/));
  await test("plural +1 membro", () => assert.equal(scheduleRemainingMembersLabel(1), "+1 membro"));
  await test("plural +N membros", () => assert.equal(scheduleRemainingMembersLabel(3), "+3 membros"));
  const six = ["Mírian", "Felipe", "Ana Júlia", "João", "Carlos", "Vinicius"].map((name, index) => displayMember(String(index), name));
  await test("mobile limita por participantes completos", () => assert.deepEqual(summarizeScheduleMembers(six, 3), { names: ["Mírian", "Felipe", "Ana Júlia"], remaining: 3, remainingLabel: "+3 membros" }));
  await test("desktop limita cinco participantes completos", () => assert.deepEqual(summarizeScheduleMembers(six, 5), { names: ["Mírian", "Felipe", "Ana Júlia", "João", "Carlos"], remaining: 1, remainingLabel: "+1 membro" }));
  await test("um participante nao gera resumo restante", () => assert.deepEqual(summarizeScheduleMembers([displayMember("1", "Mírian")], 3), { names: ["Mírian"], remaining: 0, remainingLabel: null }));
  await test("nomes nao sao cortados por caracteres", () => assert.deepEqual(summarizeScheduleMembers([displayMember("1", "Felipe Mateus Gaioto de França")], 3).names, ["Felipe Mateus Gaioto de França"]));
  await test("Member inativo ou removido nao e filtrado no select relacional", () => assert.doesNotMatch(repositorySource.match(/const scheduleListSelect[\s\S]*?satisfies Prisma\.ScheduleSelect/)?.[0] ?? "", /member:\s*\{\s*where:/));
  await test("ordem dos participantes preserva regra existente", () => assert.match(repositorySource, /orderBy: \[\{ role: "asc" \}, \{ member: \{ name: "asc" \} \}\]/));
  await test("REPLACED nao recebe filtro novo", () => assert.doesNotMatch(repositorySource.match(/const scheduleListSelect[\s\S]*?satisfies Prisma\.ScheduleSelect/)?.[0] ?? "", /status:\s*\{\s*not:/));
  await test("listagem nao duplica membro por role", () => assert.doesNotMatch(repositorySource.match(/const scheduleListSelect[\s\S]*?satisfies Prisma\.ScheduleSelect/)?.[0] ?? "", /roles:/));
  await test("DTO da listagem nao envia dados privados", () => assert.doesNotMatch(serviceSource.match(/function serializeListItem[\s\S]*?\n\}/)?.[0] ?? "", /email|username|user:|instrumentAssignment/));
  await test("paginacao continua por Schedule", () => assert.match(repositorySource, /prisma\.schedule\.findMany\([\s\S]*?skip,[\s\S]*?take: filters\.pageSize/));
  await test("consulta relacional evita N mais 1", () => assert.match(repositorySource, /select: scheduleListSelect/));
  await test("listagem nao consulta membros por escala em loop", () => {
    const listMethod = repositorySource.match(/async list\([\s\S]*?return \{ schedules, total \};\s*\}/)?.[0] ?? "";
    assert.match(listMethod, /prisma\.schedule\.findMany/);
    assert.doesNotMatch(listMethod, /\.map\([\s\S]*?(?:scheduleMember|findMembers|findMany)/);
  });
  await test("select resumido nao fabrica substituto como participante", () => assert.doesNotMatch(repositorySource.match(/const scheduleListSelect[\s\S]*?satisfies Prisma\.ScheduleSelect/)?.[0] ?? "", /replacedByMember/));
  await test("Portal usa o helper multiplo", () => {
    assert.match(portalSource, /getScheduleMemberDisplayRoles\(/);
    assert.doesNotMatch(portalSource, /getScheduleMemberDisplayRole\(/);
  });
  await test("notificacoes continuam no helper singular", () => assert.match(notificationSource, /getScheduleMemberDisplayRole/));
  await test("resumo mobile e desktop usam limites por participante", () => {
    assert.match(summarySource, /members\.slice/);
    assert.match(managerSource, /ScheduleMemberNames/);
  });
  await test("helper multiplo e fonte unica no detalhe", () => assert.match(helperSource, /export function getScheduleMemberDisplayRoles/));
  await test("roles vazias continuam distintas do legado", () => assert.deepEqual(getScheduleMemberRoles({ role: ScheduleMemberRole.LEADER, roles: [] }), []));
  await test("detalhe permite quebra natural sem largura excessiva", () => assert.match(detailSource, /min-w-32 max-w-56 whitespace-normal break-words/));
  await test("listagem usa tres nomes no mobile e cinco no desktop", async () => {
    assert.match(namesSource, /sm:hidden[\s\S]*limit=\{3\}/);
    assert.match(namesSource, /hidden sm:block[\s\S]*limit=\{5\}/);
  });
  await test("resumo responsivo e seguro para SSR", () => {
    assert.doesNotMatch(namesSource, /window|matchMedia|innerWidth|useEffect|useState/);
    assert.match(namesSource, /sm:hidden/);
    assert.match(namesSource, /hidden sm:block/);
  });

  const author = await prisma.user.findFirst({ where: { isActive: true }, select: { id: true } });
  assert.ok(author, "Development precisa conter usuario ativo para autoria dos fixtures.");
  const ids = { ministry: "", category: "", members: [] as string[], schedules: [] as string[] };
  const authorization = {
    user: { id: author.id },
    accessContext: { scope: ScheduleScope.ALL, memberId: null, authorizedMinistryIds: null }
  } as unknown as ScheduleAuthorization;

  try {
    const ministry = await prisma.ministry.create({ data: { name: key("ministry"), slug: key("ministry") } });
    ids.ministry = ministry.id;
    const category = await prisma.instrumentCategory.create({ data: { name: key("Baixo"), createdById: author.id } });
    ids.category = category.id;
    const members = await Promise.all(["Mírian", "João", "Carlos", "Felipe", "Ana Júlia", "Vinicius"].map((name, index) => prisma.member.create({ data: { name: `${key(name)} ${name}`, nickname: index === 0 ? "Mírian" : null } })));
    ids.members.push(...members.map((member) => member.id));
    const schedules = await Promise.all(["A", "B", "C"].map((suffix, index) => prisma.schedule.create({ data: { title: `${key("fixture")} ${suffix}`, ministryId: ministry.id, date: new Date(`2099-01-${10 + index}T00:00:00.000Z`), createdById: author.id } })));
    ids.schedules.push(...schedules.map((schedule) => schedule.id));
    const createParticipant = (scheduleId: string, memberId: string, role: ScheduleMemberRole, roles: ScheduleMemberRole[]) => prisma.scheduleMember.create({ data: { scheduleId, memberId, role, status: ScheduleMemberStatus.PENDING, createdById: author.id, roles: { create: roles.map((assignedRole) => ({ role: assignedRole })) } } });
    const [mirian, joao] = await Promise.all([
      createParticipant(schedules[0].id, members[0].id, ScheduleMemberRole.LEADER, [ScheduleMemberRole.LEADER, ScheduleMemberRole.MINISTER]),
      createParticipant(schedules[0].id, members[1].id, ScheduleMemberRole.BACKING, [ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT]),
      createParticipant(schedules[0].id, members[2].id, ScheduleMemberRole.VOCAL, [ScheduleMemberRole.VOCAL])
    ]);
    await prisma.scheduleMemberInstrumentAssignment.create({ data: { scheduleMemberId: joao.id, instrumentCategoryId: category.id, source: ScheduleInstrumentSource.OWN, createdById: author.id } });
    await Promise.all(members.map((member, index) => prisma.scheduleMember.create({ data: { scheduleId: schedules[2].id, memberId: member.id, role: ScheduleMemberRole.OTHER, status: index === 5 ? ScheduleMemberStatus.REPLACED : ScheduleMemberStatus.PENDING, createdById: author.id, roles: { create: { role: ScheduleMemberRole.OTHER } } } })));
    await prisma.instrumentCategory.update({ where: { id: category.id }, data: { isActive: false } });

    const filters = scheduleListQuerySchema.parse({ search: key("fixture"), includeCompleted: "true", pageSize: "10" });
    const list = await scheduleService.list(filters, authorization);
    const detail = await scheduleService.getById(schedules[0].id, authorization);
    await test("listagem funcional retorna as tres escalas fixtures", () => assert.equal(list.schedules.length, 3));
    await test("escala sem participantes retorna zero", () => assert.equal(list.schedules.find((item) => item.id === schedules[1].id)?.memberCount, 0));
    await test("escala com seis participantes conta ScheduleMembers", () => assert.equal(list.schedules.find((item) => item.id === schedules[2].id)?.memberCount, 6));
    await test("multiplas roles nao aumentam memberCount", () => assert.equal(list.schedules.find((item) => item.id === schedules[0].id)?.memberCount, 3));
    await test("REPLACED preserva a contagem historica de ScheduleMember", () => assert.equal(list.schedules.find((item) => item.id === schedules[2].id)?.memberCount, 6));
    await test("DTO funcional reutiliza nickname como displayName", () => {
      const participant = list.schedules.find((item) => item.id === schedules[0].id)?.members.find((item) => item.member.id === members[0].id);
      assert.equal(participant?.member.displayName, "Mírian");
      assert.match(participant?.member.name ?? "", /Mírian$/);
    });
    await test("detalhe funcional apresenta Lider e Ministro uma vez", () => {
      const participant = detail.members.find((item) => item.id === mirian.id);
      assert.ok(participant);
      assert.equal(getScheduleMemberDisplayRoles(participant, participant.instrumentAssignment), "Líder • Ministro");
    });
    await test("detalhe funcional apresenta categoria e Backing", () => {
      const participant = detail.members.find((item) => item.id === joao.id);
      assert.ok(participant);
      assert.equal(getScheduleMemberDisplayRoles(participant, participant.instrumentAssignment), `${category.name} • Backing`);
    });
    await test("DTO funcional nao possui roles nem patrimonio na listagem", () => {
      const participant = list.schedules.find((item) => item.id === schedules[0].id)?.members[0] as unknown as Record<string, unknown>;
      assert.ok(participant);
      const member = participant.member as Record<string, unknown>;
      assert.equal("roles" in participant, false);
      assert.equal("instrumentAssignment" in participant, false);
      assert.equal("email" in member, false);
    });
  } finally {
    if (ids.schedules.length) {
      await prisma.scheduleMemberInstrumentAssignment.deleteMany({ where: { scheduleMember: { scheduleId: { in: ids.schedules } } } });
      await prisma.scheduleMemberRoleAssignment.deleteMany({ where: { scheduleMember: { scheduleId: { in: ids.schedules } } } });
      await prisma.scheduleMember.deleteMany({ where: { scheduleId: { in: ids.schedules } } });
      await prisma.schedule.deleteMany({ where: { id: { in: ids.schedules } } });
    }
    if (ids.category) await prisma.instrumentCategory.delete({ where: { id: ids.category } });
    if (ids.members.length) await prisma.member.deleteMany({ where: { id: { in: ids.members } } });
    if (ids.ministry) await prisma.ministry.delete({ where: { id: ids.ministry } });
    await prisma.$disconnect();
  }

  assert.equal(scenarios, 58, "A suite deve manter os cenarios obrigatorios do Gate.");
  console.log(`Schedule multiple roles display: ${scenarios} scenarios passed.`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Schedule multiple roles display tests failed.");
  process.exitCode = 1;
});
