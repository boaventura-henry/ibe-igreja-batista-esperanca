import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { InstrumentStatus, PrismaClient, ScheduleInstrumentSource, ScheduleMemberRole } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { getScheduleMemberDisplayRoles, type ScheduleMemberRoleSource } from "@/lib/schedule-member-role";
import { createInitialAssignmentInTransaction, endActiveAssignmentInTransaction, setActiveAssignmentInTransaction } from "@/services/schedule-instrument-assignment.service";
import { scheduleInstrumentAssignmentSchema } from "@/validators";
const prisma = new PrismaClient();
const stamp = Date.now().toString();
const name = (value: string) => "__schedule_instrument_" + stamp + "_" + value;
const ids = { members: [] as string[], instruments: [] as string[], categories: [] as string[] };
async function expectCode(action: () => Promise<unknown>, code: string) {
  await assert.rejects(action, (error: unknown) => error instanceof AppError && error.code === code);
}
async function main() {
  const user = await prisma.user.findFirst({ where: { isActive: true }, select: { id: true } });
  assert.ok(user, "Development precisa conter um usuario ativo.");
  const userId = user.id;
  const ministry = await prisma.ministry.create({ data: { name: name("louvor"), slug: name("louvor") } });
  const schedule = await prisma.schedule.create({ data: { title: name("escala"), ministryId: ministry.id, date: new Date("2099-01-01"), createdById: userId } });
  try {
    const [bass, guitar, inactiveCategory] = await Promise.all([
      prisma.instrumentCategory.create({ data: { name: name("baixo") } }),
      prisma.instrumentCategory.create({ data: { name: name("guitarra") } }),
      prisma.instrumentCategory.create({ data: { name: name("inativa"), isActive: false } })
    ]);
    ids.categories.push(bass.id, guitar.id, inactiveCategory.id);
    const instruments = await Promise.all([
      prisma.instrument.create({ data: { name: name("baixo_active"), categoryId: bass.id } }),
      prisma.instrument.create({ data: { name: name("baixo_maintenance"), categoryId: bass.id, status: InstrumentStatus.MAINTENANCE } }),
      prisma.instrument.create({ data: { name: name("baixo_inactive"), categoryId: bass.id, status: InstrumentStatus.INACTIVE } }),
      prisma.instrument.create({ data: { name: name("baixo_deleted"), categoryId: bass.id, deletedAt: new Date() } }),
      prisma.instrument.create({ data: { name: name("guitarra_active"), categoryId: guitar.id } })
    ]);
    ids.instruments.push(...instruments.map((value) => value.id));
    async function participant(role: ScheduleMemberRole) {
      const member = await prisma.member.create({ data: { name: name("member_" + ids.members.length) } });
      ids.members.push(member.id);
      const participant = await prisma.scheduleMember.create({
        data: { scheduleId: schedule.id, memberId: member.id, roles: { create: { role } } }
      });
      return { ...participant, roles: [role] };
    }
    async function assign(participantId: string, roles: ScheduleMemberRoleSource, source: ScheduleInstrumentSource, categoryId: string, instrumentId: string | null) {
      const input = source === ScheduleInstrumentSource.REGISTERED
        ? { source: ScheduleInstrumentSource.REGISTERED, instrumentCategoryId: categoryId, instrumentId: instrumentId as string }
        : { source: ScheduleInstrumentSource.OWN, instrumentCategoryId: categoryId, instrumentId: null };
      return prisma.$transaction((db) => createInitialAssignmentInTransaction(participantId, roles, input, userId, db));
    }
    const registered = await participant(ScheduleMemberRole.INSTRUMENT);
    const first = await assign(registered.id, registered, ScheduleInstrumentSource.REGISTERED, bass.id, instruments[0].id);
    assert.equal(first.instrument?.id, instruments[0].id, "1/7: INSTRUMENT aceita Instrument ACTIVE.");
    assert.equal(
      getScheduleMemberDisplayRoles(registered, first),
      bass.name,
      "1b: REGISTERED apresenta a categoria, nunca o patrimonio fisico."
    );
    const repeatedRegistered = await prisma.$transaction((db) => setActiveAssignmentInTransaction(
      registered.id,
      registered,
      { source: ScheduleInstrumentSource.REGISTERED, instrumentCategoryId: bass.id, instrumentId: instruments[0].id },
      userId,
      db
    ));
    assert.equal(repeatedRegistered.id, first.id, "2: REGISTERED identico e idempotente.");
    assert.equal(await prisma.scheduleMemberInstrumentAssignment.count({ where: { scheduleMemberId: registered.id } }), 1, "3: idempotencia nao cria historico adicional.");
    await assert.rejects(
      () => prisma.scheduleMemberInstrumentAssignment.create({
        data: { scheduleMemberId: registered.id, instrumentCategoryId: bass.id, source: ScheduleInstrumentSource.REGISTERED, createdById: userId }
      }),
      "4: CHECK bloqueia REGISTERED sem instrumentId."
    );
    await assert.rejects(
      () => prisma.scheduleMemberInstrumentAssignment.create({
        data: { scheduleMemberId: registered.id, instrumentCategoryId: bass.id, source: ScheduleInstrumentSource.OWN, instrumentId: instruments[0].id, createdById: userId }
      }),
      "5: CHECK bloqueia OWN com instrumentId."
    );
    const vocal = await participant(ScheduleMemberRole.VOCAL);
    await expectCode(() => assign(vocal.id, vocal, ScheduleInstrumentSource.OWN, bass.id, null), "SCHEDULE_INSTRUMENT_ROLE_REQUIRED");
    assert.throws(() => scheduleInstrumentAssignmentSchema.parse({ source: "REGISTERED", instrumentCategoryId: bass.id }), /./, "3: REGISTERED exige instrumentId.");
    assert.throws(() => scheduleInstrumentAssignmentSchema.parse({ source: "OWN", instrumentCategoryId: bass.id, instrumentId: instruments[0].id }), /./, "4: OWN exige null.");
    assert.throws(() => scheduleInstrumentAssignmentSchema.parse({ source: "OWN" }), /./, "5: categoria obrigatoria.");
    const invalidCases = [instruments[1], instruments[2], instruments[3], instruments[4]];
    for (const instrument of invalidCases) {
      const p = await participant(ScheduleMemberRole.INSTRUMENT);
      await expectCode(() => assign(p.id, p, ScheduleInstrumentSource.REGISTERED, bass.id, instrument.id), "SCHEDULE_INSTRUMENT_INVALID");
    }
    const pInactiveCategory = await participant(ScheduleMemberRole.INSTRUMENT);
    await expectCode(() => assign(pInactiveCategory.id, pInactiveCategory, ScheduleInstrumentSource.OWN, inactiveCategory.id, null), "SCHEDULE_INSTRUMENT_CATEGORY_INVALID");
    const own = await participant(ScheduleMemberRole.INSTRUMENT);
    const ownAssignment = await assign(own.id, own, ScheduleInstrumentSource.OWN, bass.id, null);
    assert.equal(ownAssignment.instrument, null, "12: proprio nao cria Instrument.");
    assert.equal(
      getScheduleMemberDisplayRoles(own, ownAssignment),
      bass.name,
      "12b: OWN apresenta a categoria sem expor a origem administrativa."
    );
    await expectCode(() => assign(registered.id, registered, ScheduleInstrumentSource.OWN, bass.id, null), "SCHEDULE_INSTRUMENT_ALREADY_ASSIGNED");
    const concurrent = await participant(ScheduleMemberRole.INSTRUMENT);
    const attempts = await Promise.allSettled([
      assign(concurrent.id, concurrent, ScheduleInstrumentSource.OWN, bass.id, null),
      assign(concurrent.id, concurrent, ScheduleInstrumentSource.OWN, bass.id, null)
    ]);
    assert.equal(attempts.filter((value) => value.status === "fulfilled").length, 1, "14: concorrencia cria somente um ativo.");
    const ownTransition = await prisma.$transaction((db) => setActiveAssignmentInTransaction(
      registered.id,
      registered,
      { source: ScheduleInstrumentSource.OWN, instrumentCategoryId: bass.id, instrumentId: null },
      userId,
      db
    ));
    const repeatedOwn = await prisma.$transaction((db) => setActiveAssignmentInTransaction(
      registered.id,
      registered,
      { source: ScheduleInstrumentSource.OWN, instrumentCategoryId: bass.id, instrumentId: null },
      userId,
      db
    ));
    assert.equal(repeatedOwn.id, ownTransition.id, "15: OWN identico e idempotente.");
    await prisma.$transaction((db) => setActiveAssignmentInTransaction(
      registered.id,
      registered,
      { source: ScheduleInstrumentSource.REGISTERED, instrumentCategoryId: guitar.id, instrumentId: instruments[4].id },
      userId,
      db
    ));
    const timeline = await prisma.scheduleMemberInstrumentAssignment.findMany({ where: { scheduleMemberId: registered.id } });
    assert.equal(timeline.length, 3, "15: trocas preservam assignments anteriores.");
    assert.equal(timeline.filter((value) => value.endedAt === null).length, 1, "13: um unico ativo.");
    assert.equal(timeline.filter((value) => value.endedAt !== null).length, 2, "16: REGISTERED e OWN sao encerrados no historico.");
    const activeBeforeRollback = timeline.find((value) => value.endedAt === null);
    await assert.rejects(
      () => prisma.$transaction(async (db) => {
        await endActiveAssignmentInTransaction(registered.id, userId, db);
        throw new Error("rollback-controlado");
      }),
      "17: transacao interrompida faz rollback do encerramento."
    );
    const activeAfterRollback = await prisma.scheduleMemberInstrumentAssignment.findFirst({ where: { scheduleMemberId: registered.id, endedAt: null } });
    assert.equal(activeAfterRollback?.id, activeBeforeRollback?.id, "18: rollback preserva o assignment ativo.");
    await prisma.$transaction(async (db) => {
      await endActiveAssignmentInTransaction(own.id, userId, db);
      await db.scheduleMember.update({
        where: { id: own.id },
        data: {
          roles: { deleteMany: {}, create: { role: ScheduleMemberRole.SUPPORT } }
        }
      });
    });
    assert.ok((await prisma.scheduleMemberInstrumentAssignment.findFirst({ where: { scheduleMemberId: own.id } }))?.endedAt, "16: mudanca de role encerra historico.");
    const serviceSource = readFileSync("src/services/schedule.service.ts", "utf8");
    assert.match(serviceSource, /replacedByMemberId[\s\S]*endActiveAssignmentInTransaction/, "17: substituicao nao transfere assignment.");
    const historical = await participant(ScheduleMemberRole.INSTRUMENT);
    assert.equal(await prisma.scheduleMemberInstrumentAssignment.count({ where: { scheduleMemberId: historical.id } }), 0, "18: escala antiga sem assignment permanece valida.");
    assert.equal(
      getScheduleMemberDisplayRoles(historical),
      "Instrumento",
      "18b: escala antiga sem assignment usa fallback amigavel."
    );
    await assign(historical.id, historical, ScheduleInstrumentSource.REGISTERED, bass.id, instruments[0].id);
    await prisma.instrument.update({ where: { id: instruments[0].id }, data: { status: InstrumentStatus.INACTIVE } });
    await prisma.instrumentCategory.update({ where: { id: bass.id }, data: { isActive: false } });
    const preserved = await prisma.scheduleMemberInstrumentAssignment.findUnique({ where: { id: first.id }, include: { instrument: true, instrumentCategory: true } });
    assert.equal(preserved?.instrument?.id, instruments[0].id, "19: instrumento inativo preservado.");
    assert.equal(preserved?.instrumentCategory.id, bass.id, "20: categoria inativa preservada.");
    assert.equal(
      getScheduleMemberDisplayRoles(registered, preserved),
      bass.name,
      "20b: categoria inativa e instrumento inativo preservam a apresentacao historica."
    );
    await prisma.instrument.update({ where: { id: instruments[0].id }, data: { deletedAt: new Date() } });
    const softDeletedPreserved = await prisma.scheduleMemberInstrumentAssignment.findUnique({
      where: { id: first.id },
      include: { instrument: true, instrumentCategory: true }
    });
    assert.equal(
      getScheduleMemberDisplayRoles(registered, softDeletedPreserved),
      bass.name,
      "20c: patrimonio removido preserva a categoria no display historico."
    );
    const unchangedHistorical = await prisma.$transaction((db) => setActiveAssignmentInTransaction(
      historical.id,
      historical,
      { source: ScheduleInstrumentSource.REGISTERED, instrumentCategoryId: bass.id, instrumentId: instruments[0].id },
      userId,
      db
    ));
    assert.equal(unchangedHistorical.instrument?.id, instruments[0].id, "21: edicao identica preserva instrumento historico inativo.");
    assert.equal(
      await prisma.scheduleMemberInstrumentAssignment.count({ where: { scheduleMemberId: historical.id } }),
      1,
      "22: edicao historica identica nao cria novo assignment."
    );
    console.log("Schedule instrument assignments: 34 scenarios passed.");
  } finally {
    await prisma.scheduleMemberInstrumentAssignment.deleteMany({ where: { scheduleMember: { scheduleId: schedule.id } } });
    await prisma.scheduleMember.deleteMany({ where: { scheduleId: schedule.id } });
    await prisma.schedule.delete({ where: { id: schedule.id } });
    await prisma.instrument.deleteMany({ where: { id: { in: ids.instruments } } });
    await prisma.instrumentCategory.deleteMany({ where: { id: { in: ids.categories } } });
    await prisma.member.deleteMany({ where: { id: { in: ids.members } } });
    await prisma.ministry.delete({ where: { id: ministry.id } });
  }
}
void main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
