import assert from "node:assert/strict";
import {
  MemberMinistryStatus,
  Prisma,
  PrismaClient,
  ScheduleInstrumentSource,
  ScheduleMemberRole,
  ScheduleMemberStatus,
  ScheduleScope,
  ScheduleStatus
} from "@prisma/client";
import { AppError } from "../src/lib/errors";
import {
  getScheduleMemberRoles,
  hasInstrumentRole,
  normalizeScheduleMemberRoles
} from "../src/lib/schedule-member-role";
import type { ScheduleAuthorization } from "../src/lib/schedule-authorization";
import { myScheduleService } from "../src/services/my-schedule.service";
import { scheduleInstrumentAssignmentService } from "../src/services/schedule-instrument-assignment.service";
import { scheduleService } from "../src/services/schedule.service";
import {
  hasLegacyScheduleMemberRoleField,
  scheduleMemberCreateSchema,
  scheduleMemberUpdateSchema
} from "../src/validators/schedule.validator";

const prisma = new PrismaClient();
const stamp = Date.now().toString();
const key = (value: string) => `__schedule_roles_${stamp}_${value}`;
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
    assert.ok(
      parsed.hostname.startsWith("ep-twilight-haze-adynpvs9"),
      `${variable} deve apontar para o compute Development autorizado.`
    );
    assert.equal(parsed.pathname.replace(/^\//, ""), "ibe", `${variable} deve usar o database ibe.`);
  }
}

async function expectCode(action: () => Promise<unknown>, code: string) {
  await assert.rejects(
    action,
    (error: unknown) => error instanceof AppError && error.code === code
  );
}

function assertRoleSetsEqual(expected: readonly ScheduleMemberRole[], actual: readonly ScheduleMemberRole[]) {
  return expected.length === actual.length && expected.every((role, index) => role === actual[index]);
}

async function main() {
  requireDevelopmentDatasource();

  const ids = {
    ministries: [] as string[],
    members: [] as string[],
    memberMinistries: [] as string[],
    users: [] as string[],
    schedules: [] as string[],
    participants: [] as string[],
    categories: [] as string[],
    instruments: [] as string[]
  };

  const existingParticipants = await prisma.scheduleMember.count();
  const existingWithRoles = await prisma.scheduleMember.count({ where: { roles: { some: {} } } });

  const author = await prisma.user.findFirst({ where: { isActive: true }, select: { id: true } });
  assert.ok(author, "Development precisa conter um usuario ativo para autoria dos fixtures.");
  const authorization = {
    user: { id: author.id },
    accessContext: { scope: ScheduleScope.ALL, memberId: null, authorizedMinistryIds: null }
  } as unknown as ScheduleAuthorization;

  try {
    await test("ordem de roles reutiliza a ordem oficial do enum", () => {
      assert.deepEqual(
        normalizeScheduleMemberRoles([
          ScheduleMemberRole.INSTRUMENT,
          ScheduleMemberRole.LEADER,
          ScheduleMemberRole.BACKING
        ]),
        [ScheduleMemberRole.LEADER, ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT]
      );
    });
    await test("colecao ausente nao possui fallback legado", () => {
      assert.deepEqual(getScheduleMemberRoles({}), []);
    });
    await test("colecao carregada vazia nao recorre ao legado", () => {
      assert.deepEqual(getScheduleMemberRoles({ roles: [] }), []);
      assert.equal(hasInstrumentRole({ roles: [] }), false);
    });
    await test("colecao reconhece BACKING e INSTRUMENT", () => {
      const source = { roles: [ScheduleMemberRole.INSTRUMENT, ScheduleMemberRole.BACKING] };
      assert.deepEqual(getScheduleMemberRoles(source), [ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT]);
      assert.equal(hasInstrumentRole(source), true);
    });
    await test("colecao INSTRUMENT controla regra instrumental", () => {
      assert.equal(hasInstrumentRole({ roles: [ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT] }), true);
      assert.equal(hasInstrumentRole({ roles: [ScheduleMemberRole.BACKING] }), false);
    });
    await test("normalizacao usa prioridade oficial sem projecao", () => {
      assert.deepEqual(normalizeScheduleMemberRoles([ScheduleMemberRole.INSTRUMENT, ScheduleMemberRole.BACKING]), [ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT]);
      assert.deepEqual(normalizeScheduleMemberRoles([ScheduleMemberRole.INSTRUMENT, ScheduleMemberRole.BACKING, ScheduleMemberRole.VOCAL]), [ScheduleMemberRole.VOCAL, ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT]);
    });
    await test("validator rejeita colecao vazia", () => {
      assert.equal(scheduleMemberUpdateSchema.safeParse({ roles: [] }).success, false);
    });
    await test("create validator rejeita colecao vazia", () => {
      assert.equal(scheduleMemberCreateSchema.safeParse({ memberId: "cm0000000000000000000000000", roles: [] }).success, false);
    });
    await test("payload singular e ambiguo sao identificados como legado", () => {
      assert.equal(hasLegacyScheduleMemberRoleField({ role: ScheduleMemberRole.VOCAL }), true);
      assert.equal(hasLegacyScheduleMemberRoleField({ role: ScheduleMemberRole.VOCAL, roles: [ScheduleMemberRole.VOCAL] }), true);
      assert.equal(hasLegacyScheduleMemberRoleField({ roles: [ScheduleMemberRole.VOCAL] }), false);
    });
    await test("validator rejeita role duplicada", () => {
      assert.equal(scheduleMemberUpdateSchema.safeParse({ roles: [ScheduleMemberRole.BACKING, ScheduleMemberRole.BACKING] }).success, false);
    });
    await test("validator rejeita role desconhecida", () => {
      assert.equal(scheduleMemberUpdateSchema.safeParse({ roles: ["UNKNOWN"] }).success, false);
    });
    await test("backfill cobre todos os participantes preexistentes", () => {
      assert.equal(existingWithRoles, existingParticipants);
    });
    await test("todos os participantes preexistentes possuem assignments", () => {
      assert.equal(existingWithRoles, existingParticipants);
    });

    const ministry = await prisma.ministry.create({ data: { name: key("ministry"), slug: key("ministry") } });
    ids.ministries.push(ministry.id);
    const [
      normalMember,
      singleMember,
      exceptionMember,
      replacementMember,
      selfMember,
      projectionMember,
      legacyMember,
      divergentMember,
      concurrentMember
    ] = await Promise.all([
      prisma.member.create({ data: { name: key("normal") } }),
      prisma.member.create({ data: { name: key("single") } }),
      prisma.member.create({ data: { name: key("exception") } }),
      prisma.member.create({ data: { name: key("replacement") } }),
      prisma.member.create({ data: { name: key("self") } }),
      prisma.member.create({ data: { name: key("projection") } }),
      prisma.member.create({ data: { name: key("legacy") } }),
      prisma.member.create({ data: { name: key("divergent") } }),
      prisma.member.create({ data: { name: key("concurrent") } })
    ]);
    ids.members.push(
      normalMember.id,
      singleMember.id,
      exceptionMember.id,
      replacementMember.id,
      selfMember.id,
      projectionMember.id,
      legacyMember.id,
      divergentMember.id,
      concurrentMember.id
    );
    const memberLinks = await Promise.all([
      normalMember.id,
      singleMember.id,
      projectionMember.id,
      legacyMember.id,
      divergentMember.id,
      concurrentMember.id
    ].map((memberId) =>
      prisma.memberMinistry.create({
        data: {
          memberId,
          ministryId: ministry.id,
          entryDate: new Date("2026-01-01T00:00:00.000Z"),
          status: MemberMinistryStatus.ACTIVE,
          createdById: author.id
        }
      })
    ));
    ids.memberMinistries.push(...memberLinks.map((link) => link.id));
    const schedule = await prisma.schedule.create({
      data: { title: key("draft"), ministryId: ministry.id, date: new Date("2099-01-10T00:00:00.000Z"), createdById: author.id }
    });
    ids.schedules.push(schedule.id);
    const category = await prisma.instrumentCategory.create({ data: { name: key("bass") } });
    ids.categories.push(category.id);
    const instrument = await prisma.instrument.create({ data: { name: key("instrument"), categoryId: category.id } });
    ids.instruments.push(instrument.id);

    const singleRole = await scheduleService.addMember(schedule.id, {
      memberId: singleMember.id,
      roles: [ScheduleMemberRole.VOCAL],
      status: ScheduleMemberStatus.PENDING,
      allowMinistryException: false
    }, authorization);
    ids.participants.push(singleRole.id);
    await test("criacao com uma role mantem assignment coerente", async () => {
      assert.deepEqual(singleRole.roles, [ScheduleMemberRole.VOCAL]);
      assert.equal(await prisma.scheduleMemberRoleAssignment.count({ where: { scheduleMemberId: singleRole.id } }), 1);
    });

    const legacyOnly = await scheduleService.addMember(schedule.id, {
      memberId: legacyMember.id,
      roles: [ScheduleMemberRole.BACKING],
      status: ScheduleMemberStatus.PENDING,
      allowMinistryException: false
    }, authorization);
    ids.participants.push(legacyOnly.id);
    await test("payload oficial com roles cria assignment", async () => {
      assert.deepEqual(legacyOnly.roles, [ScheduleMemberRole.BACKING]);
      assert.equal(await prisma.scheduleMemberRoleAssignment.count({ where: { scheduleMemberId: legacyOnly.id } }), 1);
    });

    const divergentCreate = await scheduleService.addMember(schedule.id, {
      memberId: divergentMember.id,
      roles: [ScheduleMemberRole.INSTRUMENT, ScheduleMemberRole.MINISTER],
      status: ScheduleMemberStatus.PENDING,
      allowMinistryException: false,
      instrumentAssignment: {
        source: ScheduleInstrumentSource.OWN,
        instrumentCategoryId: category.id,
        instrumentId: null
      }
    }, authorization);
    ids.participants.push(divergentCreate.id);
    await test("roles ordena pela prioridade oficial", async () => {
      assert.deepEqual(divergentCreate.roles, [ScheduleMemberRole.MINISTER, ScheduleMemberRole.INSTRUMENT]);
      assert.equal(await prisma.scheduleMember.count({ where: { scheduleId: schedule.id, memberId: divergentMember.id } }), 1);
      assert.equal(await prisma.scheduleMemberRoleAssignment.count({ where: { scheduleMemberId: divergentCreate.id } }), 2);
      assert.equal(await prisma.scheduleMemberInstrumentAssignment.count({ where: { scheduleMemberId: divergentCreate.id, endedAt: null } }), 1);
    });

    const legacyWithInstrument = await scheduleService.updateMember(schedule.id, legacyOnly.id, {
      roles: [ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT],
      instrumentAssignment: {
        source: ScheduleInstrumentSource.REGISTERED,
        instrumentCategoryId: category.id,
        instrumentId: instrument.id
      }
    }, authorization);
    await test("BACKING para BACKING mais INSTRUMENT cria assignment no submit", async () => {
      assert.deepEqual(legacyWithInstrument.roles, [ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT]);
      assert.equal(await prisma.scheduleMemberInstrumentAssignment.count({ where: { scheduleMemberId: legacyOnly.id, endedAt: null } }), 1);
    });
    const legacyInstrumentOnly = await scheduleService.updateMember(schedule.id, legacyOnly.id, {
      roles: [ScheduleMemberRole.INSTRUMENT]
    }, authorization);
    await test("remover BACKING preserva assignment de INSTRUMENT", async () => {
      assert.deepEqual(legacyInstrumentOnly.roles, [ScheduleMemberRole.INSTRUMENT]);
      assert.equal(await prisma.scheduleMemberInstrumentAssignment.count({ where: { scheduleMemberId: legacyOnly.id, endedAt: null } }), 1);
    });
    const legacyVocalInstrument = await scheduleService.updateMember(schedule.id, legacyOnly.id, {
      roles: [ScheduleMemberRole.VOCAL, ScheduleMemberRole.INSTRUMENT]
    }, authorization);
    await test("adicionar VOCAL preserva assignment e status", async () => {
      assert.deepEqual(legacyVocalInstrument.roles, [ScheduleMemberRole.VOCAL, ScheduleMemberRole.INSTRUMENT]);
      assert.equal(legacyVocalInstrument.status, ScheduleMemberStatus.PENDING);
      assert.equal(await prisma.scheduleMemberInstrumentAssignment.count({ where: { scheduleMemberId: legacyOnly.id, endedAt: null } }), 1);
    });
    const legacyVocalOnly = await scheduleService.updateMember(schedule.id, legacyOnly.id, {
      roles: [ScheduleMemberRole.VOCAL]
    }, authorization);
    await test("remover INSTRUMENT de VOCAL encerra assignment e preserva historico", async () => {
      assert.deepEqual(legacyVocalOnly.roles, [ScheduleMemberRole.VOCAL]);
      assert.equal(await prisma.scheduleMemberInstrumentAssignment.count({ where: { scheduleMemberId: legacyOnly.id, endedAt: null } }), 0);
      assert.equal(await prisma.scheduleMemberInstrumentAssignment.count({ where: { scheduleMemberId: legacyOnly.id } }), 1);
    });
    await scheduleService.updateMember(schedule.id, legacyOnly.id, {
      roles: [ScheduleMemberRole.VOCAL, ScheduleMemberRole.INSTRUMENT]
    }, authorization);
    await test("recolocar INSTRUMENT nao ressuscita assignment historico", async () => {
      assert.equal(await prisma.scheduleMemberInstrumentAssignment.count({ where: { scheduleMemberId: legacyOnly.id, endedAt: null } }), 0);
      assert.equal(await prisma.scheduleMemberInstrumentAssignment.count({ where: { scheduleMemberId: legacyOnly.id } }), 1);
    });

    const projectedCreate = await scheduleService.addMember(schedule.id, {
      memberId: projectionMember.id,
      roles: [ScheduleMemberRole.OTHER, ScheduleMemberRole.BACKING],
      status: ScheduleMemberStatus.PENDING,
      allowMinistryException: false
    }, authorization);
    ids.participants.push(projectedCreate.id);
    await test("create moderno ordena roles sem usar default OTHER", async () => {
      assert.deepEqual(projectedCreate.roles, [ScheduleMemberRole.BACKING, ScheduleMemberRole.OTHER]);
    });

    const created = await scheduleService.addMember(schedule.id, {
      memberId: normalMember.id,
      roles: [ScheduleMemberRole.INSTRUMENT, ScheduleMemberRole.BACKING],
      status: ScheduleMemberStatus.PENDING,
      allowMinistryException: false,
      instrumentAssignment: {
        source: ScheduleInstrumentSource.REGISTERED,
        instrumentCategoryId: category.id,
        instrumentId: instrument.id
      }
    }, authorization);
    ids.participants.push(created.id);

    await test("criacao nova persiste multiplas roles", () => {
      assert.deepEqual(created.roles, [ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT]);
    });
    await test("constraint real bloqueia duplicacao da mesma role", async () => {
      await assert.rejects(
        prisma.scheduleMemberRoleAssignment.create({
          data: { scheduleMemberId: created.id, role: ScheduleMemberRole.BACKING }
        }),
        (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
      );
    });
    await test("Service rejeita duplicata com erro funcional", async () => {
      await expectCode(
        () => scheduleService.updateMember(schedule.id, created.id, { roles: [ScheduleMemberRole.BACKING, ScheduleMemberRole.BACKING] }, authorization),
        "SCHEDULE_MEMBER_ROLE_DUPLICATE"
      );
      assert.equal(await prisma.scheduleMemberRoleAssignment.count({ where: { scheduleMemberId: created.id } }), 2);
    });
    await test("Service impede remocao da ultima role", async () => {
      await expectCode(
        () => scheduleService.updateMember(schedule.id, created.id, { roles: [] }, authorization),
        "SCHEDULE_MEMBER_ROLE_REQUIRED"
      );
      assert.equal(await prisma.scheduleMemberRoleAssignment.count({ where: { scheduleMemberId: created.id } }), 2);
    });
    await test("INSTRUMENT mais BACKING mantem um unico assignment ativo", async () => {
      assert.equal(await prisma.scheduleMemberInstrumentAssignment.count({ where: { scheduleMemberId: created.id, endedAt: null } }), 1);
      assert.equal(hasInstrumentRole({ roles: created.roles }), true);
    });

    const withoutBacking = await scheduleService.updateMember(schedule.id, created.id, {
      roles: [ScheduleMemberRole.INSTRUMENT]
    }, authorization);
    await test("remover BACKING preserva assignment", async () => {
      assert.deepEqual(withoutBacking.roles, [ScheduleMemberRole.INSTRUMENT]);
      assert.equal(await prisma.scheduleMemberInstrumentAssignment.count({ where: { scheduleMemberId: created.id, endedAt: null } }), 1);
    });
    const restoredBacking = await scheduleService.updateMember(schedule.id, created.id, {
      roles: [ScheduleMemberRole.INSTRUMENT, ScheduleMemberRole.BACKING]
    }, authorization);
    await test("recolocar BACKING nao altera assignment", async () => {
      assert.deepEqual(restoredBacking.roles, [ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT]);
      assert.equal(await prisma.scheduleMemberInstrumentAssignment.count({ where: { scheduleMemberId: created.id } }), 1);
    });
    const backingOnly = await scheduleService.updateMember(schedule.id, created.id, {
      roles: [ScheduleMemberRole.BACKING]
    }, authorization);
    await test("remover INSTRUMENT encerra assignment ativo", async () => {
      assert.deepEqual(backingOnly.roles, [ScheduleMemberRole.BACKING]);
      assert.equal(await prisma.scheduleMemberInstrumentAssignment.count({ where: { scheduleMemberId: created.id, endedAt: null } }), 0);
    });
    await test("encerramento de assignment preserva historico", async () => {
      assert.equal(await prisma.scheduleMemberInstrumentAssignment.count({ where: { scheduleMemberId: created.id } }), 1);
      assert.equal((await prisma.scheduleMemberInstrumentAssignment.findFirstOrThrow({ where: { scheduleMemberId: created.id } })).endedAt instanceof Date, true);
    });
    const instrumentRestored = await scheduleService.updateMember(schedule.id, created.id, {
      roles: [ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT]
    }, authorization);
    await test("adicionar INSTRUMENT nao cria assignment automaticamente", async () => {
      assert.equal(hasInstrumentRole({ roles: instrumentRestored.roles }), true);
      assert.equal(await prisma.scheduleMemberInstrumentAssignment.count({ where: { scheduleMemberId: created.id, endedAt: null } }), 0);
    });

    await scheduleService.updateMember(schedule.id, created.id, { roles: [ScheduleMemberRole.BACKING] }, authorization);
    await test("falha de assignment reverte alteracao de roles", async () => {
      await expectCode(
        () => scheduleService.updateMember(schedule.id, created.id, {
          roles: [ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT],
          instrumentAssignment: {
            source: ScheduleInstrumentSource.OWN,
            instrumentCategoryId: "cm0000000000000000000000000",
            instrumentId: null
          }
        }, authorization),
        "SCHEDULE_INSTRUMENT_CATEGORY_INVALID"
      );
      const current = await prisma.scheduleMember.findUniqueOrThrow({
        where: { id: created.id },
        include: { roles: true }
      });
      assert.deepEqual(getScheduleMemberRoles(current), [ScheduleMemberRole.BACKING]);
    });
    const withAssignment = await scheduleService.updateMember(schedule.id, created.id, {
      roles: [ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT],
      instrumentAssignment: {
        source: ScheduleInstrumentSource.OWN,
        instrumentCategoryId: category.id,
        instrumentId: null
      }
    }, authorization);
    await test("INSTRUMENT restaurado aceita configuracao valida", async () => {
      assert.equal(hasInstrumentRole({ roles: withAssignment.roles }), true);
      assert.equal(await prisma.scheduleMemberInstrumentAssignment.count({ where: { scheduleMemberId: created.id, endedAt: null } }), 1);
    });
    await test("adicionar role nao instrumental preserva assignment", async () => {
      await scheduleService.updateMember(schedule.id, created.id, {
        roles: [ScheduleMemberRole.VOCAL, ScheduleMemberRole.INSTRUMENT, ScheduleMemberRole.BACKING]
      }, authorization);
      assert.equal(await prisma.scheduleMemberInstrumentAssignment.count({ where: { scheduleMemberId: created.id, endedAt: null } }), 1);
    });
    await test("status continua unico no ScheduleMember", async () => {
      const result = await scheduleService.updateMember(schedule.id, created.id, { status: ScheduleMemberStatus.CONFIRMED }, authorization);
      assert.equal(result.status, ScheduleMemberStatus.CONFIRMED);
      assert.equal(result.roles.length, 3);
    });
    await test("confirmacao e recusa nao sao persistidas por role", async () => {
      const result = await scheduleService.updateMember(schedule.id, created.id, { status: ScheduleMemberStatus.DECLINED }, authorization);
      assert.equal(result.status, ScheduleMemberStatus.DECLINED);
      assert.equal(await prisma.scheduleMemberRoleAssignment.count({ where: { scheduleMemberId: created.id } }), 3);
    });
    await test("alteracoes concorrentes preservam conjunto atomico e assignment", async () => {
      const results = await Promise.all([
        scheduleService.updateMember(schedule.id, created.id, {
          roles: [ScheduleMemberRole.INSTRUMENT, ScheduleMemberRole.BACKING]
        }, authorization),
        scheduleService.updateMember(schedule.id, created.id, {
          roles: [ScheduleMemberRole.INSTRUMENT, ScheduleMemberRole.MINISTER]
        }, authorization)
      ]);
      assert.equal(results.length, 2);
      const current = await prisma.scheduleMember.findUniqueOrThrow({
        where: { id: created.id },
        include: { roles: true }
      });
      const currentRoles = getScheduleMemberRoles(current);
      const expectedSets = [
        [ScheduleMemberRole.MINISTER, ScheduleMemberRole.INSTRUMENT],
        [ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT]
      ];
      assert.equal(expectedSets.some((roles) => assertRoleSetsEqual(roles, currentRoles)), true);
      assert.ok(currentRoles.length > 0);
      assert.equal(await prisma.scheduleMemberInstrumentAssignment.count({ where: { scheduleMemberId: created.id, endedAt: null } }), 1);
    });

    const concurrentParticipant = await scheduleService.addMember(schedule.id, {
      memberId: concurrentMember.id,
      roles: [ScheduleMemberRole.INSTRUMENT],
      status: ScheduleMemberStatus.PENDING,
      allowMinistryException: false,
      instrumentAssignment: {
        source: ScheduleInstrumentSource.OWN,
        instrumentCategoryId: category.id,
        instrumentId: null
      }
    }, authorization);
    ids.participants.push(concurrentParticipant.id);
    await test("concorrencia entre remover INSTRUMENT e update normal preserva estado serializavel", async () => {
      await Promise.all([
        scheduleService.updateMember(schedule.id, concurrentParticipant.id, {
          roles: [ScheduleMemberRole.VOCAL]
        }, authorization),
        scheduleService.updateMember(schedule.id, concurrentParticipant.id, {
          roles: [ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT],
          instrumentAssignment: {
            source: ScheduleInstrumentSource.OWN,
            instrumentCategoryId: category.id,
            instrumentId: null
          }
        }, authorization)
      ]);
      const current = await prisma.scheduleMember.findUniqueOrThrow({
        where: { id: concurrentParticipant.id },
        include: { roles: true }
      });
      const roles = getScheduleMemberRoles(current);
      const activeAssignments = await prisma.scheduleMemberInstrumentAssignment.count({
        where: { scheduleMemberId: concurrentParticipant.id, endedAt: null }
      });
      const removedWon = assertRoleSetsEqual([ScheduleMemberRole.VOCAL], roles);
      const updateWon = assertRoleSetsEqual([ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT], roles);
      assert.equal(removedWon || updateWon, true);
      assert.ok(roles.length > 0);
      assert.equal(activeAssignments, removedWon ? 0 : 1);
    });

    const exception = await scheduleService.addMember(schedule.id, {
      memberId: exceptionMember.id,
      roles: [ScheduleMemberRole.INSTRUMENT, ScheduleMemberRole.BACKING],
      status: ScheduleMemberStatus.PENDING,
      allowMinistryException: true,
      instrumentAssignment: {
        source: ScheduleInstrumentSource.OWN,
        instrumentCategoryId: category.id,
        instrumentId: null
      }
    }, authorization);
    ids.participants.push(exception.id);
    await test("membro excecao aceita multiplas roles", () => {
      assert.deepEqual(exception.roles, [ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT]);
      assert.equal(exception.instrumentAssignment?.source, ScheduleInstrumentSource.OWN);
    });
    const ministerInstrument = await scheduleService.updateMember(schedule.id, exception.id, {
      roles: [ScheduleMemberRole.MINISTER, ScheduleMemberRole.INSTRUMENT],
      allowMinistryException: true
    }, authorization);
    await test("MINISTER mais INSTRUMENT e uma combinacao valida", async () => {
      assert.deepEqual(ministerInstrument.roles, [ScheduleMemberRole.MINISTER, ScheduleMemberRole.INSTRUMENT]);
      assert.equal(hasInstrumentRole({ roles: ministerInstrument.roles }), true);
    });
    await test("substituicao permanece no participante inteiro", async () => {
      const result = await scheduleService.updateMember(schedule.id, exception.id, {
        status: ScheduleMemberStatus.REPLACED,
        replacedByMemberId: replacementMember.id,
        allowMinistryException: true
      }, authorization);
      assert.equal(result.status, ScheduleMemberStatus.REPLACED);
      assert.equal(result.roles.length, 2);
    });

    const selfUser = await prisma.user.create({
      data: {
        name: key("self-user"),
        username: key("self-user"),
        email: `${key("self-user")}@example.test`,
        passwordHash: "test-only",
        memberId: selfMember.id
      }
    });
    ids.users.push(selfUser.id);
    const published = await prisma.schedule.create({
      data: {
        title: key("published"),
        ministryId: ministry.id,
        date: new Date("2099-01-05T00:00:00.000Z"),
        status: ScheduleStatus.PUBLISHED,
        publishedAt: new Date(),
        createdById: author.id
      }
    });
    ids.schedules.push(published.id);
    const selfParticipant = await prisma.scheduleMember.create({
      data: {
        scheduleId: published.id,
        memberId: selfMember.id,
        roles: { create: [{ role: ScheduleMemberRole.INSTRUMENT }, { role: ScheduleMemberRole.BACKING }] }
      }
    });
    ids.participants.push(selfParticipant.id);
    await prisma.scheduleMemberInstrumentAssignment.create({
      data: {
        scheduleMemberId: selfParticipant.id,
        instrumentCategoryId: category.id,
        source: ScheduleInstrumentSource.OWN,
        createdById: selfUser.id,
        updatedById: selfUser.id
      }
    });
    await test("self-service reconhece INSTRUMENT na colecao", async () => {
      const result = await myScheduleService.getInstrumentChange(selfParticipant.id, { id: selfUser.id, memberId: selfMember.id });
      assert.equal(result.category.id, category.id);
    });

    const backingSchedule = await prisma.schedule.create({
      data: { title: key("backing"), ministryId: ministry.id, date: new Date("2099-01-06T00:00:00.000Z"), status: ScheduleStatus.PUBLISHED, publishedAt: new Date(), createdById: author.id }
    });
    ids.schedules.push(backingSchedule.id);
    const backingParticipant = await prisma.scheduleMember.create({
      data: { scheduleId: backingSchedule.id, memberId: selfMember.id, roles: { create: { role: ScheduleMemberRole.BACKING } } }
    });
    ids.participants.push(backingParticipant.id);
    await test("self-service bloqueia participante sem INSTRUMENT na colecao", () =>
      expectCode(
        () => myScheduleService.getInstrumentChange(backingParticipant.id, { id: selfUser.id, memberId: selfMember.id }),
        "SCHEDULE_INSTRUMENT_ROLE_REQUIRED"
      )
    );
    await test("assignment administrativo exige INSTRUMENT na colecao", () =>
      expectCode(
        () => scheduleInstrumentAssignmentService.createInitial(backingSchedule.id, backingParticipant.id, {
          source: ScheduleInstrumentSource.OWN,
          instrumentCategoryId: category.id,
          instrumentId: null
        }, authorization),
        "SCHEDULE_INSTRUMENT_ROLE_REQUIRED"
      )
    );

    const suggestionTarget = await prisma.schedule.create({
      data: { title: key("suggestion-target"), ministryId: ministry.id, date: new Date("2099-01-20T00:00:00.000Z"), createdById: author.id }
    });
    ids.schedules.push(suggestionTarget.id);
    await test("sugestao 0.2.4 continua exclusivamente instrumental", async () => {
      const suggestion = await scheduleInstrumentAssignmentService.getSuggestion(suggestionTarget.id, selfMember.id, authorization);
      assert.equal(suggestion.hasSuggestion, true);
      assert.equal(suggestion.role, ScheduleMemberRole.INSTRUMENT);
    });
    await test("nenhum historico e apagado ao editar roles", async () => {
      assert.ok(await prisma.scheduleMemberInstrumentAssignment.count({ where: { scheduleMemberId: { in: ids.participants } } }) >= 3);
    });
    await test("create validator aceita somente contrato oficial roles", () => {
      assert.equal(scheduleMemberCreateSchema.safeParse({
        memberId: normalMember.id,
        roles: [ScheduleMemberRole.INSTRUMENT, ScheduleMemberRole.BACKING],
        status: ScheduleMemberStatus.PENDING,
        allowMinistryException: false
      }).success, true);
      assert.equal(scheduleMemberCreateSchema.safeParse({
        memberId: normalMember.id,
        role: ScheduleMemberRole.INSTRUMENT,
        status: ScheduleMemberStatus.PENDING,
        allowMinistryException: false
      }).success, false);
    });

    assert.equal(scenarios, 48, "A suite deve manter os cenarios estruturais obrigatorios.");
    console.log(`Schedule member multiple roles: ${scenarios} scenarios passed.`);
  } finally {
    if (ids.schedules.length) {
      await prisma.scheduleMemberInstrumentAssignment.deleteMany({ where: { scheduleMember: { scheduleId: { in: ids.schedules } } } });
      await prisma.scheduleMemberRoleAssignment.deleteMany({ where: { scheduleMember: { scheduleId: { in: ids.schedules } } } });
      await prisma.scheduleMember.deleteMany({ where: { scheduleId: { in: ids.schedules } } });
      await prisma.schedule.deleteMany({ where: { id: { in: ids.schedules } } });
    }
    if (ids.memberMinistries.length) await prisma.memberMinistry.deleteMany({ where: { id: { in: ids.memberMinistries } } });
    if (ids.instruments.length) await prisma.instrument.deleteMany({ where: { id: { in: ids.instruments } } });
    if (ids.categories.length) await prisma.instrumentCategory.deleteMany({ where: { id: { in: ids.categories } } });
    if (ids.users.length) await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
    if (ids.members.length) await prisma.member.deleteMany({ where: { id: { in: ids.members } } });
    if (ids.ministries.length) await prisma.ministry.deleteMany({ where: { id: { in: ids.ministries } } });
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Schedule member roles tests failed.");
  process.exitCode = 1;
});
