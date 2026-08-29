import assert from "node:assert/strict";
import { InstrumentStatus, PrismaClient, ScheduleInstrumentSource, ScheduleMemberRole, ScheduleMemberStatus, ScheduleStatus, ScheduleScope } from "@prisma/client";
import { AppError } from "../src/lib/errors";
import { myScheduleService } from "../src/services/my-schedule.service";
import { scheduleInstrumentAssignmentService } from "../src/services/schedule-instrument-assignment.service";
import { scheduleService } from "../src/services/schedule.service";
import { scheduleRepository } from "../src/repositories/schedule.repository";
import { scheduleInstrumentAssignmentRepository } from "../src/repositories/schedule-instrument-assignment.repository";
import { myScheduleInstrumentChangeSchema } from "../src/validators/my-schedule.validator";
import { getScheduleMemberRoles } from "../src/lib/schedule-member-role";

const prisma = new PrismaClient();
const stamp = Date.now().toString();
const key = (value: string) => `__member_instrument_${stamp}_${value}`;
const participantData = (scheduleId: string, memberId: string, role: ScheduleMemberRole) => ({
  scheduleId,
  memberId,
  roles: { create: { role } }
});
let scenarios = 0;
const test = async (name: string, run: () => Promise<void>) => { await run(); scenarios += 1; console.log(`PASS ${scenarios}: ${name}`); };
const expectCode = async (run: () => Promise<unknown>, code: string) => assert.rejects(run, (error: unknown) => error instanceof AppError && error.code === code);
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>((done) => { resolve = done; }); return { promise, resolve }; };
const settledCode = (result: PromiseSettledResult<unknown>) => result.status === "rejected" && result.reason && typeof result.reason === "object" ? (result.reason as { code?: string }).code ?? null : null;

async function main() {
  const ids = { users: [] as string[], members: [] as string[], instruments: [] as string[], categories: [] as string[], schedules: [] as string[], participants: [] as string[], ministries: [] as string[] };
  try {
    const ministry = await prisma.ministry.create({ data: { name: key("ministry"), slug: key("ministry") } }); ids.ministries.push(ministry.id);
    const [member, other, replacement] = await Promise.all([
      prisma.member.create({ data: { name: key("joao") } }),
      prisma.member.create({ data: { name: key("other") } }),
      prisma.member.create({ data: { name: key("pedro") } })
    ]); ids.members.push(member.id, other.id, replacement.id);
    const [user, otherUser] = await Promise.all([
      prisma.user.create({ data: { name: key("user"), username: key("user"), email: `${key("user")}@test.local`, passwordHash: "test", memberId: member.id } }),
      prisma.user.create({ data: { name: key("otheruser"), username: key("otheruser"), email: `${key("otheruser")}@test.local`, passwordHash: "test", memberId: other.id } })
    ]); ids.users.push(user.id, otherUser.id);
    const [bass, guitar] = await Promise.all([prisma.instrumentCategory.create({ data: { name: key("bass") } }), prisma.instrumentCategory.create({ data: { name: key("guitar") } })]); ids.categories.push(bass.id, guitar.id);
    const [tagima, yamaha, maintenance, inactive, deleted, guitarInstrument] = await Promise.all([
      prisma.instrument.create({ data: { name: key("tagima"), categoryId: bass.id } }), prisma.instrument.create({ data: { name: key("yamaha"), categoryId: bass.id } }),
      prisma.instrument.create({ data: { name: key("maintenance"), categoryId: bass.id, status: InstrumentStatus.MAINTENANCE } }), prisma.instrument.create({ data: { name: key("inactive"), categoryId: bass.id, status: InstrumentStatus.INACTIVE } }), prisma.instrument.create({ data: { name: key("deleted"), categoryId: bass.id, deletedAt: new Date() } }), prisma.instrument.create({ data: { name: key("guitar"), categoryId: guitar.id } })
    ]); ids.instruments.push(tagima.id, yamaha.id, maintenance.id, inactive.id, deleted.id, guitarInstrument.id);
    const schedule = await prisma.schedule.create({ data: { title: key("schedule"), ministryId: ministry.id, date: new Date("2099-01-01"), status: ScheduleStatus.PUBLISHED, createdById: user.id } }); ids.schedules.push(schedule.id);
    const participant = await prisma.scheduleMember.create({ data: participantData(schedule.id, member.id, ScheduleMemberRole.INSTRUMENT) }); ids.participants.push(participant.id);
    const current = await prisma.scheduleMemberInstrumentAssignment.create({ data: { scheduleMemberId: participant.id, instrumentCategoryId: bass.id, source: ScheduleInstrumentSource.REGISTERED, instrumentId: tagima.id, createdById: user.id, updatedById: user.id } });
    const session = { id: user.id, memberId: member.id };
    const registered = (instrumentId: string, reason: string | undefined, currentAssignmentId: string) => ({ source: ScheduleInstrumentSource.REGISTERED, instrumentId, changeReason: reason ?? null, currentAssignmentId });
    const own = (reason: string | undefined, currentAssignmentId: string) => ({ source: ScheduleInstrumentSource.OWN, instrumentId: null, changeReason: reason ?? null, currentAssignmentId });
    await test("proprio instrumentista publicado com assignment ativo pode consultar", async () => { const result = await myScheduleService.getInstrumentChange(participant.id, session); assert.equal(result.current.id, current.id); assert.equal(result.category.id, bass.id); });
    await test("outro membro nao acessa a participacao", () => expectCode(() => myScheduleService.getInstrumentChange(participant.id, { id: otherUser.id, memberId: other.id }), "MY_SCHEDULE_NOT_FOUND"));
    await test("usuario sem memberId e bloqueado", () => expectCode(() => myScheduleService.getInstrumentChange(participant.id, { id: user.id, memberId: null }), "USER_WITHOUT_MEMBER"));
    await test("role diferente de INSTRUMENT e bloqueado", async () => { const p = await prisma.scheduleMember.create({ data: participantData(schedule.id, other.id, ScheduleMemberRole.VOCAL) }); ids.participants.push(p.id); await expectCode(() => myScheduleService.getInstrumentChange(p.id, { id: otherUser.id, memberId: other.id }), "SCHEDULE_INSTRUMENT_ROLE_REQUIRED"); });
    await test("sem assignment recebe orientacao funcional e nao cria definicao", async () => { const p = await prisma.scheduleMember.create({ data: participantData(schedule.id, other.id, ScheduleMemberRole.INSTRUMENT) }); ids.participants.push(p.id); await expectCode(() => myScheduleService.changeInstrument(p.id, { source: ScheduleInstrumentSource.REGISTERED, instrumentId: yamaha.id, changeReason: "x" } as never, { id: otherUser.id, memberId: other.id }), "SCHEDULE_INSTRUMENT_NOT_DEFINED"); assert.equal(await prisma.scheduleMemberInstrumentAssignment.count({ where: { scheduleMemberId: p.id } }), 0); });
    await test("REGISTERED troca preserva categoria, motivo, autoria e historico", async () => { const next = await myScheduleService.changeInstrument(participant.id, registered(yamaha.id, "troca", current.id), session); assert.equal(next.instrument?.id, yamaha.id); assert.equal(next.instrumentCategory.id, bass.id); assert.equal((await prisma.scheduleMemberInstrumentAssignment.findUniqueOrThrow({ where: { id: next.id } })).createdById, user.id); assert.equal((await prisma.scheduleMemberInstrumentAssignment.findUnique({ where: { id: current.id } }))?.endedAt instanceof Date, true); });
    await test("REGISTERED identico e idempotente", async () => { const active = await prisma.scheduleMemberInstrumentAssignment.findFirstOrThrow({ where: { scheduleMemberId: participant.id, endedAt: null } }); const count = await prisma.scheduleMemberInstrumentAssignment.count({ where: { scheduleMemberId: participant.id } }); await myScheduleService.changeInstrument(participant.id, registered(yamaha.id, "novo motivo", active.id), session); assert.equal(await prisma.scheduleMemberInstrumentAssignment.count({ where: { scheduleMemberId: participant.id } }), count); });
    await test("REGISTERED para OWN encerra predecessor", async () => { const active = await prisma.scheduleMemberInstrumentAssignment.findFirstOrThrow({ where: { scheduleMemberId: participant.id, endedAt: null } }); const result = await myScheduleService.changeInstrument(participant.id, own("proprio", active.id), session); assert.equal(result.source, ScheduleInstrumentSource.OWN); assert.equal(result.instrument, null); });
    await test("OWN identico e idempotente", async () => { const active = await prisma.scheduleMemberInstrumentAssignment.findFirstOrThrow({ where: { scheduleMemberId: participant.id, endedAt: null } }); const count = await prisma.scheduleMemberInstrumentAssignment.count({ where: { scheduleMemberId: participant.id } }); await myScheduleService.changeInstrument(participant.id, own(undefined, active.id), session); assert.equal(await prisma.scheduleMemberInstrumentAssignment.count({ where: { scheduleMemberId: participant.id } }), count); assert.equal((await prisma.scheduleMemberInstrumentAssignment.findFirstOrThrow({ where: { scheduleMemberId: participant.id, endedAt: null } })).id, active.id); });
    await test("OWN para REGISTERED cria sucessor elegivel", async () => { const active = await prisma.scheduleMemberInstrumentAssignment.findFirstOrThrow({ where: { scheduleMemberId: participant.id, endedAt: null } }); const result = await myScheduleService.changeInstrument(participant.id, registered(tagima.id, "retorno", active.id), session); assert.equal(result.instrument?.id, tagima.id); });
    await test("motivo ausente, vazio ou whitespace bloqueia troca", async () => { const active = await prisma.scheduleMemberInstrumentAssignment.findFirstOrThrow({ where: { scheduleMemberId: participant.id, endedAt: null } }); for (const reason of [null, "", "   "]) await expectCode(() => myScheduleService.changeInstrument(participant.id, registered(yamaha.id, reason ?? undefined, active.id), session), "SCHEDULE_INSTRUMENT_REASON_REQUIRED"); assert.equal(myScheduleInstrumentChangeSchema.safeParse({ source: ScheduleInstrumentSource.REGISTERED, instrumentId: yamaha.id, changeReason: "x".repeat(501), currentAssignmentId: active.id }).success, false); const parsed = myScheduleInstrumentChangeSchema.parse({ source: ScheduleInstrumentSource.REGISTERED, instrumentId: yamaha.id, changeReason: "  motivo  ", currentAssignmentId: active.id }); assert.equal(parsed.changeReason, "motivo"); });
    await test("instrumentos inelegiveis e categoria divergente sao bloqueados", async () => { const active = await prisma.scheduleMemberInstrumentAssignment.findFirstOrThrow({ where: { scheduleMemberId: participant.id, endedAt: null } }); for (const instrumentId of [maintenance.id, inactive.id, deleted.id, guitarInstrument.id, "cm0000000000000000000000000"]) await expectCode(() => myScheduleService.changeInstrument(participant.id, registered(instrumentId, "teste", active.id), session), "SCHEDULE_INSTRUMENT_INVALID"); });
    await test("payload com categoria manipulada nao muda a categoria real", async () => { const active = await prisma.scheduleMemberInstrumentAssignment.findFirstOrThrow({ where: { scheduleMemberId: participant.id, endedAt: null } }); const parsed = myScheduleInstrumentChangeSchema.parse({ ...registered(yamaha.id, "categoria", active.id), instrumentCategoryId: guitar.id }); assert.equal("instrumentCategoryId" in parsed, false); await myScheduleService.changeInstrument(participant.id, { ...registered(yamaha.id, "categoria", active.id), instrumentCategoryId: guitar.id } as never, session); const result = await prisma.scheduleMemberInstrumentAssignment.findFirstOrThrow({ where: { scheduleMemberId: participant.id, endedAt: null } }); assert.equal(result.instrumentCategoryId, bass.id); });
    await test("stale currentAssignmentId e bloqueado", async () => { const active = await prisma.scheduleMemberInstrumentAssignment.findFirstOrThrow({ where: { scheduleMemberId: participant.id, endedAt: null } }); await myScheduleService.changeInstrument(participant.id, own("admin", active.id), session); await expectCode(() => myScheduleService.changeInstrument(participant.id, registered(tagima.id, "stale", active.id), session), "SCHEDULE_INSTRUMENT_STALE"); });
    await test("currentAssignmentId e obrigatorio e nao pode ser omitido", async () => {
      const active = await prisma.scheduleMemberInstrumentAssignment.findFirstOrThrow({ where: { scheduleMemberId: participant.id, endedAt: null } });
      assert.equal(myScheduleInstrumentChangeSchema.safeParse({ source: ScheduleInstrumentSource.REGISTERED, instrumentId: yamaha.id, changeReason: "sem snapshot" }).success, false);
      await expectCode(() => myScheduleService.changeInstrument(participant.id, { source: ScheduleInstrumentSource.REGISTERED, instrumentId: yamaha.id, changeReason: "sem snapshot" } as never, session), "SCHEDULE_INSTRUMENT_STALE");
      await expectCode(() => myScheduleService.changeInstrument(participant.id, registered(yamaha.id, "snapshot inexistente", "cm0000000000000000000000000"), session), "SCHEDULE_INSTRUMENT_STALE");
      assert.equal((await prisma.scheduleMemberInstrumentAssignment.findFirstOrThrow({ where: { scheduleMemberId: participant.id, endedAt: null } })).id, active.id);
    });
    await test("currentAssignmentId historico e rejeitado sem criar sucessor", async () => {
      const active = await prisma.scheduleMemberInstrumentAssignment.findFirstOrThrow({ where: { scheduleMemberId: participant.id, endedAt: null } });
      const historical = await prisma.scheduleMemberInstrumentAssignment.findFirstOrThrow({ where: { scheduleMemberId: participant.id, endedAt: { not: null } } });
      const count = await prisma.scheduleMemberInstrumentAssignment.count({ where: { scheduleMemberId: participant.id } });
      await expectCode(() => myScheduleService.changeInstrument(participant.id, registered(tagima.id, "historico", historical.id), session), "SCHEDULE_INSTRUMENT_STALE");
      assert.equal((await prisma.scheduleMemberInstrumentAssignment.findFirstOrThrow({ where: { scheduleMemberId: participant.id, endedAt: null } })).id, active.id);
      assert.equal(await prisma.scheduleMemberInstrumentAssignment.count({ where: { scheduleMemberId: participant.id } }), count);
    });
    await test("currentAssignmentId de outro participante e rejeitado", async () => {
      const p = await prisma.scheduleMember.create({ data: participantData(schedule.id, other.id, ScheduleMemberRole.INSTRUMENT) }); ids.participants.push(p.id);
      const assignment = await prisma.scheduleMemberInstrumentAssignment.create({ data: { scheduleMemberId: p.id, instrumentCategoryId: bass.id, source: ScheduleInstrumentSource.REGISTERED, instrumentId: tagima.id, createdById: otherUser.id, updatedById: otherUser.id } });
      await expectCode(() => myScheduleService.changeInstrument(participant.id, registered(yamaha.id, "outro", assignment.id), session), "SCHEDULE_INSTRUMENT_STALE");
    });
    await test("duas trocas simultaneas mantem exatamente um assignment ativo", async () => {
      const concurrent = await prisma.scheduleMember.create({ data: participantData(schedule.id, member.id, ScheduleMemberRole.INSTRUMENT) }); ids.participants.push(concurrent.id);
      const initial = await prisma.scheduleMemberInstrumentAssignment.create({ data: { scheduleMemberId: concurrent.id, instrumentCategoryId: bass.id, source: ScheduleInstrumentSource.REGISTERED, instrumentId: tagima.id, createdById: user.id, updatedById: user.id } });
      const results = await Promise.allSettled([myScheduleService.changeInstrument(concurrent.id, registered(yamaha.id, "yamaha", initial.id), session), myScheduleService.changeInstrument(concurrent.id, own("proprio", initial.id), session)]);
      const active = await prisma.scheduleMemberInstrumentAssignment.findMany({ where: { scheduleMemberId: concurrent.id, endedAt: null } });
      assert.equal(active.length, 1); assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      assert.equal(await prisma.scheduleMemberInstrumentAssignment.count({ where: { scheduleMemberId: concurrent.id } }), 2);
    });    const adminAuthorization = { user: { id: user.id }, accessContext: { scope: ScheduleScope.ALL, memberId: null, authorizedMinistryIds: null } } as never;
    await test("self-service e fluxo administrativo concorrem sem duplicar assignment ativo", async () => {
      const p = await prisma.scheduleMember.create({ data: participantData(schedule.id, member.id, ScheduleMemberRole.INSTRUMENT) }); ids.participants.push(p.id);
      const initial = await prisma.scheduleMemberInstrumentAssignment.create({ data: { scheduleMemberId: p.id, instrumentCategoryId: bass.id, source: ScheduleInstrumentSource.REGISTERED, instrumentId: tagima.id, createdById: user.id, updatedById: user.id } });
      const results = await Promise.allSettled([myScheduleService.changeInstrument(p.id, own("membro", initial.id), session), scheduleInstrumentAssignmentService.createInitial(schedule.id, p.id, { source: ScheduleInstrumentSource.REGISTERED, instrumentCategoryId: bass.id, instrumentId: yamaha.id }, adminAuthorization)]);
      const history = await prisma.scheduleMemberInstrumentAssignment.findMany({ where: { scheduleMemberId: p.id }, orderBy: { startedAt: "asc" } });
      const active = history.filter((item) => item.endedAt === null);
      assert.equal(active.length, 1);
      assert.ok(active[0].source === ScheduleInstrumentSource.OWN || active[0].instrumentId === yamaha.id);
      assert.ok(results.some((item) => item.status === "fulfilled"));
    });
    await test("admin primeiro torna snapshot do membro obsoleto", async () => {
      const p = await prisma.scheduleMember.create({ data: participantData(schedule.id, member.id, ScheduleMemberRole.INSTRUMENT) }); ids.participants.push(p.id);
      const initial = await prisma.scheduleMemberInstrumentAssignment.create({ data: { scheduleMemberId: p.id, instrumentCategoryId: bass.id, source: ScheduleInstrumentSource.REGISTERED, instrumentId: tagima.id, createdById: user.id, updatedById: user.id } });
      await scheduleInstrumentAssignmentService.createInitial(schedule.id, p.id, { source: ScheduleInstrumentSource.REGISTERED, instrumentCategoryId: bass.id, instrumentId: yamaha.id }, adminAuthorization);
      await expectCode(() => myScheduleService.changeInstrument(p.id, own("stale", initial.id), session), "SCHEDULE_INSTRUMENT_STALE");
      const active = await prisma.scheduleMemberInstrumentAssignment.findFirstOrThrow({ where: { scheduleMemberId: p.id, endedAt: null } }); assert.equal(active.instrumentId, yamaha.id);
    });
    await test("mudanca de role primeiro bloqueia troca e encerra assignment", async () => {
      const p = await prisma.scheduleMember.create({ data: participantData(schedule.id, member.id, ScheduleMemberRole.INSTRUMENT) }); ids.participants.push(p.id);
      const initial = await prisma.scheduleMemberInstrumentAssignment.create({ data: { scheduleMemberId: p.id, instrumentCategoryId: bass.id, source: ScheduleInstrumentSource.REGISTERED, instrumentId: tagima.id, createdById: user.id, updatedById: user.id } });
      const acquired = deferred(); const release = deferred();
      const originalLock = scheduleRepository.lockByIdWithinScope.bind(scheduleRepository);
      scheduleRepository.lockByIdWithinScope = async (...args: Parameters<typeof originalLock>) => { const value = await originalLock(...args); acquired.resolve(); await release.promise; return value; };
      try {
        const adminPromise = scheduleService.updateMember(schedule.id, p.id, { roles: [ScheduleMemberRole.VOCAL] }, adminAuthorization);
        await acquired.promise;
        const memberPromise = myScheduleService.changeInstrument(p.id, own("role", initial.id), session);
        release.resolve();
        const [adminResult, memberResult] = await Promise.allSettled([adminPromise, memberPromise]);
        assert.equal(adminResult.status, "fulfilled"); assert.equal(settledCode(memberResult), "SCHEDULE_INSTRUMENT_ROLE_REQUIRED");
        assert.ok(![settledCode(adminResult), settledCode(memberResult)].includes("P2028"));
      } finally { scheduleRepository.lockByIdWithinScope = originalLock; release.resolve(); }
      const currentParticipant = await prisma.scheduleMember.findUniqueOrThrow({ where: { id: p.id }, include: { roles: true } });
      const history = await prisma.scheduleMemberInstrumentAssignment.findMany({ where: { scheduleMemberId: p.id } });
      assert.deepEqual(getScheduleMemberRoles(currentParticipant), [ScheduleMemberRole.VOCAL]); assert.equal(history.filter((item) => item.endedAt === null).length, 0);
      assert.equal(history.length, 1); assert.equal(history[0].id, initial.id); assert.ok(history[0].endedAt);
    });
    await test("troca do membro primeiro e encerrada pela mudanca posterior de role", async () => {
      const p = await prisma.scheduleMember.create({ data: participantData(schedule.id, member.id, ScheduleMemberRole.INSTRUMENT) }); ids.participants.push(p.id);
      const initial = await prisma.scheduleMemberInstrumentAssignment.create({ data: { scheduleMemberId: p.id, instrumentCategoryId: bass.id, source: ScheduleInstrumentSource.REGISTERED, instrumentId: tagima.id, createdById: user.id, updatedById: user.id } });
      const acquired = deferred(); const release = deferred();
      const originalLock = scheduleRepository.lockById.bind(scheduleRepository);
      scheduleRepository.lockById = async (...args: Parameters<typeof originalLock>) => { const value = await originalLock(...args); acquired.resolve(); await release.promise; return value; };
      try {
        const memberPromise = myScheduleService.changeInstrument(p.id, own("role", initial.id), session);
        await acquired.promise;
        const adminPromise = scheduleService.updateMember(schedule.id, p.id, { roles: [ScheduleMemberRole.VOCAL] }, adminAuthorization);
        release.resolve();
        const [memberResult, adminResult] = await Promise.allSettled([memberPromise, adminPromise]);
        assert.equal(memberResult.status, "fulfilled"); assert.equal(adminResult.status, "fulfilled");
        assert.ok(![settledCode(memberResult), settledCode(adminResult)].includes("P2028"));
      } finally { scheduleRepository.lockById = originalLock; release.resolve(); }
      const currentParticipant = await prisma.scheduleMember.findUniqueOrThrow({ where: { id: p.id }, include: { roles: true } });
      const history = await prisma.scheduleMemberInstrumentAssignment.findMany({ where: { scheduleMemberId: p.id }, orderBy: { startedAt: "asc" } });
      assert.deepEqual(getScheduleMemberRoles(currentParticipant), [ScheduleMemberRole.VOCAL]); assert.equal(history.filter((item) => item.endedAt === null).length, 0);
      assert.equal(history.length, 2); assert.ok(history.every((item) => item.endedAt)); assert.ok(history.some((item) => item.source === ScheduleInstrumentSource.OWN));
    });
    await test("concorrencia livre entre troca e role preserva invariant", async () => {
      const p = await prisma.scheduleMember.create({ data: participantData(schedule.id, member.id, ScheduleMemberRole.INSTRUMENT) }); ids.participants.push(p.id);
      const initial = await prisma.scheduleMemberInstrumentAssignment.create({ data: { scheduleMemberId: p.id, instrumentCategoryId: bass.id, source: ScheduleInstrumentSource.REGISTERED, instrumentId: tagima.id, createdById: user.id, updatedById: user.id } });
      const results = await Promise.allSettled([myScheduleService.changeInstrument(p.id, own("role", initial.id), session), scheduleService.updateMember(schedule.id, p.id, { roles: [ScheduleMemberRole.VOCAL] }, adminAuthorization)]);
      assert.ok(!results.map(settledCode).includes("P2028")); assert.ok(!results.map(settledCode).includes("40P01"));
      const currentParticipant = await prisma.scheduleMember.findUniqueOrThrow({ where: { id: p.id }, include: { roles: true } });
      const history = await prisma.scheduleMemberInstrumentAssignment.findMany({ where: { scheduleMemberId: p.id } });
      assert.deepEqual(getScheduleMemberRoles(currentParticipant), [ScheduleMemberRole.VOCAL]); assert.equal(history.filter((item) => item.endedAt === null).length, 0);
      assert.ok(history.some((item) => item.id === initial.id)); assert.ok(history.every((item) => item.endedAt));
    });
    const replacementData = {
      status: ScheduleMemberStatus.REPLACED,
      replacedByMemberId: replacement.id,
      allowMinistryException: true
    };
    const assertReplacementInvariant = async (participantId: string, initialAssignmentId: string) => {
      const original = await prisma.scheduleMember.findUniqueOrThrow({ where: { id: participantId } });
      const history = await prisma.scheduleMemberInstrumentAssignment.findMany({ where: { scheduleMemberId: participantId }, orderBy: { startedAt: "asc" } });
      const replacementAssignments = await prisma.scheduleMemberInstrumentAssignment.count({
        where: { scheduleMember: { scheduleId: schedule.id, memberId: replacement.id } }
      });
      assert.equal(original.status, ScheduleMemberStatus.REPLACED);
      assert.equal(original.replacedByMemberId, replacement.id);
      assert.equal(history.filter((item) => item.endedAt === null).length, 0);
      assert.ok(history.some((item) => item.id === initialAssignmentId));
      assert.ok(history.every((item) => item.endedAt));
      assert.equal(replacementAssignments, 0);
      return history;
    };
    await test("substituicao primeiro bloqueia troca self-service e nao transfere assignment", async () => {
      const p = await prisma.scheduleMember.create({ data: participantData(schedule.id, member.id, ScheduleMemberRole.INSTRUMENT) }); ids.participants.push(p.id);
      const initial = await prisma.scheduleMemberInstrumentAssignment.create({ data: { scheduleMemberId: p.id, instrumentCategoryId: bass.id, source: ScheduleInstrumentSource.REGISTERED, instrumentId: tagima.id, createdById: user.id, updatedById: user.id } });
      const acquired = deferred(); const release = deferred();
      const originalLock = scheduleRepository.lockByIdWithinScope.bind(scheduleRepository);
      scheduleRepository.lockByIdWithinScope = async (...args: Parameters<typeof originalLock>) => { const value = await originalLock(...args); acquired.resolve(); await release.promise; return value; };
      try {
        const adminPromise = scheduleService.updateMember(schedule.id, p.id, replacementData, adminAuthorization);
        await acquired.promise;
        const memberPromise = myScheduleService.changeInstrument(p.id, registered(yamaha.id, "substituicao", initial.id), session);
        release.resolve();
        const [adminResult, memberResult] = await Promise.allSettled([adminPromise, memberPromise]);
        assert.equal(adminResult.status, "fulfilled");
        assert.equal(settledCode(memberResult), "SCHEDULE_INSTRUMENT_MEMBER_INACTIVE");
        assert.ok(![settledCode(adminResult), settledCode(memberResult)].includes("P2028"));
        assert.ok(![settledCode(adminResult), settledCode(memberResult)].includes("40P01"));
      } finally { scheduleRepository.lockByIdWithinScope = originalLock; release.resolve(); }
      const history = await assertReplacementInvariant(p.id, initial.id);
      assert.equal(history.length, 1);
    });
    await test("troca self-service primeiro e encerrada pela substituicao posterior", async () => {
      const p = await prisma.scheduleMember.create({ data: participantData(schedule.id, member.id, ScheduleMemberRole.INSTRUMENT) }); ids.participants.push(p.id);
      const initial = await prisma.scheduleMemberInstrumentAssignment.create({ data: { scheduleMemberId: p.id, instrumentCategoryId: bass.id, source: ScheduleInstrumentSource.REGISTERED, instrumentId: tagima.id, createdById: user.id, updatedById: user.id } });
      const acquired = deferred(); const release = deferred();
      const originalLock = scheduleRepository.lockById.bind(scheduleRepository);
      scheduleRepository.lockById = async (...args: Parameters<typeof originalLock>) => { const value = await originalLock(...args); acquired.resolve(); await release.promise; return value; };
      try {
        const memberPromise = myScheduleService.changeInstrument(p.id, registered(yamaha.id, "substituicao", initial.id), session);
        await acquired.promise;
        const adminPromise = scheduleService.updateMember(schedule.id, p.id, replacementData, adminAuthorization);
        release.resolve();
        const [memberResult, adminResult] = await Promise.allSettled([memberPromise, adminPromise]);
        assert.equal(memberResult.status, "fulfilled");
        assert.equal(adminResult.status, "fulfilled");
        assert.ok(![settledCode(memberResult), settledCode(adminResult)].includes("P2028"));
        assert.ok(![settledCode(memberResult), settledCode(adminResult)].includes("40P01"));
      } finally { scheduleRepository.lockById = originalLock; release.resolve(); }
      const history = await assertReplacementInvariant(p.id, initial.id);
      assert.equal(history.length, 2);
      assert.ok(history.some((item) => item.instrumentId === yamaha.id));
    });
    await test("concorrencia livre entre troca self-service e substituicao preserva invariant", async () => {
      const p = await prisma.scheduleMember.create({ data: participantData(schedule.id, member.id, ScheduleMemberRole.INSTRUMENT) }); ids.participants.push(p.id);
      const initial = await prisma.scheduleMemberInstrumentAssignment.create({ data: { scheduleMemberId: p.id, instrumentCategoryId: bass.id, source: ScheduleInstrumentSource.REGISTERED, instrumentId: tagima.id, createdById: user.id, updatedById: user.id } });
      const results = await Promise.allSettled([
        myScheduleService.changeInstrument(p.id, registered(yamaha.id, "substituicao", initial.id), session),
        scheduleService.updateMember(schedule.id, p.id, replacementData, adminAuthorization)
      ]);
      assert.equal(results[1].status, "fulfilled");
      assert.ok(!results.map(settledCode).includes("P2028"));
      assert.ok(!results.map(settledCode).includes("40P01"));
      const history = await assertReplacementInvariant(p.id, initial.id);
      assert.ok(history.length === 1 || history.length === 2);
    });
    await test("falha real apos encerrar predecessor reverte toda a troca", async () => {
      const p = await prisma.scheduleMember.create({ data: participantData(schedule.id, member.id, ScheduleMemberRole.INSTRUMENT) }); ids.participants.push(p.id);
      const initial = await prisma.scheduleMemberInstrumentAssignment.create({
        data: {
          scheduleMemberId: p.id,
          instrumentCategoryId: bass.id,
          source: ScheduleInstrumentSource.REGISTERED,
          instrumentId: tagima.id,
          changeReason: "estado inicial",
          createdById: otherUser.id,
          updatedById: otherUser.id
        }
      });
      const snapshot = await prisma.scheduleMemberInstrumentAssignment.findUniqueOrThrow({ where: { id: initial.id } });
      const originalEndActive = scheduleInstrumentAssignmentRepository.endActive.bind(scheduleInstrumentAssignmentRepository);
      const originalCreateInitial = scheduleInstrumentAssignmentRepository.createInitial.bind(scheduleInstrumentAssignmentRepository);
      let predecessorMutationCompleted = false;
      scheduleInstrumentAssignmentRepository.endActive = async (...args: Parameters<typeof originalEndActive>) => {
        const result = await originalEndActive(...args);
        predecessorMutationCompleted = result.count === 1;
        return result;
      };
      scheduleInstrumentAssignmentRepository.createInitial = (...args: Parameters<typeof originalCreateInitial>) => {
        const [scheduleMemberId, input, , database] = args;
        return originalCreateInitial(scheduleMemberId, input, key("missing_user"), database);
      };
      try {
        await assert.rejects(
          () => myScheduleService.changeInstrument(p.id, registered(yamaha.id, "rollback real", initial.id), session),
          (error: unknown) => Boolean(error && typeof error === "object" && (error as { code?: string }).code === "P2003")
        );
      } finally {
        scheduleInstrumentAssignmentRepository.endActive = originalEndActive;
        scheduleInstrumentAssignmentRepository.createInitial = originalCreateInitial;
      }
      assert.equal(predecessorMutationCompleted, true);
      const afterRollback = await prisma.scheduleMemberInstrumentAssignment.findUniqueOrThrow({ where: { id: initial.id } });
      const historyAfterRollback = await prisma.scheduleMemberInstrumentAssignment.findMany({ where: { scheduleMemberId: p.id } });
      assert.deepEqual(afterRollback, snapshot);
      assert.equal(historyAfterRollback.length, 1);
      assert.equal(historyAfterRollback.filter((item) => item.endedAt === null).length, 1);
      assert.equal(historyAfterRollback.filter((item) => item.createdById === user.id).length, 0);

      const validSuccessor = await myScheduleService.changeInstrument(p.id, registered(yamaha.id, "apos rollback", initial.id), session);
      const historyAfterSuccess = await prisma.scheduleMemberInstrumentAssignment.findMany({ where: { scheduleMemberId: p.id }, orderBy: { startedAt: "asc" } });
      assert.equal(validSuccessor.instrument?.id, yamaha.id);
      assert.equal(historyAfterSuccess.length, 2);
      assert.equal(historyAfterSuccess.filter((item) => item.endedAt === null).length, 1);
      assert.equal(historyAfterSuccess.find((item) => item.id === initial.id)?.endedAt instanceof Date, true);
      assert.equal(historyAfterSuccess.find((item) => item.id === validSuccessor.id)?.createdById, user.id);
    });
    await test("participacao CONFIRMED continua elegivel", async () => { await prisma.scheduleMember.update({ where: { id: participant.id }, data: { status: ScheduleMemberStatus.CONFIRMED } }); const active = await prisma.scheduleMemberInstrumentAssignment.findFirstOrThrow({ where: { scheduleMemberId: participant.id, endedAt: null } }); await myScheduleService.changeInstrument(participant.id, own(undefined, active.id), session); await prisma.scheduleMember.update({ where: { id: participant.id }, data: { status: ScheduleMemberStatus.PENDING } }); });
    for (const status of [ScheduleMemberStatus.DECLINED, ScheduleMemberStatus.REPLACED, ScheduleMemberStatus.ABSENT]) await test(`participacao ${status} e bloqueada`, async () => { await prisma.scheduleMember.update({ where: { id: participant.id }, data: { status } }); const active = await prisma.scheduleMemberInstrumentAssignment.findFirstOrThrow({ where: { scheduleMemberId: participant.id, endedAt: null } }); await expectCode(() => myScheduleService.changeInstrument(participant.id, own("x", active.id), session), "SCHEDULE_INSTRUMENT_MEMBER_INACTIVE"); await expectCode(() => myScheduleService.getInstrumentChange(participant.id, session), "SCHEDULE_INSTRUMENT_MEMBER_INACTIVE"); await prisma.scheduleMember.update({ where: { id: participant.id }, data: { status: ScheduleMemberStatus.PENDING } }); });
    await test("somente schedule PUBLISHED permite self-service", async () => { const active = await prisma.scheduleMemberInstrumentAssignment.findFirstOrThrow({ where: { scheduleMemberId: participant.id, endedAt: null } }); for (const status of [ScheduleStatus.DRAFT, ScheduleStatus.COMPLETED, ScheduleStatus.CANCELED]) { await prisma.schedule.update({ where: { id: schedule.id }, data: { status } }); await expectCode(() => myScheduleService.changeInstrument(participant.id, own("x", active.id), session), "SCHEDULE_INSTRUMENT_CLOSED"); await expectCode(() => myScheduleService.getInstrumentChange(participant.id, session), "SCHEDULE_INSTRUMENT_CLOSED"); } });
    console.log(`Member schedule instrument change: ${scenarios} scenarios passed.`);
  } finally { await prisma.scheduleMemberInstrumentAssignment.deleteMany({ where: { scheduleMember: { scheduleId: { in: ids.schedules } } } }); await prisma.scheduleMember.deleteMany({ where: { scheduleId: { in: ids.schedules } } }); await prisma.schedule.deleteMany({ where: { id: { in: ids.schedules } } }); await prisma.instrument.deleteMany({ where: { id: { in: ids.instruments } } }); await prisma.instrumentCategory.deleteMany({ where: { id: { in: ids.categories } } }); await prisma.user.deleteMany({ where: { id: { in: ids.users } } }); await prisma.member.deleteMany({ where: { id: { in: ids.members } } }); await prisma.ministry.deleteMany({ where: { id: { in: ids.ministries } } }); await prisma.$disconnect(); }
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
