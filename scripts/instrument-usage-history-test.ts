import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  InstrumentStatus,
  MemberStatus,
  PrismaClient,
  ScheduleInstrumentSource,
  ScheduleMemberRole,
  ScheduleMemberStatus,
  ScheduleStatus
} from "@prisma/client";
import { AppError } from "@/lib/errors";
import {
  formatInstrumentUsageDate,
  formatInstrumentUsageTime
} from "@/components/instruments/InstrumentUsageHistory";
import {
  buildInstrumentUsageHistoryWhere,
  instrumentUsageHistoryRepository
} from "@/repositories/instrument-usage-history.repository";
import { instrumentUsageHistoryService } from "@/services/instrument-usage-history.service";
import { instrumentUsageHistoryQuerySchema } from "@/validators/instrument-usage-history.validator";

const prisma = new PrismaClient();
const prefix = `__instrument_usage_${Date.now()}__`;
let scenarios = 0;

function check(condition: unknown, description: string) {
  assert.ok(condition, description);
  scenarios += 1;
  console.log(`PASS ${scenarios}: ${description}`);
}

async function main() {
  const user = await prisma.user.findFirst({ select: { id: true } });
  assert.ok(user, "Development requires a user for controlled fixtures.");

  const ids = {
    ministries: [] as string[],
    categories: [] as string[],
    instruments: [] as string[],
    members: [] as string[],
    schedules: [] as string[],
    participants: [] as string[]
  };

  try {
    const ministry = await prisma.ministry.create({
      data: { name: `${prefix}Louvor`, slug: `${prefix}louvor` }
    });
    ids.ministries.push(ministry.id);

    const category = await prisma.instrumentCategory.create({
      data: { name: `${prefix}Baixo` }
    });
    ids.categories.push(category.id);

    const [tagima, yamaha, futureInstrument, tieInstrument] = await Promise.all([
      prisma.instrument.create({
        data: { name: `${prefix}Tagima`, categoryId: category.id }
      }),
      prisma.instrument.create({
        data: { name: `${prefix}Yamaha`, categoryId: category.id }
      }),
      prisma.instrument.create({
        data: { name: `${prefix}Future`, categoryId: category.id }
      }),
      prisma.instrument.create({
        data: { name: `${prefix}Tie`, categoryId: category.id }
      })
    ]);
    ids.instruments.push(tagima.id, yamaha.id, futureInstrument.id, tieInstrument.id);

    const [joao, pedro] = await Promise.all([
      prisma.member.create({
        data: { name: `${prefix}Joao da Silva`, nickname: "Joao" }
      }),
      prisma.member.create({ data: { name: `${prefix}Pedro` } })
    ]);
    ids.members.push(joao.id, pedro.id);

    const createUsage = async ({
      instrumentId,
      source = ScheduleInstrumentSource.REGISTERED,
      date,
      startedAt,
      endedAt = null,
      reason = null,
      memberId = joao.id,
      title,
      scheduleDeletedAt = null
    }: {
      instrumentId?: string;
      source?: ScheduleInstrumentSource;
      date: string;
      startedAt: string;
      endedAt?: string | null;
      reason?: string | null;
      memberId?: string;
      title: string;
      scheduleDeletedAt?: Date | null;
    }) => {
      const schedule = await prisma.schedule.create({
        data: {
          title,
          ministryId: ministry.id,
          date: new Date(date),
          status: ScheduleStatus.COMPLETED,
          deletedAt: scheduleDeletedAt,
          createdById: user.id
        }
      });
      ids.schedules.push(schedule.id);
      const participant = await prisma.scheduleMember.create({
        data: {
          scheduleId: schedule.id,
          memberId,
          role: ScheduleMemberRole.INSTRUMENT
        }
      });
      ids.participants.push(participant.id);
      return prisma.scheduleMemberInstrumentAssignment.create({
        data: {
          scheduleMemberId: participant.id,
          instrumentCategoryId: category.id,
          source,
          instrumentId:
            source === ScheduleInstrumentSource.REGISTERED
              ? instrumentId
              : null,
          startedAt: new Date(startedAt),
          endedAt: endedAt ? new Date(endedAt) : null,
          changeReason: reason,
          createdById: user.id,
          updatedById: user.id
        }
      });
    };

    const changeSchedule = await prisma.schedule.create({
      data: {
        title: `${prefix}Culto de celebracao`,
        ministryId: ministry.id,
        date: new Date("2026-08-16T00:00:00.000Z"),
        status: ScheduleStatus.COMPLETED,
        createdById: user.id
      }
    });
    ids.schedules.push(changeSchedule.id);
    const changeParticipant = await prisma.scheduleMember.create({
      data: {
        scheduleId: changeSchedule.id,
        memberId: joao.id,
        role: ScheduleMemberRole.INSTRUMENT
      }
    });
    ids.participants.push(changeParticipant.id);
    const [first, ownAssignment, successor, returnedTagima] = await prisma.$transaction([
      prisma.scheduleMemberInstrumentAssignment.create({
        data: {
          scheduleMemberId: changeParticipant.id,
          instrumentCategoryId: category.id,
          source: ScheduleInstrumentSource.REGISTERED,
          instrumentId: tagima.id,
          startedAt: new Date("2026-08-16T21:00:00.000Z"),
          endedAt: new Date("2026-08-16T21:30:00.000Z"),
          changeReason: "Problema no instrumento",
          createdById: user.id,
          updatedById: user.id
        }
      }),
      prisma.scheduleMemberInstrumentAssignment.create({
        data: {
          scheduleMemberId: changeParticipant.id,
          instrumentCategoryId: category.id,
          source: ScheduleInstrumentSource.OWN,
          startedAt: new Date("2026-08-16T21:30:00.000Z"),
          endedAt: new Date("2026-08-16T21:45:00.000Z"),
          changeReason: "Uso temporario de instrumento proprio",
          createdById: user.id,
          updatedById: user.id
        }
      }),
      prisma.scheduleMemberInstrumentAssignment.create({
        data: {
          scheduleMemberId: changeParticipant.id,
          instrumentCategoryId: category.id,
          source: ScheduleInstrumentSource.REGISTERED,
          instrumentId: yamaha.id,
          startedAt: new Date("2026-08-16T21:45:00.000Z"),
          endedAt: new Date("2026-08-16T22:00:00.000Z"),
          changeReason: "Problema no instrumento",
          createdById: user.id,
          updatedById: user.id
        }
      }),
      prisma.scheduleMemberInstrumentAssignment.create({
        data: {
          scheduleMemberId: changeParticipant.id,
          instrumentCategoryId: category.id,
          source: ScheduleInstrumentSource.REGISTERED,
          instrumentId: tagima.id,
          startedAt: new Date("2026-08-16T22:00:00.000Z"),
          changeReason: "Retorno ao instrumento cadastrado",
          createdById: user.id,
          updatedById: user.id
        }
      })
    ]);

    const futureUsage = await createUsage({
      instrumentId: futureInstrument.id,
      date: "2099-01-01T00:00:00.000Z",
      startedAt: "2099-01-01T21:00:00.000Z",
      title: `${prefix}Escala futura`
    });

    const tieSchedule = await prisma.schedule.create({
      data: {
        title: `${prefix}Desempate`,
        ministryId: ministry.id,
        date: new Date("2026-08-14T00:00:00.000Z"),
        status: ScheduleStatus.COMPLETED,
        createdById: user.id
      }
    });
    ids.schedules.push(tieSchedule.id);
    const tieParticipant = await prisma.scheduleMember.create({
      data: {
        scheduleId: tieSchedule.id,
        memberId: pedro.id,
        role: ScheduleMemberRole.INSTRUMENT
      }
    });
    ids.participants.push(tieParticipant.id);
    const [tieA, tieB] = await prisma.$transaction([
      prisma.scheduleMemberInstrumentAssignment.create({
        data: {
          scheduleMemberId: tieParticipant.id,
          instrumentCategoryId: category.id,
          source: ScheduleInstrumentSource.REGISTERED,
          instrumentId: tieInstrument.id,
          startedAt: new Date("2026-08-14T21:00:00.000Z"),
          endedAt: new Date("2026-08-14T21:30:00.000Z"),
          createdById: user.id
        }
      }),
      prisma.scheduleMemberInstrumentAssignment.create({
        data: {
          scheduleMemberId: tieParticipant.id,
          instrumentCategoryId: category.id,
          source: ScheduleInstrumentSource.REGISTERED,
          instrumentId: tieInstrument.id,
          startedAt: new Date("2026-08-14T21:00:00.000Z"),
          endedAt: new Date("2026-08-14T21:40:00.000Z"),
          createdById: user.id
        }
      })
    ]);

    for (let index = 0; index < 5; index += 1) {
      await createUsage({
        instrumentId: tagima.id,
        date: `2026-08-${String(10 - index).padStart(2, "0")}T00:00:00.000Z`,
        startedAt: `2026-08-${String(10 - index).padStart(2, "0")}T20:00:00.000Z`,
        endedAt: `2026-08-${String(10 - index).padStart(2, "0")}T21:00:00.000Z`,
        title: `${prefix}Escala ${index}`
      });
    }

    const filters = instrumentUsageHistoryQuerySchema.parse({
      page: 1,
      pageSize: 5
    });
    check(filters.page === 1 && filters.pageSize === 5, "validator aceita paginacao padrao");
    check(
      !instrumentUsageHistoryQuerySchema.safeParse({ page: 0, pageSize: 5 }).success,
      "validator bloqueia pagina invalida"
    );
    check(
      !instrumentUsageHistoryQuerySchema.safeParse({ page: 1, pageSize: 1000 }).success,
      "validator limita pageSize"
    );

    const where = buildInstrumentUsageHistoryWhere(tagima.id);
    check(where.instrumentId === tagima.id, "query fixa o patrimonio consultado");
    check(where.source === ScheduleInstrumentSource.REGISTERED, "query inclui apenas REGISTERED");

    const pageOne = await instrumentUsageHistoryService.list(tagima.id, filters);
    check(pageOne.items.length === 5, "primeira pagina e limitada no banco");
    check(pageOne.pagination.total === 7, "count retorna total correto");
    check(pageOne.pagination.totalPages === 2, "totalPages e calculado corretamente");
    check(pageOne.items[0]?.id === returnedTagima.id, "ordenacao usa escala e assignment mais recentes primeiro");
    const firstItem = pageOne.items.find((item) => item.id === first.id);
    check(firstItem?.member.displayName === "Joao", "utilizador vem de ScheduleMember.member");
    check(firstItem?.category.id === category.id, "categoria historica vem do assignment");
    check(firstItem?.schedule.title.includes("Culto de celebracao"), "escala correta e retornada");
    check(firstItem?.changeReason === "Problema no instrumento", "motivo permanece no assignment ao qual pertence");
    check(firstItem?.startedAt === "2026-08-16T21:00:00.000Z", "startedAt e serializado");
    check(firstItem?.endedAt === "2026-08-16T21:30:00.000Z", "endedAt da troca e serializado");
    check(first.createdById === user.id && firstItem?.member.id === joao.id, "createdBy administrador nao substitui o membro utilizador");

    const pageTwo = await instrumentUsageHistoryService.list(tagima.id, {
      page: 2,
      pageSize: 5
    });
    check(pageTwo.items.length === 2, "segunda e ultima pagina retorna somente o restante");
    const beyond = await instrumentUsageHistoryService.list(tagima.id, {
      page: 3,
      pageSize: 5
    });
    check(beyond.items.length === 0 && beyond.pagination.total === 7, "pagina alem do total retorna vazio sem perder metadados");

    const yamahaHistory = await instrumentUsageHistoryService.list(yamaha.id, {
      page: 1,
      pageSize: 10
    });
    check(yamahaHistory.items[0]?.id === successor.id, "sucessor Yamaha inicia no horario da troca");
    check(ownAssignment.scheduleMemberId === first.scheduleMemberId && successor.scheduleMemberId === first.scheduleMemberId, "Tagima, OWN e Yamaha pertencem a mesma participacao");
    check(ownAssignment.startedAt.toISOString() === first.endedAt?.toISOString(), "OWN inicia ao encerrar Tagima");
    check(yamahaHistory.items[0]?.startedAt === ownAssignment.endedAt?.toISOString(), "Yamaha inicia ao encerrar OWN");
    const tagimaPeriods = (await instrumentUsageHistoryService.list(tagima.id, { page: 1, pageSize: 10 })).items.filter(
      (item) => item.scheduleMember.id === changeParticipant.id
    );
    check(tagimaPeriods.length === 2 && tagimaPeriods.some((item) => item.id === returnedTagima.id), "retorno ao mesmo instrumento preserva dois periodos distintos");

    const futureHistory = await instrumentUsageHistoryService.list(futureInstrument.id, {
      page: 1,
      pageSize: 5
    });
    check(futureHistory.items[0]?.id === futureUsage.id, "assignment de escala futura permanece como utilizacao planejada");

    const tieHistory = await instrumentUsageHistoryService.list(tieInstrument.id, {
      page: 1,
      pageSize: 5
    });
    check(
      tieHistory.items.map((item) => item.id).join(",") ===
        [tieA.id, tieB.id].sort((left, right) => right.localeCompare(left)).join(","),
      "id descendente resolve empate de data e startedAt"
    );

    const ownCount = await prisma.scheduleMemberInstrumentAssignment.count({
      where: { source: ScheduleInstrumentSource.OWN, instrumentId: { not: null } }
    });
    check(ownCount === 0, "OWN nao e associado a patrimonio cadastrado");

    await prisma.instrument.update({
      where: { id: tagima.id },
      data: { status: InstrumentStatus.MAINTENANCE }
    });
    check((await instrumentUsageHistoryService.list(tagima.id, filters)).pagination.total === 7, "manutencao preserva historico");
    await prisma.instrument.update({
      where: { id: tagima.id },
      data: { status: InstrumentStatus.INACTIVE }
    });
    check((await instrumentUsageHistoryService.list(tagima.id, filters)).pagination.total === 7, "instrumento inativo preserva historico");

    await prisma.member.update({
      where: { id: joao.id },
      data: { status: MemberStatus.INACTIVE, deletedAt: new Date() }
    });
    check((await instrumentUsageHistoryService.list(tagima.id, filters)).items[0]?.member.id === joao.id, "membro inativo ou removido permanece no historico");

    const firstParticipant = await prisma.scheduleMember.findUniqueOrThrow({
      where: { id: (await prisma.scheduleMemberInstrumentAssignment.findUniqueOrThrow({ where: { id: first.id } })).scheduleMemberId }
    });
    await prisma.scheduleMember.update({
      where: { id: firstParticipant.id },
      data: {
        status: ScheduleMemberStatus.REPLACED,
        replacedByMemberId: pedro.id
      }
    });
    check((await instrumentUsageHistoryService.list(tagima.id, filters)).items[0]?.member.id === joao.id, "substituicao preserva o utilizador original");

    await prisma.scheduleMember.update({
      where: { id: firstParticipant.id },
      data: { role: ScheduleMemberRole.VOCAL }
    });
    check((await instrumentUsageHistoryService.list(tagima.id, filters)).items.some((item) => item.id === first.id), "mudanca posterior de role preserva utilizacao passada");

    await prisma.schedule.update({
      where: { id: firstParticipant.scheduleId },
      data: { deletedAt: new Date() }
    });
    check(Boolean((await instrumentUsageHistoryService.list(tagima.id, filters)).items[0]?.schedule.deletedAt), "escala soft deleted permanece no historico");

    await prisma.instrument.update({
      where: { id: tagima.id },
      data: { deletedAt: new Date() }
    });
    check((await instrumentUsageHistoryRepository.list(tagima.id, filters)).total === 7, "soft delete do patrimonio nao destroi os assignments");
    await assert.rejects(
      () => instrumentUsageHistoryService.list(tagima.id, filters),
      (error: unknown) =>
        error instanceof AppError && error.code === "INSTRUMENT_NOT_FOUND"
    );
    check(true, "detalhe removido respeita a regra de acesso existente");
    await prisma.instrument.update({
      where: { id: tagima.id },
      data: { deletedAt: null }
    });

    const emptyInstrument = await prisma.instrument.create({
      data: { name: `${prefix}Sem uso`, categoryId: category.id }
    });
    ids.instruments.push(emptyInstrument.id);
    check((await instrumentUsageHistoryService.list(emptyInstrument.id, filters)).pagination.total === 0, "instrumento sem utilizacao retorna vazio");

    const repositorySource = readFileSync(
      "src/repositories/instrument-usage-history.repository.ts",
      "utf8"
    );
    check(repositorySource.includes("skip,") && repositorySource.includes("take: filters.pageSize"), "paginacao ocorre no PostgreSQL");
    check(repositorySource.includes("scheduleMember: { schedule: { date: \"desc\" } }"), "orderBy da data ocorre no banco");
    check(repositorySource.includes("scheduleMember: {") && repositorySource.includes("member: {") && repositorySource.includes("schedule: {"), "select relacional unico evita N+1");
    check(repositorySource.includes("select: { id: true }") && !readFileSync("src/services/instrument-usage-history.service.ts", "utf8").includes("instrumentService"), "validacao de existencia nao carrega Instrument completo");

    const routeSource = readFileSync(
      "src/app/api/instruments/[id]/usage/route.ts",
      "utf8"
    );
    check(routeSource.includes('requirePermission("instrument.view")'), "endpoint exige instrument.view sem bypass por role");
    check(routeSource.includes('"Cache-Control": "no-store, max-age=0"'), "endpoint administrativo desabilita cache");

    const detailSource = readFileSync(
      "src/components/instruments/InstrumentDetail.tsx",
      "utf8"
    );
    const uiSource = readFileSync(
      "src/components/instruments/InstrumentUsageHistory.tsx",
      "utf8"
    );
    check(detailSource.includes("Histórico técnico") && detailSource.includes("InstrumentUsageHistory"), "historico tecnico permanece separado da utilizacao");
    check(uiSource.includes("Este instrumento ainda não possui utilização registrada em escalas."), "UI possui estado vazio amigavel");
    check(uiSource.includes("md:grid-cols") && !uiSource.includes("min-w-["), "UI usa cards responsivos sem largura minima horizontal");
    check(uiSource.includes("Ver escala") && uiSource.includes("Escala removida"), "navegacao evita link para escala removida");
    check(!uiSource.includes("Desde ") && uiSource.includes("Início registrado:"), "assignment ativo nao sugere uso continuo alem da escala");
    check(uiSource.includes("Motivo registrado neste período:") && !uiSource.includes("substituído por"), "UI apresenta motivo sem inventar predecessor ou sucessor");
    check(formatInstrumentUsageDate("2026-08-16T23:30:00.000Z") === "16/08/2026", "data civil da escala nao sofre deslocamento de timezone");
    check(formatInstrumentUsageTime("2026-08-16T21:45:00.000Z") === "18:45", "timestamp do assignment usa horario oficial de Sao Paulo");
    check(!repositorySource.includes("forEach") && !repositorySource.includes(".map("), "repository nao executa consulta por item");

    console.log(`Instrument usage history: ${scenarios} scenarios passed.`);
  } finally {
    if (ids.participants.length) {
      await prisma.scheduleMemberInstrumentAssignment.deleteMany({
        where: { scheduleMemberId: { in: ids.participants } }
      });
    }
    if (ids.participants.length) {
      await prisma.scheduleMember.deleteMany({
        where: { id: { in: ids.participants } }
      });
    }
    if (ids.schedules.length) {
      await prisma.schedule.deleteMany({ where: { id: { in: ids.schedules } } });
    }
    if (ids.instruments.length) {
      await prisma.instrument.deleteMany({ where: { id: { in: ids.instruments } } });
    }
    if (ids.categories.length) {
      await prisma.instrumentCategory.deleteMany({ where: { id: { in: ids.categories } } });
    }
    if (ids.members.length) {
      await prisma.member.deleteMany({ where: { id: { in: ids.members } } });
    }
    if (ids.ministries.length) {
      await prisma.ministry.deleteMany({ where: { id: { in: ids.ministries } } });
    }
    await prisma.$disconnect();
  }
}

void main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
