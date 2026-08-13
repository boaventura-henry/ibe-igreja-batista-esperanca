import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { AnnouncementAudience, AnnouncementStatus, NotificationType } from "@prisma/client";
import { announcementRepository } from "../src/repositories/announcement.repository";
import { announcementService } from "../src/services/announcement.service";
import { announcementNotificationService } from "../src/services/announcement-notification.service";
import { notificationRepository } from "../src/repositories/notification.repository";
import { notificationPublisher } from "../src/services/notification-publisher.service";
import { resolveEffectiveNotificationPreference } from "../src/services/notification.service";
import { notificationCreateSchema } from "../src/validators/notification.validator";

type Mutable = Record<string, (...args: never[]) => unknown>;
const originals: Array<{ target: Mutable; key: string; value: Mutable[string] }> = [];
function replace(target: Mutable, key: string, value: (...args: never[]) => unknown) { if (!originals.some((item) => item.target === target && item.key === key)) originals.push({ target, key, value: target[key] }); target[key] = value; }
const ADMIN_ID = "clh2gko3d0000s9h5dwv9nwyb";

function announcement(status: AnnouncementStatus, overrides: Record<string, unknown> = {}) {
  return { id: "announcement-1", title: "Reuniao de lideres", content: "Conteudo", status, audience: AnnouncementAudience.ALL, ministry: null, isPinned: false, publishAt: null, publishedAt: status === AnnouncementStatus.PUBLISHED ? new Date("2030-08-10T12:00:00.000Z") : null, notificationVersion: status === AnnouncementStatus.PUBLISHED ? 1 : 0, expiresAt: null, externalLink: null, reads: [], createdAt: new Date(), updatedAt: new Date(), ...overrides };
}

async function main() {
  let scenarios = 0; const check = (value: unknown, message: string) => { assert(value, message); scenarios += 1; console.info(`PASS ${scenarios}: ${message}`); };
  const repository = announcementRepository as unknown as Mutable; const notificationStore = notificationRepository as unknown as Mutable; const notifications = announcementNotificationService as unknown as Mutable; const publisher = notificationPublisher as unknown as Mutable;
  let current = announcement(AnnouncementStatus.DRAFT) as ReturnType<typeof announcement> & { deletedAt?: Date }; let tail = Promise.resolve(); let publicationCalls = 0; let cancellationCalls = 0; let delivered: string[][] = []; let failWrite = false; let publishedRecipientIds: string[] = []; let transientFailures = 0;
  const captureError = async (operation: () => Promise<unknown>) => { try { await operation(); return null; } catch (error) { return error; } };
  const reset = (status: AnnouncementStatus) => { current = announcement(status) as typeof current; publicationCalls = 0; cancellationCalls = 0; delivered = []; failWrite = false; transientFailures = 0; };
  try {
    replace(repository, "transaction", ((callback: (database: unknown) => Promise<unknown>) => { const operation = tail.then(async () => { if (transientFailures > 0) { transientFailures -= 1; throw { code: "P2034" }; } const previous = current; try { return await callback({}); } catch (error) { current = previous; throw error; } }); tail = operation.then(() => undefined, () => undefined); return operation; }) as never);
    replace(repository, "findById", (() => Promise.resolve(current.deletedAt ? null : current)) as never);
    replace(repository, "transitionStatus", ((_id: string, from: AnnouncementStatus[], status: AnnouncementStatus) => { if (!from.includes(current.status)) return Promise.resolve(null); current = { ...current, status, publishedAt: new Date(), notificationVersion: current.notificationVersion + 1 }; return Promise.resolve(current); }) as never);
    replace(repository, "incrementNotificationVersion", (() => { current = { ...current, notificationVersion: current.notificationVersion + 1 }; return Promise.resolve({ notificationVersion: current.notificationVersion }); }) as never);
    replace(repository, "softDeleteWithinTransaction", (() => { if (current.deletedAt) return Promise.resolve({ count: 0 }); current = { ...current, deletedAt: new Date() }; return Promise.resolve({ count: 1 }); }) as never);
    replace(notifications, "publishInitial", (() => { if (failWrite) return Promise.reject(new Error("Simulated notification failure")); publicationCalls += 1; return Promise.resolve({ notificationIds: ["published-1"] }); }) as never);
    replace(notifications, "cancelled", (() => { if (failWrite) return Promise.reject(new Error("Simulated notification failure")); cancellationCalls += 1; return Promise.resolve({ notificationIds: ["canceled-1"] }); }) as never);
    replace(publisher, "deliverPush", ((ids: string[]) => { delivered.push(ids); return Promise.resolve({}); }) as never);
    replace(notificationStore, "listRecipientUserIdsByEntity", (() => Promise.resolve(publishedRecipientIds)) as never);

    const publishInitialMock = notifications.publishInitial;
    const cancelledMock = notifications.cancelled;
    notifications.publishInitial = originals.find((item) => item.target === notifications && item.key === "publishInitial")!.value;
    notifications.cancelled = originals.find((item) => item.target === notifications && item.key === "cancelled")!.value;
    let publishedInputs: Array<{ userId: string; type: NotificationType; title: string; message: string; entityType?: string; entityId?: string; deduplicationKey?: string }> = [];
    replace(repository, "listActivePortalUsers", (() => Promise.resolve([{ id: ADMIN_ID }])) as never);
    replace(publisher, "publish", ((inputs: typeof publishedInputs) => { publishedInputs = inputs; return Promise.resolve({ notificationIds: [] }); }) as never);
    await announcementNotificationService.publishInitial(current, ADMIN_ID, {} as never);
    check(publishedInputs.length === 1 && publishedInputs[0]?.type === NotificationType.NOTICE_CREATED && publishedInputs[0]?.title === "Novo aviso" && publishedInputs[0]?.message.includes(current.title), "publicacao usa conteudo amigavel e tipo NOTICE_CREATED");
    check(publishedInputs[0]?.entityType === "NOTICE" && publishedInputs[0]?.entityId === current.id && publishedInputs[0]?.deduplicationKey === `announcement:published:v0:${current.id}:${ADMIN_ID}`, "publicacao usa destino canonico e chave versionada");
    publishedInputs = [];
    publishedRecipientIds = [];
    replace(repository, "listActivePortalUsers", (() => Promise.resolve([])) as never);
    await announcementNotificationService.cancelled(current, ADMIN_ID, {} as never);
    check(publishedInputs.length === 0, "zero destinatarios nao cria notificacao de cancelamento");
    publishedRecipientIds = ["former-recipient"];
    replace(repository, "listActivePortalUsers", (() => Promise.resolve([{ id: "new-recipient" }])) as never);
    await announcementNotificationService.cancelled({ ...current, notificationVersion: 2 }, ADMIN_ID, {} as never);
    check(publishedInputs.length === 1 && publishedInputs[0]?.userId === "former-recipient", "cancelamento prioriza quem recebeu a publicacao mesmo apos mudar de ministerio");
    publishedInputs = [];
    publishedRecipientIds = [];
    await announcementNotificationService.cancelled({ ...current, notificationVersion: 2 }, ADMIN_ID, {} as never);
    check(publishedInputs.length === 1 && publishedInputs[0]?.userId === "new-recipient", "comunicado historico sem NOTICE_CREATED usa fallback de destinatarios atuais");
    check(publishedInputs[0]?.type === NotificationType.NOTICE_CANCELED && publishedInputs[0]?.title === "Aviso cancelado" && publishedInputs[0]?.message.includes("foi cancelado") && publishedInputs[0]?.deduplicationKey === `announcement:canceled:v2:${current.id}:new-recipient`, "cancelamento usa tipo, conteudo e chave amigaveis");

    replace(publisher, "publish", ((inputs: unknown[]) => Promise.resolve({ notificationIds: inputs.map(() => "notification-1") })) as never);
    notifications.publishInitial = publishInitialMock;
    notifications.cancelled = cancelledMock;

    const managerSource = readFileSync("src/components/announcements/AnnouncementManager.tsx", "utf8");
    check(managerSource.includes("status: includeStatus ? AnnouncementStatus.DRAFT : undefined") && !managerSource.includes("<Field label=\"Status\">"), "formulario cria somente DRAFT e nao oferece status incompat?vel");

    reset(AnnouncementStatus.DRAFT); const directCreateError = await captureError(() => announcementService.create({ title: "Novo aviso", content: "Conteudo", status: AnnouncementStatus.PUBLISHED, audience: AnnouncementAudience.ALL, ministryId: null, isPinned: false, publishAt: null, expiresAt: null, externalLink: null }, ADMIN_ID)); check(directCreateError instanceof Error, "criacao direta como PUBLISHED exige a acao especifica de publicar");
    await announcementService.publish(current.id, ADMIN_ID); check(current.status === AnnouncementStatus.PUBLISHED && current.notificationVersion === 1 && publicationCalls === 1, "DRAFT para PUBLISHED cria uma publicacao versionada"); check(delivered[0]?.join(",") === "published-1", "Web Push de publicacao ocorre somente apos commit");
    await announcementService.publish(current.id, ADMIN_ID); check(publicationCalls === 1, "publicacao repetida nao duplica notificacao");
    reset(AnnouncementStatus.DRAFT); await Promise.all([announcementService.publish(current.id, ADMIN_ID), announcementService.publish(current.id, ADMIN_ID)]); check(publicationCalls === 1 && current.status === AnnouncementStatus.PUBLISHED, "publicacoes concorrentes convergem sem duplicidade");
    reset(AnnouncementStatus.DRAFT); transientFailures = 1; await announcementService.publish(current.id, ADMIN_ID); check(publicationCalls === 1 && current.status === AnnouncementStatus.PUBLISHED, "conflito transitorio P2034 recebe retry controlado sem duplicidade");
    reset(AnnouncementStatus.DRAFT); failWrite = true; const publishError = await captureError(() => announcementService.publish(current.id, ADMIN_ID)); check(publishError instanceof Error && current.status === AnnouncementStatus.DRAFT && delivered.length === 0, "falha estrutural na publicacao faz rollback sem Push");
    reset(AnnouncementStatus.DRAFT); await announcementService.remove(current.id, ADMIN_ID); check(Boolean(current.deletedAt) && cancellationCalls === 0, "soft delete de DRAFT nao cria cancelamento");
    reset(AnnouncementStatus.PUBLISHED); await announcementService.remove(current.id, ADMIN_ID); check(Boolean(current.deletedAt) && current.notificationVersion === 2 && cancellationCalls === 1, "soft delete de PUBLISHED cria um unico cancelamento versionado"); check(delivered[0]?.join(",") === "canceled-1", "Web Push de cancelamento ocorre somente apos commit");
    reset(AnnouncementStatus.PUBLISHED); const concurrentDeletes = await Promise.allSettled([announcementService.remove(current.id, ADMIN_ID), announcementService.remove(current.id, ADMIN_ID)]); check(cancellationCalls === 1 && concurrentDeletes.filter((result) => result.status === "fulfilled").length === 1, "dupla exclusao concorrente mantem um unico cancelamento");
    reset(AnnouncementStatus.PUBLISHED); failWrite = true; const deleteError = await captureError(() => announcementService.remove(current.id, ADMIN_ID)); check(deleteError instanceof Error && !current.deletedAt && current.notificationVersion === 1 && delivered.length === 0, "falha estrutural no cancelamento faz rollback sem Push");
    reset(AnnouncementStatus.ARCHIVED); await announcementService.remove(current.id, ADMIN_ID); check(Boolean(current.deletedAt) && cancellationCalls === 0 && delivered[0]?.length === 0, "ARCHIVED faz soft delete sem cancelamento ou Push");
    const noticeCreatedDefault = resolveEffectiveNotificationPreference(NotificationType.NOTICE_CREATED);
    const noticeCanceledDefault = resolveEffectiveNotificationPreference(NotificationType.NOTICE_CANCELED);
    const noticeCanceledDisabled = resolveEffectiveNotificationPreference(NotificationType.NOTICE_CANCELED, { inAppEnabled: false, reminderHoursBefore: null });
    check(noticeCreatedDefault.inAppEnabled && noticeCanceledDefault.inAppEnabled && !noticeCanceledDisabled.inAppEnabled, "preferencias In-App dos avisos respeitam o default e a desativacao por tipo");
    const publishedKey = notificationCreateSchema.parse({ userId: ADMIN_ID, type: NotificationType.NOTICE_CREATED, title: "Novo aviso", message: "ok", entityType: "NOTICE", entityId: "announcement-1", deduplicationKey: "announcement:published:v1:announcement-1:clh2gko3d0000s9h5dwv9nwyb" }).deduplicationKey; const canceledKey = notificationCreateSchema.parse({ userId: ADMIN_ID, type: NotificationType.NOTICE_CANCELED, title: "Aviso cancelado", message: "ok", entityType: "NOTICE", entityId: "announcement-1", deduplicationKey: "announcement:canceled:v2:announcement-1:clh2gko3d0000s9h5dwv9nwyb" }).deduplicationKey; check(Boolean(publishedKey && canceledKey), "chaves de publicacao e cancelamento passam pelo validator real");
    console.info(`Announcement notification tests: ${scenarios} scenarios passed.`);
  } finally { for (const { target, key, value } of originals) target[key] = value; }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
