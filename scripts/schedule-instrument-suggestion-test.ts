import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  InstrumentStatus,
  PrismaClient,
  ScheduleInstrumentSource,
  ScheduleMemberRole,
  ScheduleMemberStatus,
  ScheduleScope,
  ScheduleStatus
} from "@prisma/client";
import type { ScheduleAuthorization } from "@/lib/schedule-authorization";
import { buildInstrumentSuggestionHistoryWhere } from "@/repositories/schedule-instrument-assignment.repository";
import { scheduleInstrumentAssignmentService } from "@/services/schedule-instrument-assignment.service";
import { scheduleInstrumentSuggestionQuerySchema } from "@/validators/schedule-instrument-assignment.validator";

const prisma = new PrismaClient();
const stamp = Date.now().toString();
const key = (value: string) => `__instrument_suggestion_${stamp}_${value}`;
let scenarios = 0;

async function test(name: string, run: () => void | Promise<void>) {
  await run();
  scenarios += 1;
  console.log(`PASS ${scenarios}: ${name}`);
}

function requireDevelopmentDatasource() {
  const values = [process.env.DATABASE_URL, process.env.DIRECT_URL].filter(Boolean) as string[];
  assert.equal(values.length, 2, "DATABASE_URL e DIRECT_URL do Development sao obrigatorias.");
  for (const value of values) {
    const url = new URL(value);
    assert.match(url.hostname, /^ep-twilight-haze-adynpvs9(?:-pooler)?\./, "Somente o compute Neon Development e permitido.");
    assert.equal(url.pathname.replace(/^\//, ""), "ibe", "O database Development deve ser ibe.");
    assert.equal(url.searchParams.get("schema") ?? "public", "public", "O schema deve ser public.");
  }
}

async function main() {
  const [routeSource, managerSource, repositorySource, serviceSource] = await Promise.all([
    readFile("src/app/api/schedules/[id]/instrument-suggestion/route.ts", "utf8"),
    readFile("src/components/schedules/ScheduleDetailManager.tsx", "utf8"),
    readFile("src/repositories/schedule-instrument-assignment.repository.ts", "utf8"),
    readFile("src/services/schedule-instrument-assignment.service.ts", "utf8")
  ]);

  await test("endpoint exige schedule.update pelo fluxo oficial", () => {
    assert.match(routeSource, /requireScheduleAccess\("schedule\.update"\)/);
  });
  await test("endpoint valida memberId e nao recebe historico no payload", () => {
    assert.match(routeSource, /scheduleInstrumentSuggestionQuerySchema/);
    assert.doesNotMatch(routeSource, /POST|PUT|DELETE/);
  });
  await test("memberId ausente ou invalido e rejeitado pelo validator", () => {
    assert.equal(scheduleInstrumentSuggestionQuerySchema.safeParse({}).success, false);
    assert.equal(scheduleInstrumentSuggestionQuerySchema.safeParse({ memberId: "invalido" }).success, false);
  });
  await test("nao existe bypass administrativo por role", () => {
    assert.doesNotMatch(routeSource + serviceSource, /ADMIN|SUPER_ADMIN|role\s*===/);
  });
  await test("assignment comprova historico INSTRUMENT mesmo se a role atual mudou", () => {
    const where = buildInstrumentSuggestionHistoryWhere({
      memberId: "member",
      scheduleId: "schedule",
      scheduleDate: new Date("2099-08-24T00:00:00.000Z"),
      scheduleStartTime: "10:00"
    });
    assert.equal("role" in where, false);
    assert.deepEqual(where.instrumentAssignments, { some: {} });
  });
  await test("participacao substituida e ignorada conservadoramente", () => {
    const where = buildInstrumentSuggestionHistoryWhere({
      memberId: "member",
      scheduleId: "schedule",
      scheduleDate: new Date("2099-08-24T00:00:00.000Z"),
      scheduleStartTime: "10:00"
    });
    assert.deepEqual(where.status, { not: ScheduleMemberStatus.REPLACED });
  });
  await test("consulta nao depende de MemberMinistry", () => {
    assert.doesNotMatch(repositorySource + serviceSource, /memberMinistry|findActiveMemberMinistry/);
  });
  await test("consulta exige assignment conhecido e ignora participacao vazia", () => {
    assert.match(repositorySource, /instrumentAssignments:\s*\{ some: \{\} \}/);
  });
  await test("consulta exclui escala atual e cancelada", () => {
    assert.match(repositorySource, /scheduleId: \{ not: input\.scheduleId \}/);
    assert.match(repositorySource, /ScheduleStatus\.CANCELED/);
  });
  await test("cronologia usa date da escala e nao createdAt", () => {
    assert.match(repositorySource, /schedule:\s*\{ date: "desc" \}/);
    assert.doesNotMatch(repositorySource.match(/findLatestInstrumentSuggestionHistory[\s\S]*?\n  \},/)?.[0] ?? "", /createdAt: "desc"/);
  });
  await test("mesmo dia aceita somente horario conhecido estritamente anterior", () => {
    assert.match(repositorySource, /startTime: \{ not: null, lt: input\.scheduleStartTime \}/);
  });
  await test("assignment final possui ordenacao deterministica", () => {
    assert.match(repositorySource, /startedAt: "desc"[\s\S]*createdAt: "desc"[\s\S]*id: "desc"/);
  });
  await test("resposta tardia e descartada por requestId e memberId", () => {
    assert.match(managerSource, /requestId !== suggestionRequest\.current/);
    assert.match(managerSource, /current\.memberId !== memberId/);
  });
  await test("troca manual de role invalida request pendente", () => {
    assert.match(managerSource, /function updateRole[\s\S]*suggestionRequest\.current \+= 1/);
  });
  await test("remover a funcao instrumental limpa o estado do instrumento", () => {
    assert.match(managerSource, /!checked && role === ScheduleMemberRole\.INSTRUMENT[\s\S]*instrumentAssignment: undefined/);
  });
  await test("sugestao e somente GET e submit oficial continua POST ou PUT", () => {
    assert.match(managerSource, /instrument-suggestion\?memberId=/);
    assert.match(managerSource, /method: editingId \? "PUT" : "POST"/);
  });
  await test("UI possui loading e mensagem acessivel", () => {
    assert.match(managerSource, /isSuggestionLoading/);
    assert.match(managerSource, /Sugestao baseada na ultima escala como instrumentista/);
    assert.match(managerSource, /role="status"/);
  });
  await test("service reutiliza elegibilidade oficial atual", () => {
    assert.match(serviceSource, /findCategoryForNewAssignment/);
    assert.match(serviceSource, /findEligibleInstrument/);
  });
  await test("DTO nao inclui dados pessoais, autoria ou linha do tempo", () => {
    const responseBlock = serviceSource.slice(serviceSource.indexOf("async getSuggestion"), serviceSource.indexOf("async getCurrent"));
    for (const forbidden of ["email", "username", "passwordHash", "createdBy", "assignments:"]) {
      assert.doesNotMatch(responseBlock, new RegExp(forbidden, "i"));
    }
  });
  await test("consulta nao adquire lock nem executa escrita", () => {
    const suggestionBlock = repositorySource.slice(
      repositorySource.indexOf("findLatestInstrumentSuggestionHistory"),
      repositorySource.indexOf("findCurrent")
    );
    assert.doesNotMatch(suggestionBlock, /FOR UPDATE|create\(|update\(|delete\(|transaction/);
  });

  requireDevelopmentDatasource();

  const ids = {
    ministries: [] as string[],
    members: [] as string[],
    memberMinistries: [] as string[],
    schedules: [] as string[],
    participants: [] as string[],
    categories: [] as string[],
    instruments: [] as string[]
  };

  const user = await prisma.user.findFirst({ where: { isActive: true }, select: { id: true } });
  assert.ok(user, "Development precisa conter um usuario ativo para autoria dos fixtures.");
  const authorization = {
    user: { id: user.id },
    accessContext: { scope: ScheduleScope.ALL, memberId: null, authorizedMinistryIds: null }
  } as unknown as ScheduleAuthorization;

  const createMember = async (suffix: string) => {
    const member = await prisma.member.create({ data: { name: key(suffix) } });
    ids.members.push(member.id);
    return member;
  };
  const createSchedule = async (ministryId: string, suffix: string, date: string, startTime: string | null = null) => {
    const schedule = await prisma.schedule.create({
      data: { title: key(suffix), ministryId, date: new Date(`${date}T00:00:00.000Z`), startTime, createdById: user.id }
    });
    ids.schedules.push(schedule.id);
    return schedule;
  };
  const participate = async (scheduleId: string, memberId: string, role: ScheduleMemberRole) => {
    const participant = await prisma.scheduleMember.create({
      data: { scheduleId, memberId, createdById: user.id, roles: { create: { role } } }
    });
    ids.participants.push(participant.id);
    return participant;
  };
  const assign = async (
    scheduleMemberId: string,
    categoryId: string,
    source: ScheduleInstrumentSource,
    instrumentId: string | null,
    startedAt: string,
    endedAt: string | null = null
  ) => prisma.scheduleMemberInstrumentAssignment.create({
    data: {
      scheduleMemberId,
      instrumentCategoryId: categoryId,
      source,
      instrumentId,
      startedAt: new Date(startedAt),
      endedAt: endedAt ? new Date(endedAt) : null,
      createdById: user.id,
      updatedById: user.id
    }
  });

  try {
    const ministry = await prisma.ministry.create({ data: { name: key("ministry"), slug: key("ministry") } });
    ids.ministries.push(ministry.id);
    const bass = await prisma.instrumentCategory.create({ data: { name: key("bass") } });
    const guitar = await prisma.instrumentCategory.create({ data: { name: key("guitar") } });
    const retiredCategory = await prisma.instrumentCategory.create({ data: { name: key("retired-category") } });
    ids.categories.push(bass.id, guitar.id, retiredCategory.id);

    const createInstrument = async (suffix: string, categoryId: string, status: InstrumentStatus = InstrumentStatus.ACTIVE) => {
      const instrument = await prisma.instrument.create({ data: { name: key(suffix), categoryId, status } });
      ids.instruments.push(instrument.id);
      return instrument;
    };
    const tagima = await createInstrument("tagima", bass.id);
    const yamaha = await createInstrument("yamaha", bass.id);
    const maintenance = await createInstrument("maintenance", bass.id, InstrumentStatus.MAINTENANCE);
    const inactive = await createInstrument("inactive", bass.id, InstrumentStatus.INACTIVE);
    const deleted = await createInstrument("deleted", bass.id);
    await prisma.instrument.update({ where: { id: deleted.id }, data: { deletedAt: new Date() } });
    const movedCategory = await createInstrument("moved-category", bass.id);

    const normal = await createMember("normal");
    const exception = await createMember("exception");
    const ownMember = await createMember("own");
    const noHistory = await createMember("none");
    const noAssignment = await createMember("without-assignment");
    const maintenanceMember = await createMember("maintenance-member");
    const inactiveMember = await createMember("inactive-member");
    const deletedMember = await createMember("deleted-member");
    const invalidCategoryMember = await createMember("invalid-category-member");
    const mismatchMember = await createMember("mismatch-member");
    const sameDayMember = await createMember("same-day-member");
    const sameTimeMember = await createMember("same-time-member");
    const roleChangedMember = await createMember("role-changed-member");
    const replacedMember = await createMember("replaced-member");
    const replacementMember = await createMember("replacement-member");
    const canceledMember = await createMember("canceled-member");
    const removedScheduleMember = await createMember("removed-schedule-member");
    const transitionOwnMember = await createMember("transition-own-member");
    const transitionYamahaMember = await createMember("transition-yamaha-member");
    const transitionTagimaMember = await createMember("transition-tagima-member");

    const membership = await prisma.memberMinistry.create({
      data: { memberId: normal.id, ministryId: ministry.id, entryDate: new Date("2099-01-01T00:00:00.000Z") }
    });
    ids.memberMinistries.push(membership.id);

    const target = await createSchedule(ministry.id, "target", "2099-08-24", "10:00");
    const old = await createSchedule(ministry.id, "old", "2099-08-10", "09:00");
    const recentNonInstrument = await createSchedule(ministry.id, "recent-vocal", "2099-08-17", "09:00");
    const recentBacking = await createSchedule(ministry.id, "recent-backing", "2099-08-18", "09:00");
    const future = await createSchedule(ministry.id, "future", "2099-08-31", "09:00");

    const oldNormal = await participate(old.id, normal.id, ScheduleMemberRole.INSTRUMENT);
    await assign(oldNormal.id, bass.id, ScheduleInstrumentSource.REGISTERED, tagima.id, "2099-08-10T09:00:00.000Z", "2099-08-10T09:30:00.000Z");
    await assign(oldNormal.id, bass.id, ScheduleInstrumentSource.REGISTERED, yamaha.id, "2099-08-10T09:30:00.000Z", "2099-08-10T10:00:00.000Z");
    await participate(recentNonInstrument.id, normal.id, ScheduleMemberRole.VOCAL);
    await participate(recentBacking.id, normal.id, ScheduleMemberRole.OTHER);
    const futureNormal = await participate(future.id, normal.id, ScheduleMemberRole.INSTRUMENT);
    await assign(futureNormal.id, bass.id, ScheduleInstrumentSource.OWN, null, "2099-08-31T09:00:00.000Z");

    await test("membro normal sugere REGISTERED final da participacao instrumental anterior", async () => {
      const result = await scheduleInstrumentAssignmentService.getSuggestion(target.id, normal.id, authorization);
      assert.equal(result.role, ScheduleMemberRole.INSTRUMENT);
      assert.equal(result.source, ScheduleInstrumentSource.REGISTERED);
      assert.equal(result.instrument?.id, yamaha.id);
    });
    await test("VOCAL mais recente nao invalida historico INSTRUMENT", async () => {
      const result = await scheduleInstrumentAssignmentService.getSuggestion(target.id, normal.id, authorization);
      assert.equal(result.instrumentCategory?.id, bass.id);
    });
    await test("outra role mais recente sem assignment nao invalida historico INSTRUMENT", async () => {
      const result = await scheduleInstrumentAssignmentService.getSuggestion(target.id, normal.id, authorization);
      assert.equal(result.instrument?.id, yamaha.id);
    });
    await test("escala futura cadastrada nao contamina sugestao", async () => {
      const result = await scheduleInstrumentAssignmentService.getSuggestion(target.id, normal.id, authorization);
      assert.equal(result.source, ScheduleInstrumentSource.REGISTERED);
    });
    await test("troca Tagima para Yamaha sugere Yamaha final", async () => {
      const result = await scheduleInstrumentAssignmentService.getSuggestion(target.id, normal.id, authorization);
      assert.equal(result.instrument?.id, yamaha.id);
    });
    await test("assignment final encerrado continua sendo a configuracao final conhecida", async () => {
      const result = await scheduleInstrumentAssignmentService.getSuggestion(target.id, normal.id, authorization);
      assert.equal(result.instrument?.id, yamaha.id);
    });

    const transitionOwn = await participate(old.id, transitionOwnMember.id, ScheduleMemberRole.INSTRUMENT);
    await assign(transitionOwn.id, bass.id, ScheduleInstrumentSource.REGISTERED, tagima.id, "2099-08-10T04:00:00.000Z", "2099-08-10T04:10:00.000Z");
    await assign(transitionOwn.id, bass.id, ScheduleInstrumentSource.OWN, null, "2099-08-10T04:10:00.000Z");
    await test("troca REGISTERED para OWN sugere OWN", async () => {
      const result = await scheduleInstrumentAssignmentService.getSuggestion(target.id, transitionOwnMember.id, authorization);
      assert.equal(result.source, ScheduleInstrumentSource.OWN);
      assert.equal(result.instrument, null);
    });

    const transitionYamaha = await participate(old.id, transitionYamahaMember.id, ScheduleMemberRole.INSTRUMENT);
    await assign(transitionYamaha.id, bass.id, ScheduleInstrumentSource.REGISTERED, tagima.id, "2099-08-10T03:00:00.000Z", "2099-08-10T03:10:00.000Z");
    await assign(transitionYamaha.id, bass.id, ScheduleInstrumentSource.OWN, null, "2099-08-10T03:10:00.000Z", "2099-08-10T03:20:00.000Z");
    await assign(transitionYamaha.id, bass.id, ScheduleInstrumentSource.REGISTERED, yamaha.id, "2099-08-10T03:20:00.000Z");
    await test("troca Tagima para OWN para Yamaha sugere Yamaha", async () => {
      const result = await scheduleInstrumentAssignmentService.getSuggestion(target.id, transitionYamahaMember.id, authorization);
      assert.equal(result.instrument?.id, yamaha.id);
    });

    const transitionTagima = await participate(old.id, transitionTagimaMember.id, ScheduleMemberRole.INSTRUMENT);
    await assign(transitionTagima.id, bass.id, ScheduleInstrumentSource.REGISTERED, tagima.id, "2099-08-10T02:00:00.000Z", "2099-08-10T02:10:00.000Z");
    await assign(transitionTagima.id, bass.id, ScheduleInstrumentSource.OWN, null, "2099-08-10T02:10:00.000Z", "2099-08-10T02:20:00.000Z");
    await assign(transitionTagima.id, bass.id, ScheduleInstrumentSource.REGISTERED, tagima.id, "2099-08-10T02:20:00.000Z");
    await test("troca Tagima para OWN para Tagima sugere Tagima", async () => {
      const result = await scheduleInstrumentAssignmentService.getSuggestion(target.id, transitionTagimaMember.id, authorization);
      assert.equal(result.instrument?.id, tagima.id);
    });

    const roleChangedParticipant = await participate(old.id, roleChangedMember.id, ScheduleMemberRole.INSTRUMENT);
    await assign(roleChangedParticipant.id, guitar.id, ScheduleInstrumentSource.OWN, null, "2099-08-10T06:30:00.000Z", "2099-08-10T07:00:00.000Z");
    await prisma.scheduleMember.update({
      where: { id: roleChangedParticipant.id },
      data: {
        roles: { deleteMany: {}, create: { role: ScheduleMemberRole.VOCAL } }
      }
    });
    await test("role alterada posteriormente nao apaga o fato instrumental preservado pelo assignment", async () => {
      const result = await scheduleInstrumentAssignmentService.getSuggestion(target.id, roleChangedMember.id, authorization);
      assert.equal(result.role, ScheduleMemberRole.INSTRUMENT);
      assert.equal(result.source, ScheduleInstrumentSource.OWN);
      assert.equal(result.instrumentCategory?.id, guitar.id);
    });

    const replacedParticipant = await participate(old.id, replacedMember.id, ScheduleMemberRole.INSTRUMENT);
    await assign(replacedParticipant.id, bass.id, ScheduleInstrumentSource.REGISTERED, tagima.id, "2099-08-10T06:00:00.000Z", "2099-08-10T06:30:00.000Z");
    await prisma.scheduleMember.update({
      where: { id: replacedParticipant.id },
      data: { status: ScheduleMemberStatus.REPLACED, replacedByMemberId: replacementMember.id }
    });
    await test("substituicao sem prova de utilizacao nao alimenta sugestao futura", async () => {
      const result = await scheduleInstrumentAssignmentService.getSuggestion(target.id, replacedMember.id, authorization);
      assert.equal(result.hasSuggestion, false);
    });

    const canceledSchedule = await createSchedule(ministry.id, "canceled", "2099-08-20", "09:00");
    await prisma.schedule.update({ where: { id: canceledSchedule.id }, data: { status: ScheduleStatus.CANCELED } });
    const canceledOld = await participate(old.id, canceledMember.id, ScheduleMemberRole.INSTRUMENT);
    await assign(canceledOld.id, bass.id, ScheduleInstrumentSource.REGISTERED, tagima.id, "2099-08-10T05:30:00.000Z");
    const canceledRecent = await participate(canceledSchedule.id, canceledMember.id, ScheduleMemberRole.INSTRUMENT);
    await assign(canceledRecent.id, guitar.id, ScheduleInstrumentSource.OWN, null, "2099-08-20T09:00:00.000Z");
    await test("escala cancelada nao contamina a sugestao", async () => {
      const result = await scheduleInstrumentAssignmentService.getSuggestion(target.id, canceledMember.id, authorization);
      assert.equal(result.instrument?.id, tagima.id);
    });

    const removedSchedule = await createSchedule(ministry.id, "removed", "2099-08-20", "10:00");
    await prisma.schedule.update({ where: { id: removedSchedule.id }, data: { deletedAt: new Date() } });
    const removedOld = await participate(old.id, removedScheduleMember.id, ScheduleMemberRole.INSTRUMENT);
    await assign(removedOld.id, bass.id, ScheduleInstrumentSource.REGISTERED, tagima.id, "2099-08-10T05:00:00.000Z");
    const removedRecent = await participate(removedSchedule.id, removedScheduleMember.id, ScheduleMemberRole.INSTRUMENT);
    await assign(removedRecent.id, guitar.id, ScheduleInstrumentSource.OWN, null, "2099-08-20T10:00:00.000Z");
    await test("escala removida e ignorada conservadoramente na sugestao operacional", async () => {
      const result = await scheduleInstrumentAssignmentService.getSuggestion(target.id, removedScheduleMember.id, authorization);
      assert.equal(result.instrument?.id, tagima.id);
    });

    const oldOwn = await participate(old.id, ownMember.id, ScheduleMemberRole.INSTRUMENT);
    await assign(oldOwn.id, guitar.id, ScheduleInstrumentSource.OWN, null, "2099-08-10T08:00:00.000Z");
    await test("historico OWN preserva categoria e nao infere patrimonio", async () => {
      const result = await scheduleInstrumentAssignmentService.getSuggestion(target.id, ownMember.id, authorization);
      assert.equal(result.source, ScheduleInstrumentSource.OWN);
      assert.equal(result.instrumentCategory?.id, guitar.id);
      assert.equal(result.instrument, null);
    });

    const oldException = await participate(old.id, exception.id, ScheduleMemberRole.INSTRUMENT);
    await assign(oldException.id, bass.id, ScheduleInstrumentSource.REGISTERED, tagima.id, "2099-08-10T07:00:00.000Z");
    await test("membro excecao sem vinculo ministerial recebe sugestao", async () => {
      assert.equal(await prisma.memberMinistry.count({ where: { memberId: exception.id } }), 0);
      const result = await scheduleInstrumentAssignmentService.getSuggestion(target.id, exception.id, authorization);
      assert.equal(result.instrument?.id, tagima.id);
    });
    await test("membro fora do Louvor e identificado pelo Member real", async () => {
      const result = await scheduleInstrumentAssignmentService.getSuggestion(target.id, exception.id, authorization);
      assert.equal(result.hasSuggestion, true);
    });
    await test("membro sem historico mantem formulario sem sugestao", async () => {
      const result = await scheduleInstrumentAssignmentService.getSuggestion(target.id, noHistory.id, authorization);
      assert.deepEqual(result, { hasSuggestion: false, role: null, instrumentCategory: null, source: null, instrument: null });
    });

    const olderConfigured = await createSchedule(ministry.id, "older-configured", "2099-08-01", "08:00");
    const olderConfiguredParticipant = await participate(olderConfigured.id, noAssignment.id, ScheduleMemberRole.INSTRUMENT);
    await assign(olderConfiguredParticipant.id, bass.id, ScheduleInstrumentSource.OWN, null, "2099-08-01T08:00:00.000Z");
    await participate(old.id, noAssignment.id, ScheduleMemberRole.INSTRUMENT);
    await test("participacao INSTRUMENT recente sem assignment recua para configuracao conhecida", async () => {
      const result = await scheduleInstrumentAssignmentService.getSuggestion(target.id, noAssignment.id, authorization);
      assert.equal(result.source, ScheduleInstrumentSource.OWN);
    });

    async function historicalInstrument(memberId: string, instrumentId: string, categoryId = bass.id) {
      const participant = await participate(old.id, memberId, ScheduleMemberRole.INSTRUMENT);
      await assign(participant.id, categoryId, ScheduleInstrumentSource.REGISTERED, instrumentId, "2099-08-10T06:00:00.000Z");
    }
    await historicalInstrument(maintenanceMember.id, maintenance.id);
    await historicalInstrument(inactiveMember.id, inactive.id);
    await historicalInstrument(deletedMember.id, deleted.id);
    await historicalInstrument(mismatchMember.id, movedCategory.id);
    await prisma.instrument.update({ where: { id: movedCategory.id }, data: { categoryId: guitar.id } });
    const invalidCategoryParticipant = await participate(old.id, invalidCategoryMember.id, ScheduleMemberRole.INSTRUMENT);
    await assign(invalidCategoryParticipant.id, retiredCategory.id, ScheduleInstrumentSource.OWN, null, "2099-08-10T05:00:00.000Z");
    await prisma.instrumentCategory.update({ where: { id: retiredCategory.id }, data: { isActive: false } });

    for (const [label, memberId] of [
      ["MAINTENANCE", maintenanceMember.id],
      ["INACTIVE", inactiveMember.id],
      ["soft-deleted", deletedMember.id],
      ["categoria incompatível", mismatchMember.id]
    ] as const) {
      await test(`${label} preserva categoria/origem sem pre-selecionar instrumento`, async () => {
        const result = await scheduleInstrumentAssignmentService.getSuggestion(target.id, memberId, authorization);
        assert.equal(result.source, ScheduleInstrumentSource.REGISTERED);
        assert.equal(result.instrument, null);
      });
    }
    await test("categoria historica inativa reconhece historico sem criar configuracao invalida", async () => {
      const result = await scheduleInstrumentAssignmentService.getSuggestion(target.id, invalidCategoryMember.id, authorization);
      assert.equal(result.hasSuggestion, true);
      assert.equal(result.role, ScheduleMemberRole.INSTRUMENT);
      assert.equal(result.instrumentCategory, null);
      assert.equal(result.source, null);
    });

    const sameDayTarget = await createSchedule(ministry.id, "same-day-target", "2099-09-01", "12:00");
    const sameDayBefore = await createSchedule(ministry.id, "same-day-before", "2099-09-01", "10:00");
    const sameDayAfter = await createSchedule(ministry.id, "same-day-after", "2099-09-01", "14:00");
    const sameDayAmbiguous = await createSchedule(ministry.id, "same-day-ambiguous", "2099-09-01", null);
    const sameDayEqual = await createSchedule(ministry.id, "same-day-equal", "2099-09-01", "12:00");
    const beforeParticipant = await participate(sameDayBefore.id, sameDayMember.id, ScheduleMemberRole.INSTRUMENT);
    await assign(beforeParticipant.id, bass.id, ScheduleInstrumentSource.REGISTERED, tagima.id, "2099-09-01T10:00:00.000Z");
    const afterParticipant = await participate(sameDayAfter.id, sameDayMember.id, ScheduleMemberRole.INSTRUMENT);
    await assign(afterParticipant.id, bass.id, ScheduleInstrumentSource.REGISTERED, yamaha.id, "2099-09-01T14:00:00.000Z");
    const ambiguousParticipant = await participate(sameDayAmbiguous.id, sameDayMember.id, ScheduleMemberRole.INSTRUMENT);
    await assign(ambiguousParticipant.id, bass.id, ScheduleInstrumentSource.OWN, null, "2099-09-01T08:00:00.000Z");
    const equalParticipant = await participate(sameDayEqual.id, sameTimeMember.id, ScheduleMemberRole.INSTRUMENT);
    await assign(equalParticipant.id, bass.id, ScheduleInstrumentSource.REGISTERED, tagima.id, "2099-09-01T12:00:00.000Z");
    await test("mesmo dia usa somente escala com horario estritamente anterior", async () => {
      const result = await scheduleInstrumentAssignmentService.getSuggestion(sameDayTarget.id, sameDayMember.id, authorization);
      assert.equal(result.instrument?.id, tagima.id);
    });
    await test("escala do mesmo dia sem horario e tratada como ambigua", async () => {
      const result = await scheduleInstrumentAssignmentService.getSuggestion(sameDayTarget.id, sameDayMember.id, authorization);
      assert.notEqual(result.source, ScheduleInstrumentSource.OWN);
    });
    await test("mesmo dia e mesmo horario nao e tratado como historico anterior", async () => {
      const result = await scheduleInstrumentAssignmentService.getSuggestion(sameDayTarget.id, sameTimeMember.id, authorization);
      assert.equal(result.hasSuggestion, false);
    });

    await test("consulta de sugestao nao persiste ScheduleMember ou assignment", async () => {
      const before = {
        participants: await prisma.scheduleMember.count(),
        assignments: await prisma.scheduleMemberInstrumentAssignment.count(),
        schedules: await prisma.schedule.count(),
        members: await prisma.member.count(),
        notifications: await prisma.notification.count()
      };
      await scheduleInstrumentAssignmentService.getSuggestion(target.id, normal.id, authorization);
      assert.deepEqual(
        {
          participants: await prisma.scheduleMember.count(),
          assignments: await prisma.scheduleMemberInstrumentAssignment.count(),
          schedules: await prisma.schedule.count(),
          members: await prisma.member.count(),
          notifications: await prisma.notification.count()
        },
        before
      );
    });
    await test("consulta nao incrementa notificationVersion", async () => {
      const before = await prisma.schedule.findUniqueOrThrow({ where: { id: target.id }, select: { notificationVersion: true } });
      await scheduleInstrumentAssignmentService.getSuggestion(target.id, normal.id, authorization);
      const after = await prisma.schedule.findUniqueOrThrow({ where: { id: target.id }, select: { notificationVersion: true } });
      assert.deepEqual(after, before);
    });
    await test("escopo ministerial vazio oculta a escala como 404", async () => {
      const restricted = {
        user: { id: user.id },
        accessContext: { scope: ScheduleScope.MEMBER_MINISTRIES, memberId: normal.id, authorizedMinistryIds: [] }
      } as unknown as ScheduleAuthorization;
      await assert.rejects(
        () => scheduleInstrumentAssignmentService.getSuggestion(target.id, normal.id, restricted),
        (error: unknown) => Boolean(error && typeof error === "object" && "code" in error && error.code === "SCHEDULE_NOT_FOUND")
      );
    });
    await test("Member inexistente nao vaza detalhes e retorna MEMBER_NOT_FOUND", async () => {
      await assert.rejects(
        () => scheduleInstrumentAssignmentService.getSuggestion(target.id, "cm00000000000000000000000", authorization),
        (error: unknown) => Boolean(error && typeof error === "object" && "code" in error && error.code === "MEMBER_NOT_FOUND")
      );
    });
    await test("DTO real permanece minimo", async () => {
      const serialized = JSON.stringify(await scheduleInstrumentAssignmentService.getSuggestion(target.id, normal.id, authorization));
      for (const forbidden of ["email", "username", "passwordHash", "createdBy", "startedAt", "endedAt", "changeReason"]) {
        assert.doesNotMatch(serialized, new RegExp(forbidden, "i"));
      }
    });
  } finally {
    await prisma.scheduleMemberInstrumentAssignment.deleteMany({ where: { scheduleMemberId: { in: ids.participants } } });
    await prisma.scheduleMember.deleteMany({ where: { id: { in: ids.participants } } });
    await prisma.schedule.deleteMany({ where: { id: { in: ids.schedules } } });
    await prisma.memberMinistry.deleteMany({ where: { id: { in: ids.memberMinistries } } });
    await prisma.instrument.deleteMany({ where: { id: { in: ids.instruments } } });
    await prisma.instrumentCategory.deleteMany({ where: { id: { in: ids.categories } } });
    await prisma.member.deleteMany({ where: { id: { in: ids.members } } });
    await prisma.ministry.deleteMany({ where: { id: { in: ids.ministries } } });
    await prisma.$disconnect();
  }

  console.log(`Schedule instrument suggestion: ${scenarios} scenarios passed.`);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
