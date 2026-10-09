import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  PrismaClient,
  ScheduleInstrumentSource,
  ScheduleMemberRole,
  ScheduleScope,
  ScheduleStatus
} from "@prisma/client";
import { AppError } from "../src/lib/errors";
import type { ScheduleAuthorization } from "../src/lib/schedule-authorization";
import { scheduleService } from "../src/services/schedule.service";
import { scheduleCreateSchema } from "../src/validators/schedule.validator";

const id = (digit: string) => `cm${digit.repeat(23)}`;
const base = {
  title: "Escala de teste",
  ministryId: id("1"),
  date: "2026-10-08"
};

const prisma = new PrismaClient();

async function runFunctionalScenarios() {
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const key = (suffix: string) => `__initial_team_${stamp}_${suffix}`;
  const user = await prisma.user.findFirst({ where: { isActive: true }, select: { id: true } });
  assert.ok(user, "51: Development possui usuario ativo para autoria das fixtures");

  const allAuthorization = (permissionCodes: string[]): ScheduleAuthorization => ({
    user: { id: user.id, permissionCodes },
    accessContext: { scope: ScheduleScope.ALL, memberId: null, authorizedMinistryIds: null }
  }) as unknown as ScheduleAuthorization;

  const ministry = await prisma.ministry.create({
    data: { name: key("ministry"), slug: key("ministry") }
  });
  const members = await Promise.all([
    prisma.member.create({ data: { name: key("member_a") } }),
    prisma.member.create({ data: { name: key("member_b") } })
  ]);
  const categories = await Promise.all([
    prisma.instrumentCategory.create({ data: { name: key("category_a"), createdById: user.id } }),
    prisma.instrumentCategory.create({ data: { name: key("category_b"), createdById: user.id } })
  ]);
  const instrument = await prisma.instrument.create({
    data: {
      name: key("instrument"),
      categoryId: categories[0].id,
      ministryId: ministry.id,
      createdById: user.id
    }
  });
  await Promise.all(members.map((member) => prisma.memberMinistry.create({
    data: { memberId: member.id, ministryId: ministry.id, entryDate: new Date("2099-01-01") }
  })));

  try {
    const success = await scheduleService.create({
      title: key("success"),
      ministryId: ministry.id,
      date: "2099-11-01",
      startTime: "19:00",
      status: ScheduleStatus.DRAFT,
      initialMembers: [
        { memberId: members[0].id, roles: [ScheduleMemberRole.VOCAL, ScheduleMemberRole.BACKING], allowMinistryException: false },
        {
          memberId: members[1].id,
          roles: [ScheduleMemberRole.INSTRUMENT],
          allowMinistryException: false,
          instrumentAssignment: {
            source: ScheduleInstrumentSource.OWN,
            instrumentCategoryId: categories[0].id,
            instrumentId: null
          }
        }
      ]
    }, allAuthorization(["schedule.create", "schedule.update"]));
    const persisted = await prisma.schedule.findUnique({
      where: { id: success.id },
      include: { members: { include: { roles: true, instrumentAssignments: true } } }
    });
    assert.equal(persisted?.members.length, 2, "52: criacao atomica persiste os dois participantes");
    assert.equal(persisted?.members.flatMap((member) => member.roles).length, 3, "53: criacao atomica persiste todas as roles");
    assert.equal(persisted?.members.flatMap((member) => member.instrumentAssignments).length, 1, "54: criacao atomica persiste o assignment");
    assert.equal(persisted?.notificationVersion, 0, "55: DRAFT nao incrementa notificationVersion");
    assert.equal(await prisma.notification.count({ where: { entityId: success.id } }), 0, "56: DRAFT nao cria notificacao nem reminder");

    const before = {
      schedules: await prisma.schedule.count({ where: { title: { startsWith: key("") } } }),
      members: await prisma.scheduleMember.count({ where: { memberId: { in: members.map((member) => member.id) } } }),
      roles: await prisma.scheduleMemberRoleAssignment.count({ where: { scheduleMember: { memberId: { in: members.map((member) => member.id) } } } }),
      assignments: await prisma.scheduleMemberInstrumentAssignment.count({ where: { scheduleMember: { memberId: { in: members.map((member) => member.id) } } } })
    };
    await assert.rejects(
      () => scheduleService.create({
        title: key("rollback"),
        ministryId: ministry.id,
        date: "2099-11-02",
        startTime: "19:00",
        status: ScheduleStatus.DRAFT,
        initialMembers: [
          {
            memberId: members[0].id,
            roles: [ScheduleMemberRole.INSTRUMENT],
            allowMinistryException: false,
            instrumentAssignment: {
              source: ScheduleInstrumentSource.REGISTERED,
              instrumentCategoryId: categories[0].id,
              instrumentId: instrument.id
            }
          },
          {
            memberId: members[1].id,
            roles: [ScheduleMemberRole.INSTRUMENT],
            allowMinistryException: false,
            instrumentAssignment: {
              source: ScheduleInstrumentSource.REGISTERED,
              instrumentCategoryId: categories[1].id,
              instrumentId: instrument.id
            }
          }
        ]
      }, allAuthorization(["schedule.create", "schedule.update"])),
      (error: unknown) => error instanceof AppError && error.code === "SCHEDULE_INSTRUMENT_INVALID",
      "57: falha no segundo participante interrompe a criacao"
    );
    const after = {
      schedules: await prisma.schedule.count({ where: { title: { startsWith: key("") } } }),
      members: await prisma.scheduleMember.count({ where: { memberId: { in: members.map((member) => member.id) } } }),
      roles: await prisma.scheduleMemberRoleAssignment.count({ where: { scheduleMember: { memberId: { in: members.map((member) => member.id) } } } }),
      assignments: await prisma.scheduleMemberInstrumentAssignment.count({ where: { scheduleMember: { memberId: { in: members.map((member) => member.id) } } } })
    };
    assert.deepEqual(after, before, "58: rollback remove Schedule, participantes, roles e assignments da tentativa");

    await scheduleService.create({
      title: key("create_only"),
      ministryId: ministry.id,
      date: "2099-11-03",
      status: ScheduleStatus.DRAFT
    }, allAuthorization(["schedule.create"]));
    await assert.rejects(
      () => scheduleService.create({
        title: key("forbidden_team"),
        ministryId: ministry.id,
        date: "2099-11-04",
        status: ScheduleStatus.DRAFT,
        initialMembers: [{ memberId: members[0].id, roles: [ScheduleMemberRole.VOCAL], allowMinistryException: false }]
      }, allAuthorization(["schedule.create"])),
      (error: unknown) => error instanceof AppError && error.code === "SCHEDULE_INITIAL_TEAM_FORBIDDEN",
      "59: equipe inicial exige schedule.update"
    );
    const restricted = {
      user: { id: user.id, permissionCodes: ["schedule.create", "schedule.update"] },
      accessContext: { scope: ScheduleScope.MEMBER_MINISTRIES, memberId: members[0].id, authorizedMinistryIds: [] }
    } as unknown as ScheduleAuthorization;
    await assert.rejects(
      () => scheduleService.create({ title: key("forbidden_scope"), ministryId: ministry.id, date: "2099-11-05", status: ScheduleStatus.DRAFT }, restricted),
      (error: unknown) => error instanceof AppError && error.code === "SCHEDULE_MINISTRY_FORBIDDEN",
      "60: MEMBER_MINISTRIES preserva o scope"
    );
  } finally {
    const schedules = await prisma.schedule.findMany({
      where: { title: { startsWith: key("") } },
      select: { id: true }
    });
    const scheduleIds = schedules.map((schedule) => schedule.id);
    if (scheduleIds.length) {
      await prisma.scheduleMemberInstrumentAssignment.deleteMany({ where: { scheduleMember: { scheduleId: { in: scheduleIds } } } });
      await prisma.scheduleMemberRoleAssignment.deleteMany({ where: { scheduleMember: { scheduleId: { in: scheduleIds } } } });
      await prisma.scheduleMember.deleteMany({ where: { scheduleId: { in: scheduleIds } } });
      await prisma.schedule.deleteMany({ where: { id: { in: scheduleIds } } });
    }
    await prisma.instrument.deleteMany({ where: { id: instrument.id } });
    await prisma.memberMinistry.deleteMany({ where: { memberId: { in: members.map((member) => member.id) } } });
    await prisma.member.deleteMany({ where: { id: { in: members.map((member) => member.id) } } });
    await prisma.instrumentCategory.deleteMany({ where: { id: { in: categories.map((category) => category.id) } } });
    await prisma.ministry.deleteMany({ where: { id: ministry.id } });
  }
}

async function main() {
  const [manager, editor, service, repository, validator, createRoute, oldMemberRoute, oldAvailableRoute] = await Promise.all([
    readFile("src/components/schedules/ScheduleManager.tsx", "utf8"),
    readFile("src/components/schedules/ScheduleMemberBasicEditor.tsx", "utf8"),
    readFile("src/services/schedule.service.ts", "utf8"),
    readFile("src/repositories/schedule.repository.ts", "utf8"),
    readFile("src/validators/schedule.validator.ts", "utf8"),
    readFile("src/app/api/schedules/route.ts", "utf8"),
    readFile("src/app/api/schedules/[id]/members/route.ts", "utf8"),
    readFile("src/app/api/schedules/[id]/available-members/route.ts", "utf8")
  ]);

  assert.equal(scheduleCreateSchema.safeParse(base).success, true, "1: criacao sem initialMembers permanece valida");
  assert.equal(scheduleCreateSchema.safeParse({ ...base, initialMembers: [] }).success, true, "2: array vazio permanece equivalente");
  assert.equal(scheduleCreateSchema.safeParse({ ...base, initialMembers: [{ memberId: id("2"), roles: [ScheduleMemberRole.VOCAL] }] }).success, true, "3: aceita um participante");
  assert.equal(scheduleCreateSchema.safeParse({ ...base, initialMembers: [{ memberId: id("2"), roles: [ScheduleMemberRole.VOCAL] }, { memberId: id("3"), roles: [ScheduleMemberRole.BACKING] }] }).success, true, "4: aceita varios participantes");
  assert.equal(scheduleCreateSchema.safeParse({ ...base, initialMembers: [{ memberId: id("2"), roles: [ScheduleMemberRole.VOCAL, ScheduleMemberRole.BACKING] }] }).success, true, "5: aceita multiplas roles");
  assert.equal(scheduleCreateSchema.safeParse({ ...base, initialMembers: [{ memberId: id("2"), roles: [ScheduleMemberRole.INSTRUMENT], instrumentAssignment: { source: "REGISTERED", instrumentCategoryId: id("4"), instrumentId: id("5") } }] }).success, true, "6: aceita REGISTERED completo");
  assert.equal(scheduleCreateSchema.safeParse({ ...base, initialMembers: [{ memberId: id("2"), roles: [ScheduleMemberRole.INSTRUMENT], instrumentAssignment: { source: "OWN", instrumentCategoryId: id("4"), instrumentId: null } }] }).success, true, "7: aceita OWN sem patrimonio");
  assert.equal(scheduleCreateSchema.safeParse({ ...base, initialMembers: [{ memberId: id("2"), roles: [ScheduleMemberRole.VOCAL] }, { memberId: id("2"), roles: [ScheduleMemberRole.BACKING] }] }).success, false, "8: rejeita membro duplicado");
  assert.equal(scheduleCreateSchema.safeParse({ ...base, initialMembers: [{ memberId: id("2"), roles: ["INVALID"] }] }).success, false, "9: rejeita role invalida");
  assert.equal(scheduleCreateSchema.safeParse({ ...base, initialMembers: [{ memberId: id("2"), roles: [ScheduleMemberRole.VOCAL, ScheduleMemberRole.VOCAL] }] }).success, false, "10: rejeita role duplicada");
  assert.equal(scheduleCreateSchema.safeParse({ ...base, initialMembers: [{ memberId: id("2"), roles: [] }] }).success, false, "11: exige role");
  assert.equal(scheduleCreateSchema.safeParse({ ...base, initialMembers: [{ memberId: id("2"), roles: [ScheduleMemberRole.INSTRUMENT], instrumentAssignment: { source: "REGISTERED", instrumentCategoryId: id("4") } }] }).success, false, "12: REGISTERED exige instrumento");
  assert.equal(scheduleCreateSchema.safeParse({ ...base, initialMembers: [{ memberId: id("2"), roles: [ScheduleMemberRole.INSTRUMENT], instrumentAssignment: { source: "OWN", instrumentCategoryId: id("4"), instrumentId: id("5") } }] }).success, false, "13: OWN rejeita instrumento");

  assert.match(service, /data\.initialMembers\?\.length[\s\S]*ensureInitialTeamPermission/, "14: equipe exige permissao adicional");
  assert.match(service, /permissionCodes\.includes\("schedule\.update"\)/, "15: permissao adicional e schedule.update");
  assert.match(createRoute, /requireScheduleAccess\("schedule\.create"\)/, "16: criacao preserva schedule.create");
  assert.match(service, /ensureAuthorizedMinistry\(data\.ministryId, authorization\)/, "17: escopo ministerial preservado");
  assert.match(service, /scheduleRepository\.transaction\(async \(database\)[\s\S]*scheduleRepository\.create\(data, authorization\.user\.id, database\)[\s\S]*for \(const initialMember/, "18: escala e equipe usam uma transacao");
  assert.match(repository, /create\(data: ScheduleCreateInput, userId: string, database: ScheduleDatabase = prisma\)/, "19: repository aceita TransactionClient");
  const createBlock = service.slice(service.indexOf("  async create("), service.indexOf("  async update("));
  assert.doesNotMatch(createBlock, /\.addMember\(/, "20: create nao abre transacao aninhada pelo metodo publico");
  assert.match(service, /async function addMemberInTransaction/, "21: nucleo transacional compartilhado existe");
  assert.match(service, /async addMember\([\s\S]*addMemberInTransaction/, "22: fluxo antigo reutiliza o nucleo");
  assert.match(service, /for \(const initialMember[\s\S]*await addMemberInTransaction/, "23: todos os drafts reutilizam o nucleo");
  assert.match(service, /transactionalSchedule\.status|schedule\.status === ScheduleStatus\.PUBLISHED/, "24: notificacao continua condicionada a PUBLISHED");
  assert.doesNotMatch(createBlock, /deliverPush|publishInitial|reminder/, "25: create DRAFT nao notifica nem agenda reminder");
  assert.match(service, /status: ScheduleMemberStatus\.PENDING/, "26: participante inicial nasce PENDING");
  assert.match(validator, /initialMembers: z\.array\(scheduleInitialMemberSchema\)\.optional\(\)/, "27: contrato e opcional");
  assert.match(validator, /new Set\(memberIds\)\.size !== memberIds\.length/, "28: schema protege duplicidade");
  assert.match(service, /ensureMemberRules\(schedule, data, \{ database \}\)/, "29: elegibilidade usa regra canonica");
  assert.match(service, /createInitialAssignmentInTransaction/, "30: instrumento usa regra canonica");

  assert.match(manager, /<ScheduleMemberBasicEditor/, "31: criacao reutiliza editor compartilhado");
  assert.match(editor, /<MemberCombobox/, "32: editor reutiliza MemberCombobox");
  assert.match(manager, /initialMembers\s*\.filter[\s\S]*member\.key !== editingTeamKey/, "33: membro escolhido sai das opcoes");
  assert.match(manager, /setInitialMembers\(\[\]\)[\s\S]*ministerio da escala foi alterado/, "34: mudanca de ministerio limpa drafts");
  assert.match(manager, /submitLock\.current/, "35: trava sincrona protege double submit");
  assert.match(manager, /finally[\s\S]*submitLock\.current = false/, "36: erro libera retry");
  assert.match(manager, /setInitialMembers\(\(current\)[\s\S]*editingTeamKey/, "37: draft pode ser editado");
  assert.match(manager, /removeInitialMember/, "38: draft pode ser removido");
  assert.match(manager, /canManageInitialTeam = canCreate && canUpdate/, "39: UI exige ambas as permissoes");
  assert.match(manager, /initialMembers: initialMembers\.map/, "40: chave local nao compoe o payload");
  assert.match(editor, /md:grid-cols-2/, "41: editor possui layout desktop");
  assert.match(editor, /grid min-w-0 gap-4/, "42: editor inicia em uma coluna no mobile");
  assert.match(editor, /fieldset[\s\S]*legend/, "43: roles e origem possuem agrupamento acessivel");
  assert.match(manager, /aria-busy=\{isSubmitting\}/, "44: submit comunica loading");
  assert.match(oldMemberRoute, /scheduleMemberCreateSchema[\s\S]*scheduleService\.addMember/, "45: endpoint antigo de add permanece");
  assert.match(oldAvailableRoute, /scheduleService\.listAvailableMembers/, "46: endpoint antigo de elegibilidade permanece");

  const createPosition = createBlock.indexOf("scheduleRepository.create");
  const memberPosition = createBlock.indexOf("addMemberInTransaction");
  assert(createPosition >= 0 && memberPosition > createPosition, "47: falha de participante ocorre antes do commit da transacao que criou a escala");
  assert.match(createBlock, /return \(await scheduleRepository\.findByIdWithinScope/, "48: retorno e recarregado dentro da mesma transacao");
  assert.match(manager, /requestId !== membersRequest\.current/, "49: resposta antiga de membros nao sobrescreve o ministerio atual");
  assert.match(manager, /requestId !== instrumentsRequest\.current/, "50: resposta antiga de instrumentos nao sobrescreve a categoria atual");

  await runFunctionalScenarios();
  console.log("Schedule initial team: 60 scenarios passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
