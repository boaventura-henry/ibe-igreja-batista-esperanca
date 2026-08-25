import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  NotificationType,
  PrismaClient,
  ScheduleInstrumentSource,
  ScheduleMemberRole,
  ScheduleMemberStatus,
  ScheduleScope,
  ScheduleStatus
} from "@prisma/client";
import {
  getScheduleMemberDisplayRoles
} from "../src/lib/schedule-member-role";
import type { ScheduleAuthorization } from "../src/lib/schedule-authorization";
import type {
  ScheduleMemberRecord,
  ScheduleRecord
} from "../src/repositories/schedule.repository";
import { notificationPublisher } from "../src/services/notification-publisher.service";
import {
  activeScheduleRecipients,
  scheduleNotificationService
} from "../src/services/schedule-notification.service";
import { scheduleService } from "../src/services/schedule.service";
import type { NotificationCreateInput } from "../src/validators/notification.validator";

const prisma = new PrismaClient();
const stamp = Date.now().toString();
const key = (suffix: string) => `__schedule_notification_roles_${stamp}_${suffix}`;
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
    assert.equal(parsed.pathname.replace(/^\//, ""), "ibe");
  }
}

function participant(
  id: string,
  userId: string,
  legacyRole: ScheduleMemberRole,
  roles: ScheduleMemberRole[],
  category?: string,
  memberId = `member-${id}`
) {
  return {
    id,
    role: legacyRole,
    roles: roles.map((role) => ({ role })),
    status: ScheduleMemberStatus.PENDING,
    confirmedAt: null,
    declinedAt: null,
    declineReason: null,
    observations: null,
    createdAt: new Date("2026-08-25T10:00:00.000Z"),
    updatedAt: new Date("2026-08-25T10:00:00.000Z"),
    member: {
      id: memberId,
      name: `Membro ${id}`,
      nickname: null,
      status: "ACTIVE",
      user: { id: userId }
    },
    replacedByMember: null,
    instrumentAssignments: category
      ? [{ instrumentCategory: { id: `category-${id}`, name: category } }]
      : []
  } as ScheduleMemberRecord;
}

function schedule(members: ScheduleMemberRecord[], notificationVersion = 7) {
  return {
    id: "schedule-multiple-roles",
    title: "Culto de teste",
    description: null,
    date: new Date("2099-08-29T00:00:00.000Z"),
    startTime: "19:00",
    endTime: "20:30",
    location: "Templo",
    status: ScheduleStatus.PUBLISHED,
    publishedAt: new Date("2026-08-25T10:00:00.000Z"),
    notificationVersion,
    observations: null,
    createdAt: new Date("2026-08-25T10:00:00.000Z"),
    updatedAt: new Date("2026-08-25T10:00:00.000Z"),
    ministry: { id: "ministry-1", name: "Louvor", color: "#123456", isActive: true },
    event: null,
    members
  } as ScheduleRecord;
}

async function main() {
  requireDevelopmentDatasource();

  const serviceSource = await readFile("src/services/schedule-notification.service.ts", "utf8");
  const repositorySource = await readFile("src/repositories/schedule.repository.ts", "utf8");
  const scheduleServiceSource = await readFile("src/services/schedule.service.ts", "utf8");
  const publisherSource = await readFile("src/services/notification-publisher.service.ts", "utf8");
  const helperSource = await readFile("src/lib/schedule-member-role.ts", "utf8");
  const bass = { instrumentCategory: { name: "Baixo" } };
  const guitar = { instrumentCategory: { name: "Violão" } };

  await test("role singular", () => assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.VOCAL] }), "Vocal"));
  await test("LEADER mais MINISTER", () => assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.LEADER, ScheduleMemberRole.MINISTER] }), "Líder • Ministro"));
  await test("BACKING mais INSTRUMENT usa Baixo", () => assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT] }, bass), "Baixo • Backing"));
  await test("MINISTER mais INSTRUMENT usa Violao", () => assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.MINISTER, ScheduleMemberRole.INSTRUMENT] }, guitar), "Ministro • Violão"));
  await test("tres roles sao preservadas", () => assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.BACKING, ScheduleMemberRole.LEADER, ScheduleMemberRole.INSTRUMENT] }, bass), "Líder • Baixo • Backing"));
  await test("ordem de entrada nao altera apresentacao", () => assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.INSTRUMENT, ScheduleMemberRole.BACKING] }, bass), "Baixo • Backing"));
  await test("roles vazias nao recorrem ao legado", () => assert.equal(getScheduleMemberDisplayRoles({ role: ScheduleMemberRole.LEADER, roles: [] }), "Função não informada"));
  await test("fallback legado permanece quando roles nao foi carregado", () => assert.equal(getScheduleMemberDisplayRoles({ role: ScheduleMemberRole.LEADER }), "Líder"));
  await test("legado BACKING divergente nao prevalece", () => assert.equal(getScheduleMemberDisplayRoles({ role: ScheduleMemberRole.BACKING, roles: [ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT] }, bass), "Baixo • Backing"));
  await test("legado INSTRUMENT divergente nao prevalece", () => assert.equal(getScheduleMemberDisplayRoles({ role: ScheduleMemberRole.INSTRUMENT, roles: [ScheduleMemberRole.BACKING] }, bass), "Backing"));
  await test("INSTRUMENT sem categoria usa fallback", () => assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.INSTRUMENT] }), "Instrumento"));
  await test("categoria inativa continua legivel", () => assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.INSTRUMENT] }, { instrumentCategory: { name: "Baixo", isActive: false } } as never), "Baixo"));
  await test("OWN nao aparece na apresentacao", () => assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.INSTRUMENT, ScheduleMemberRole.BACKING] }, { instrumentCategory: { name: "Baixo" }, source: ScheduleInstrumentSource.OWN } as never), "Baixo • Backing"));
  await test("patrimonio fisico nao aparece", () => assert.equal(getScheduleMemberDisplayRoles({ roles: [ScheduleMemberRole.INSTRUMENT] }, { instrumentCategory: { name: "Baixo" }, instrument: { name: "Tagima Millennium Top 5", assetNumber: "PAT-123" } } as never), "Baixo"));

  const originalPublish = notificationPublisher.publish;
  const originalPreferences = notificationPublisher.preferences;
  let captured: NotificationCreateInput[] = [];
  notificationPublisher.publish = ((inputs: NotificationCreateInput[]) => {
    captured.push(...inputs);
    return Promise.resolve({ requested: inputs.length, eligible: inputs.length, created: inputs.length, skipped: 0, notificationIds: [] });
  }) as typeof notificationPublisher.publish;
  notificationPublisher.preferences = ((userIds: string[]) => Promise.resolve(userIds.map((userId) => ({ userId, active: true, preference: { type: NotificationType.SCHEDULE_REMINDER, inAppEnabled: true, reminderHoursBefore: 24, isDefault: true } })))) as typeof notificationPublisher.preferences;

  try {
    const joao = participant("joao", "user-joao", ScheduleMemberRole.BACKING, [ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT], "Baixo");
    const mirian = participant("mirian", "user-mirian", ScheduleMemberRole.LEADER, [ScheduleMemberRole.LEADER, ScheduleMemberRole.MINISTER]);
    const ana = participant("ana", "user-ana", ScheduleMemberRole.MINISTER, [ScheduleMemberRole.MINISTER, ScheduleMemberRole.INSTRUMENT], "Violão");

    await scheduleNotificationService.publishInitial(schedule([joao, mirian, ana]), "creator", {} as never, new Date("2026-08-25T10:00:00.000Z"));
    const initial = captured.filter((item) => item.type === NotificationType.SCHEDULE_PUBLISHED);
    await test("publicacao inicial usa texto plural", () => assert.match(initial.find((item) => item.userId === "user-joao")?.message ?? "", /Funcao: Baixo • Backing\./));
    await test("publicacao inicial usa Lider e Ministro", () => assert.match(initial.find((item) => item.userId === "user-mirian")?.message ?? "", /Funcao: Líder • Ministro\./));
    await test("publicacao inicial usa Ministro e Violao", () => assert.match(initial.find((item) => item.userId === "user-ana")?.message ?? "", /Funcao: Ministro • Violão\./));
    await test("uma notificacao imediata por participante", () => assert.equal(initial.length, 3));
    await test("duas ou tres roles nao duplicam notificacao", () => assert.deepEqual(initial.map((item) => item.userId).sort(), ["user-ana", "user-joao", "user-mirian"]));
    await test("deduplication key da publicacao permanece inalterada", () => assert.equal(initial.find((item) => item.userId === "user-joao")?.deduplicationKey, "schedule:published:v7:schedule-multiple-roles:user-joao"));
    await test("notificationVersion continua vindo da escala", () => assert.ok(initial.every((item) => item.deduplicationKey?.includes(":v7:"))));
    await test("reminder continua sem funcao", () => assert.ok(captured.filter((item) => item.type === NotificationType.SCHEDULE_REMINDER).every((item) => !item.message.includes("Funcao:"))));

    captured = [];
    await scheduleNotificationService.participantAdded(schedule([], 8), joao, "creator", {} as never, new Date("2026-08-25T10:00:00.000Z"));
    const added = captured.filter((item) => item.type === NotificationType.SCHEDULE_PUBLISHED);
    await test("inclusao posterior usa o mesmo texto plural", () => assert.match(added[0]?.message ?? "", /Funcao: Baixo • Backing\./));
    await test("inclusao posterior cria uma notificacao imediata", () => assert.equal(added.length, 1));
    await test("deduplication key da inclusao permanece inalterada", () => assert.equal(added[0]?.deduplicationKey, "schedule:participant-added:v8:schedule-multiple-roles:joao"));

    const sameUser = activeScheduleRecipients([joao, participant("duplicate", "user-joao", ScheduleMemberRole.VOCAL, [ScheduleMemberRole.VOCAL])]);
    await test("consolidacao por User permanece unica", () => assert.equal(sameUser.length, 1));
  } finally {
    notificationPublisher.publish = originalPublish;
    notificationPublisher.preferences = originalPreferences;
  }

  await test("service usa somente helper plural", () => {
    assert.match(serviceSource, /getScheduleMemberDisplayRoles/);
    assert.doesNotMatch(serviceSource, /getScheduleMemberDisplayRole\(/);
  });
  await test("repository carrega roles na consulta relacional", () => assert.match(repositorySource, /roles:\s*\{ select: \{ role: true \} \}/));
  await test("repository carrega categoria sem query por participante", () => assert.match(repositorySource, /instrumentCategory: \{ select: \{ id: true, name: true \} \}/));
  await test("service nao consulta banco em loop para montar roles", () => assert.doesNotMatch(serviceSource.match(/function activeScheduleRecipients[\s\S]*?\n\}/)?.[0] ?? "", /Repository|prisma|findMany|findUnique/));
  await test("Web Push reutiliza notificacoes persistidas", () => assert.match(publisherSource, /findDeliverableByIds\(notificationIds\)/));
  await test("Web Push permanece depois da transacao", () => assert.match(scheduleServiceSource, /scheduleRepository\.transaction[\s\S]*?await notificationPublisher\.deliverPush\(notificationIds\)/));
  await test("publicacao usa timeout transacional especifico", () => assert.match(
    scheduleServiceSource,
    /async publish[\s\S]*?scheduleRepository\.transaction[\s\S]*?\}, \{ maxWait: 5_000, timeout: 15_000 \}\);/
  ));
  await test("helper singular permanece exportado para compatibilidade", () => assert.match(helperSource, /export function getScheduleMemberDisplayRole\(/));

  const ids = {
    ministry: "",
    categories: [] as string[],
    members: [] as string[],
    users: [] as string[],
    schedules: [] as string[]
  };
  const author = await prisma.user.findFirst({ where: { isActive: true }, select: { id: true } });
  assert.ok(author, "Development precisa conter usuario ativo para autoria dos fixtures.");
  const authorization = {
    user: { id: author.id },
    accessContext: { scope: ScheduleScope.ALL, memberId: null, authorizedMinistryIds: null }
  } as unknown as ScheduleAuthorization;
  const originalDeliverPush = notificationPublisher.deliverPush;
  const pushBatches: string[][] = [];
  notificationPublisher.deliverPush = (async (notificationIds: string[]) => {
    pushBatches.push([...notificationIds]);
    return { notifications: notificationIds.length, attempted: 0, sent: 0, failed: 0 };
  }) as typeof notificationPublisher.deliverPush;
  try {
    const ministry = await prisma.ministry.create({ data: { name: key("ministry"), slug: key("ministry") } });
    ids.ministry = ministry.id;
    const [bassCategory, guitarCategory] = await Promise.all([
      prisma.instrumentCategory.create({ data: { name: key("Baixo"), createdById: author.id } }),
      prisma.instrumentCategory.create({ data: { name: key("Violao"), createdById: author.id } })
    ]);
    ids.categories.push(bassCategory.id, guitarCategory.id);

    const names = ["Mirian", "Joao", "Ana", "Tres", "Posterior"];
    const members = await Promise.all(names.map((name) => prisma.member.create({ data: { name: `${key(name)} ${name}` } })));
    ids.members.push(...members.map((item) => item.id));
    const users = await Promise.all(members.map((member, index) => prisma.user.create({ data: { name: key(`user_${index}`), username: key(`user_${index}`), email: `${key(`user_${index}`)}@example.test`, passwordHash: key("hash"), memberId: member.id } })));
    ids.users.push(...users.map((item) => item.id));

    const realSchedule = await prisma.schedule.create({ data: { title: key("schedule"), ministryId: ministry.id, date: new Date("2099-08-29T00:00:00.000Z"), startTime: "19:00", status: ScheduleStatus.DRAFT, createdById: author.id } });
    ids.schedules.push(realSchedule.id);

    const createRealParticipant = async (index: number, legacyRole: ScheduleMemberRole, roles: ScheduleMemberRole[], categoryId?: string) => {
      const created = await prisma.scheduleMember.create({ data: { scheduleId: realSchedule.id, memberId: members[index].id, role: legacyRole, status: ScheduleMemberStatus.PENDING, createdById: author.id, roles: { create: roles.map((role) => ({ role })) } } });
      if (categoryId) {
        await prisma.scheduleMemberInstrumentAssignment.create({ data: { scheduleMemberId: created.id, instrumentCategoryId: categoryId, source: ScheduleInstrumentSource.OWN, createdById: author.id } });
      }
      return created;
    };
    await createRealParticipant(0, ScheduleMemberRole.LEADER, [ScheduleMemberRole.LEADER, ScheduleMemberRole.MINISTER]);
    await createRealParticipant(1, ScheduleMemberRole.BACKING, [ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT], bassCategory.id);
    await createRealParticipant(2, ScheduleMemberRole.MINISTER, [ScheduleMemberRole.MINISTER, ScheduleMemberRole.INSTRUMENT], guitarCategory.id);
    await createRealParticipant(3, ScheduleMemberRole.LEADER, [ScheduleMemberRole.LEADER, ScheduleMemberRole.INSTRUMENT, ScheduleMemberRole.BACKING], bassCategory.id);

    await scheduleService.publish(realSchedule.id, authorization);
    const published = await prisma.notification.findMany({ where: { entityId: realSchedule.id, type: NotificationType.SCHEDULE_PUBLISHED, userId: { in: users.map((item) => item.id) } }, orderBy: { userId: "asc" } });
    await test("Development publica uma notificacao por fixture inicial", () => assert.equal(published.length, 4));
    await test("Development persiste Lider e Ministro", () => assert.ok(published.some((item) => item.message.includes("Líder • Ministro"))));
    await test("Development persiste Baixo e Backing", () => assert.ok(published.some((item) => item.message.includes(`${bassCategory.name} • Backing`))));
    await test("Development persiste Ministro e Violao", () => assert.ok(published.some((item) => item.message.includes(`Ministro • ${guitarCategory.name}`))));
    await test("Development persiste tres funcoes em ordem canonica", () => assert.ok(published.some((item) => item.message.includes(`Líder • ${bassCategory.name} • Backing`))));
    await test("Development nao persiste patrimonio", () => assert.ok(published.every((item) => !item.message.includes("PAT-") && !item.message.includes("Tagima"))));

    await scheduleService.addMember(realSchedule.id, { memberId: members[4].id, roles: [ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT], status: ScheduleMemberStatus.PENDING, allowMinistryException: true, instrumentAssignment: { instrumentCategoryId: bassCategory.id, source: ScheduleInstrumentSource.OWN, instrumentId: null } }, authorization);
    const posterior = await prisma.notification.findMany({ where: { entityId: realSchedule.id, type: NotificationType.SCHEDULE_PUBLISHED, userId: users[4].id } });
    await test("Development inclusao posterior persiste uma notificacao", () => assert.equal(posterior.length, 1));
    await test("Development inclusao posterior persiste texto plural", () => assert.match(posterior[0]?.message ?? "", new RegExp(`${bassCategory.name} • Backing`)));

    const beforeReplay = await prisma.notification.count({ where: { entityId: realSchedule.id, userId: { in: users.map((item) => item.id) } } });
    await Promise.all([scheduleService.publish(realSchedule.id, authorization), scheduleService.publish(realSchedule.id, authorization)]);
    const afterReplay = await prisma.notification.count({ where: { entityId: realSchedule.id, userId: { in: users.map((item) => item.id) } } });
    await test("Development republicacao concorrente permanece idempotente", () => assert.equal(afterReplay, beforeReplay));
    await test("Development Web Push foi apenas simulado pos-commit", () => assert.ok(pushBatches.length >= 2 && pushBatches.every((batch) => Array.isArray(batch))));
  } finally {
    notificationPublisher.deliverPush = originalDeliverPush;
    if (ids.users.length) await prisma.notification.deleteMany({ where: { userId: { in: ids.users } } });
    if (ids.schedules.length) {
      await prisma.scheduleMemberInstrumentAssignment.deleteMany({ where: { scheduleMember: { scheduleId: { in: ids.schedules } } } });
      await prisma.scheduleMemberRoleAssignment.deleteMany({ where: { scheduleMember: { scheduleId: { in: ids.schedules } } } });
      await prisma.scheduleMember.deleteMany({ where: { scheduleId: { in: ids.schedules } } });
      await prisma.schedule.deleteMany({ where: { id: { in: ids.schedules } } });
    }
    if (ids.users.length) await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
    if (ids.members.length) await prisma.member.deleteMany({ where: { id: { in: ids.members } } });
    if (ids.categories.length) await prisma.instrumentCategory.deleteMany({ where: { id: { in: ids.categories } } });
    if (ids.ministry) await prisma.ministry.deleteMany({ where: { id: ids.ministry } });
    await prisma.$disconnect();
  }

  console.log(`Schedule notification multiple roles: ${scenarios} scenarios passed.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
