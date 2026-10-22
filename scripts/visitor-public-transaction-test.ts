import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import { PrismaClient, VisitorPrivacyChannel, VisitorStatus } from "@prisma/client";
import { visitorService } from "@/services/visitor.service";
import { visitorPublicPrisma } from "@/lib/visitor-public-prisma";
import { visitorCreateSchema } from "@/validators/visitor.validator";

const expectedHosts = new Set([
  "ep-twilight-haze-adynpvs9.c-2.us-east-1.aws.neon.tech",
  "ep-twilight-haze-adynpvs9-pooler.c-2.us-east-1.aws.neon.tech"
]);
for (const key of ["DATABASE_URL", "DIRECT_URL"] as const) {
  const url = new URL(process.env[key] ?? "");
  if (!expectedHosts.has(url.hostname) || url.pathname !== "/ibe" || ![null, "public"].includes(url.searchParams.get("schema"))) {
    throw new Error("Development database identity not confirmed");
  }
}

const prisma = new PrismaClient();
const prefix = `__visitor_public_test_${randomUUID()}__`;
const birthDate = "1990-05-10";
const privacy = { noticeVersion: "visitor-public-test", channel: VisitorPrivacyChannel.PUBLIC_VISIT_FORM };
const visitDate = new Date("2026-10-20T00:00:00.000Z");
const phones = Array.from({ length: 3 }, () => `119${String(randomInt(10_000_000, 99_999_999))}`);
const visitor = (index: number, name: string) => visitorCreateSchema.parse({ phone: phones[index], birthDate, name: `${prefix}${name}` });
const run = (index: number, name: string) => visitorService.checkIn({ visitor: visitor(index, name), privacy, visitDate, reactivateInactive: true }, visitorPublicPrisma);

async function main() {
  assert.equal(new Set(phones).size, phones.length);
  assert.equal(await prisma.visitor.count({ where: { phone: { in: phones } } }), 0);
  const identity = { phone: phones[0], birthDate: new Date(`${birthDate}T00:00:00.000Z`), privacy, visitDate };
  assert.equal(await visitorService.checkInExisting(identity, visitorPublicPrisma), false);
  const before = await run(0, "original");
  await run(0, "must-not-overwrite");
  const unchanged = await prisma.visitor.findUniqueOrThrow({ where: { id: before.visitor.id } });
  assert.equal(unchanged.name, `${prefix}original`);
  assert.equal(await prisma.visitorVisit.count({ where: { visitorId: unchanged.id } }), 1);
  assert.equal(await prisma.visitorPrivacyRecord.count({ where: { visitorId: unchanged.id } }), 1);
  await prisma.visitor.update({ where: { id: unchanged.id }, data: { status: VisitorStatus.INACTIVE } });
  assert.equal(await visitorService.checkInExisting(identity, visitorPublicPrisma), true);
  assert.equal((await prisma.visitor.findUniqueOrThrow({ where: { id: unchanged.id } })).status, VisitorStatus.ACTIVE);
  const concurrent = await Promise.all([run(1, "first"), run(1, "second")]);
  assert.equal(concurrent[0].visitor.id, concurrent[1].visitor.id);
  assert.equal(await prisma.visitorVisit.count({ where: { visitorId: concurrent[0].visitor.id } }), 1);
  const deleted = await run(2, "deleted");
  await prisma.visitor.update({ where: { id: deleted.visitor.id }, data: { deletedAt: new Date() } });
  await assert.rejects(() => run(2, "replacement"));
  assert.equal(await prisma.visitor.count({ where: { phone: phones[2] } }), 1);
  assert.ok((await prisma.visitor.findUniqueOrThrow({ where: { id: deleted.visitor.id } })).deletedAt);
  console.log("Development transaction tests passed: TOCTOU, reactivation, same-day, concurrency and soft delete.");
}

main().finally(async () => {
  await prisma.visitor.deleteMany({ where: { phone: { in: phones }, name: { startsWith: prefix } } });
  const remaining = await prisma.visitor.count({ where: { phone: { in: phones }, name: { startsWith: prefix } } });
  await prisma.$disconnect();
  await visitorPublicPrisma.$disconnect();
  if (remaining !== 0) throw new Error("Fixture cleanup incomplete");
}).catch(() => { console.error("Development transaction test failed."); process.exitCode = 1; });
