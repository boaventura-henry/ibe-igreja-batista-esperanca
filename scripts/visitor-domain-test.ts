import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import { PrismaClient, VisitorPrivacyChannel, VisitorStatus } from "@prisma/client";
import { institution, publicSiteConfiguration } from "@/config/institution";
import { visitorPrivacyNotice } from "@/config/visitor-privacy";
import { parseVisitorCivilDate } from "@/lib/visitor-civil-date";
import { availablePermissions } from "@/lib/permissions";
import { visitorRepository } from "@/repositories";
import { visitorService } from "@/services";
import { visitorCreateSchema, visitorIdentitySchema, visitorPhoneSchema, visitorPrivacyRecordSchema } from "@/validators";

const prisma = new PrismaClient();
const prefix = `__visitor_domain_test__${randomUUID()}__`;
const phoneBase = randomInt(1_000_000, 9_999_900);
const phone = (suffix: string) => `1198${String(phoneBase + Number(suffix)).padStart(7, "0")}`;
const birthDate = (value = "1990-01-15") => parseVisitorCivilDate(value)!;
const privacy = (noticeVersion = "visitor-test-v1") => visitorPrivacyRecordSchema.parse({ noticeVersion, channel: VisitorPrivacyChannel.PUBLIC_VISIT_FORM });
const visitor = (suffix: string, overrides: Record<string, unknown> = {}) => visitorCreateSchema.parse({
  name: `${prefix}${suffix}`,
  phone: phone(suffix),
  birthDate: "1990-01-15",
  street: "Rua de teste",
  city: "Aracatuba",
  state: "sp",
  ...overrides
});

async function checkIn(suffix: string, visitDate: Date, overrides: Record<string, unknown> = {}, noticeVersion?: string) {
  const result = await visitorService.checkIn({ visitor: visitor(suffix, overrides), privacy: privacy(noticeVersion), visitDate, reactivateInactive: true });
  return result;
}

async function main() {
  assert.equal(institution.name, "Igreja Batista Esperança");
  assert.equal(institution.presentation, null);
  assert.equal(institution.logoPath, "/ibe-logo.png");
  assert.equal(publicSiteConfiguration.fallbackUrl, "https://ibe-igreja-batista-esperanca.vercel.app");
  assert.equal(visitorPrivacyNotice.status, "DRAFT");
  assert.equal(visitorPrivacyNotice.text, null);

  assert.equal(visitorPhoneSchema.parse("(11) 99876-5432"), "11998765432");
  assert.equal(visitorPhoneSchema.parse("1134567890"), "1134567890");
  for (const value of ["", "119876543", "119876543210", "abc1198765432"]) assert.equal(visitorPhoneSchema.safeParse(value).success, false);
  assert.equal(visitorIdentitySchema.parse({ phone: "11987654321", birthDate: "2000-02-29" }).birthDate.toISOString(), "2000-02-29T00:00:00.000Z");
  for (const value of ["2026-02-29", "2000-13-01", "2000-01-32", "2999-01-01"]) assert.equal(parseVisitorCivilDate(value), null);
  assert.equal(parseVisitorCivilDate("2000-02-29", new Date("2026-01-01T00:00:00.000Z"))?.toISOString(), "2000-02-29T00:00:00.000Z");
  assert.equal(visitorCreateSchema.parse({ name: "Visitante Teste", phone: phone("9"), birthDate: "1990-01-15" }).street, undefined);
  assert.equal(visitorCreateSchema.parse({ name: "Visitante Teste", phone: phone("9"), birthDate: "1990-01-15", status: "CONVERTED" }).status, VisitorStatus.CONVERTED);
  assert.equal(await prisma.visitor.count({ where: { phone: { in: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => phone(String(n))) } } }), 0, "Telefones de fixture devem estar livres antes do teste.");

  const first = await checkIn("1", new Date(Date.UTC(2026, 9, 19)));
  assert.equal(first.created, true);
  assert.equal(first.visitor.phone, phone("1"));
  assert.equal(first.visitor.status, VisitorStatus.ACTIVE);
  assert.equal(await prisma.visitorVisit.count({ where: { visitorId: first.visitor.id } }), 1);
  assert.equal(await prisma.visitorPrivacyRecord.count({ where: { visitorId: first.visitor.id } }), 1);

  const sameDay = await checkIn("1", new Date(Date.UTC(2026, 9, 19)));
  assert.equal(sameDay.created, false);
  assert.equal(await prisma.visitorVisit.count({ where: { visitorId: first.visitor.id } }), 1);
  await checkIn("1", new Date(Date.UTC(2026, 9, 20)));
  assert.equal(await prisma.visitorVisit.count({ where: { visitorId: first.visitor.id } }), 2);
  await checkIn("1", new Date(Date.UTC(2026, 9, 20)), {}, "visitor-test-v2");
  assert.equal(await prisma.visitorPrivacyRecord.count({ where: { visitorId: first.visitor.id } }), 2);

  const otherPhone = await checkIn("2", new Date(Date.UTC(2026, 9, 19)));
  const otherBirthDate = await checkIn("3", new Date(Date.UTC(2026, 9, 19)), { phone: phone("1"), birthDate: "1991-01-15" });
  assert.notEqual(otherPhone.visitor.id, first.visitor.id);
  assert.notEqual(otherBirthDate.visitor.id, first.visitor.id);

  await prisma.visitor.update({ where: { id: first.visitor.id }, data: { status: VisitorStatus.INACTIVE } });
  const reactivated = await checkIn("1", new Date(Date.UTC(2026, 9, 21)));
  assert.equal(reactivated.reactivated, true);
  assert.equal(reactivated.visitor.status, VisitorStatus.ACTIVE);

  const deleted = await checkIn("4", new Date(Date.UTC(2026, 9, 19)));
  await prisma.visitor.update({ where: { id: deleted.visitor.id }, data: { deletedAt: new Date() } });
  assert.equal(await visitorRepository.findByIdentity(phone("4"), birthDate()), null);

  const concurrentVisitor = visitor("5");
  const concurrentDate = new Date(Date.UTC(2026, 9, 19));
  const outcomes = await Promise.allSettled([
    visitorService.checkIn({ visitor: concurrentVisitor, privacy: privacy(), visitDate: concurrentDate, reactivateInactive: true }),
    visitorService.checkIn({ visitor: concurrentVisitor, privacy: privacy(), visitDate: concurrentDate, reactivateInactive: true })
  ]);
  assert.ok(outcomes.every((result) => result.status === "fulfilled"), "Ambos os check-ins concorrentes devem concluir.");
  const concurrent = outcomes.map((result) => {
    if (result.status === "rejected") throw result.reason;
    return result.value;
  });
  assert.equal(new Set(concurrent.map((result) => result.visitor.id)).size, 1);
  const concurrentId = concurrent[0].visitor.id;
  assert.equal(await prisma.visitor.count({ where: { id: concurrentId } }), 1);
  assert.equal(await prisma.visitorVisit.count({ where: { visitorId: concurrentId } }), 1);
  assert.equal(await prisma.visitorPrivacyRecord.count({ where: { visitorId: concurrentId } }), 1);

  const concurrentVisitDate = new Date(Date.UTC(2026, 9, 22));
  const visitOutcomes = await Promise.allSettled([
    visitorService.checkIn({ visitor: concurrentVisitor, privacy: privacy(), visitDate: concurrentVisitDate }),
    visitorService.checkIn({ visitor: concurrentVisitor, privacy: privacy(), visitDate: concurrentVisitDate })
  ]);
  assert.ok(visitOutcomes.every((result) => result.status === "fulfilled"), "Visitas concorrentes devem concluir.");
  assert.equal(await prisma.visitorVisit.count({ where: { visitorId: concurrentId, visitDate: concurrentVisitDate } }), 1);

  const converted = visitor("8", { status: VisitorStatus.CONVERTED });
  await assert.rejects(
    () => visitorService.checkIn({ visitor: converted, privacy: privacy(), visitDate: concurrentDate }),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "VISITOR_STATUS_UNAVAILABLE"
  );
  assert.equal(await prisma.visitor.count({ where: { phone: converted.phone, birthDate: converted.birthDate } }), 0);

  const originalPrivacy = visitorRepository.upsertPrivacyRecord;
  const originalVisit = visitorRepository.upsertVisit;
  try {
    visitorRepository.upsertPrivacyRecord = () => { throw new Error("forced privacy failure"); };
    const failedPrivacy = visitor("6");
    await assert.rejects(() => visitorService.checkIn({ visitor: failedPrivacy, privacy: privacy(), visitDate: concurrentDate }), /forced privacy failure/);
    assert.equal(await prisma.visitor.count({ where: { phone: failedPrivacy.phone, birthDate: failedPrivacy.birthDate } }), 0);
    visitorRepository.upsertPrivacyRecord = originalPrivacy;

    visitorRepository.upsertVisit = () => { throw new Error("forced visit failure"); };
    const failedVisit = visitor("7");
    await assert.rejects(() => visitorService.checkIn({ visitor: failedVisit, privacy: privacy(), visitDate: concurrentDate }), /forced visit failure/);
    assert.equal(await prisma.visitor.count({ where: { phone: failedVisit.phone, birthDate: failedVisit.birthDate } }), 0);
    assert.equal(await prisma.visitorPrivacyRecord.count({ where: { visitor: { phone: failedVisit.phone } } }), 0);
  } finally {
    visitorRepository.upsertPrivacyRecord = originalPrivacy;
    visitorRepository.upsertVisit = originalVisit;
  }

  for (const code of ["visitor.view", "visitor.create", "visitor.update", "visitor.delete"]) assert.ok(availablePermissions.some((permission) => permission.code === code), `Permissao ausente: ${code}`);
  assert.equal(availablePermissions.map((permission) => permission.code as string).includes("visitor.convert"), false);
  console.log("Visitor domain tests passed: 35 baseline scenarios and additional concurrency/status checks.");
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => {
    await prisma.visitor.deleteMany({ where: { name: { startsWith: prefix } } });
    assert.equal(await prisma.visitor.count({ where: { name: { startsWith: prefix } } }), 0, "Fixtures devem ser removidos.");
    await prisma.$disconnect();
  });
