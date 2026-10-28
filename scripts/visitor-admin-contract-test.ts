import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { VisitorStatus } from "@prisma/client";
import { visitorAdminUpdateSchema, visitorListQuerySchema } from "@/validators";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const listRoute = read("src/app/api/visitors/route.ts");
const detailRoute = read("src/app/api/visitors/[id]/route.ts");
const visitsRoute = read("src/app/api/visitors/[id]/visits/route.ts");
const repository = read("src/repositories/visitor.repository.ts");
const service = read("src/services/visitor.service.ts");
const listPage = read("src/app/(app)/visitantes/page.tsx");
const detailPage = read("src/app/(app)/visitantes/[id]/page.tsx");
const manager = read("src/components/visitors/VisitorManager.tsx");
const detail = read("src/components/visitors/VisitorDetail.tsx");
const form = read("src/components/visitors/VisitorForm.tsx");
const navigation = read("src/lib/navigation.ts");
const middleware = read("src/middleware.ts");

assert.deepEqual(visitorListQuerySchema.parse({}), { page: 1, pageSize: 20, sortBy: "name", sortOrder: "asc" });
assert.equal(visitorListQuerySchema.safeParse({ pageSize: 4 }).success, false);
assert.equal(visitorListQuerySchema.safeParse({ pageSize: 101 }).success, false);
assert.equal(visitorListQuerySchema.safeParse({ page: 0 }).success, false);
assert.equal(visitorListQuerySchema.safeParse({ sortBy: "deletedAt" }).success, false);
assert.equal(visitorListQuerySchema.safeParse({ sortOrder: "random" }).success, false);
assert.equal(visitorListQuerySchema.parse({ status: "CONVERTED" }).status, VisitorStatus.CONVERTED);
assert.equal(visitorAdminUpdateSchema.parse({ phone: "(11) 99876-5432" }).phone, "11998765432");
assert.equal(visitorAdminUpdateSchema.safeParse({ phone: "119876543" }).success, false);
assert.equal(visitorAdminUpdateSchema.parse({ birthDate: "2000-02-29" }).birthDate!.toISOString().slice(0, 10), "2000-02-29");
assert.equal(visitorAdminUpdateSchema.parse({ street: "" }).street, null);
assert.equal(visitorAdminUpdateSchema.parse({ state: "sp" }).state, "SP");
assert.equal(visitorAdminUpdateSchema.parse({ state: "" }).state, null);
assert.equal(visitorAdminUpdateSchema.parse({ status: "ACTIVE" }).status, VisitorStatus.ACTIVE);
assert.equal(visitorAdminUpdateSchema.parse({ status: "INACTIVE" }).status, VisitorStatus.INACTIVE);
assert.equal(visitorAdminUpdateSchema.safeParse({ status: "CONVERTED" }).success, false);
for (const key of ["id", "createdAt", "updatedAt", "createdById", "updatedById", "deletedAt", "unexpected"]) {
  assert.equal(visitorAdminUpdateSchema.safeParse({ [key]: "forbidden" }).success, false, `${key} must be rejected`);
}
assert.equal(visitorAdminUpdateSchema.safeParse({}).success, false);

for (const [source, permission] of [[listRoute, "visitor.view"], [detailRoute, "visitor.view"], [visitsRoute, "visitor.view"]] as const) {
  assert.match(source, new RegExp(`requirePermission\\("${permission}"\\)`));
}
assert.match(listPage, /requirePermission\("visitor\.view"\)/);
assert.match(detailPage, /requirePermission\("visitor\.view"\)/);
assert.match(detailRoute, /requirePermission\("visitor\.update"\)/);
assert.match(detailRoute, /requirePermission\("visitor\.delete"\)/);
assert.doesNotMatch(listRoute, /export async function POST/);
assert.doesNotMatch(detailRoute, /export async function POST/);
assert.doesNotMatch(visitsRoute, /export async function (POST|PUT|PATCH|DELETE)/);
assert.match(repository, /deletedAt: null/);
assert.match(repository, /name: \{ contains: search, mode: "insensitive" \}/);
assert.match(repository, /phone: \{ contains: normalizedPhone \}/);
assert.match(repository, /prisma\.visitor\.findMany\(\{ where,/);
assert.match(repository, /prisma\.visitor\.count\(\{ where \}\)/);
assert.match(repository, /\{ \[filters\.sortBy\]: filters\.sortOrder \}/);
assert.match(repository, /\{ id: filters\.sortOrder \}/);
assert.match(repository, /orderBy: \[\{ visitDate: "desc" \}, \{ id: "desc" \}\]/);
assert.match(repository, /data: \{ deletedAt: new Date\(\), updatedById: userId \}/);
assert.match(repository, /where: \{ id, deletedAt: null, status: \{ not: VisitorStatus\.CONVERTED \} \}/);
assert.match(repository, /visitor: \{ deletedAt: null \}/);
assert.doesNotMatch(repository, /visitor\.delete\s*\(/);
assert.doesNotMatch(repository, /visitor\.deleteMany\s*\(/);
assert.match(service, /VISITOR_CONVERTED_READ_ONLY/);
assert.match(service, /VISITOR_IDENTITY_CONFLICT/);
assert.match(service, /const code = transactionCode\(error\)/);
assert.match(service, /code === "P2002"/);
assert.match(service, /code === "P2025"/);
assert.match(service, /findIdentityConflict\(phone, birthDate, id\)/);
assert.match(service, /visitorRepository\.update\(id, input, userId\)/);
assert.match(service, /visitorRepository\.softDelete\(id, userId\)/);
assert.doesNotMatch(service.match(/function serializeVisitor[^]*?\n\}/)?.[0] ?? "", /deletedAt/);
assert.match(service, /createdBy: visitor\.createdBy/);
assert.match(service, /updatedBy: visitor\.updatedBy/);

const privacySelect = repository.match(/privacyRecords:\s*\{\s*select:\s*\{([^}]*)\}/)?.[1] ?? "";
const privacyFields = [...privacySelect.matchAll(/(\w+): true/g)].map((match) => match[1]).sort();
assert.deepEqual(privacyFields, ["acknowledgedAt", "channel", "createdAt", "noticeVersion"]);
assert.doesNotMatch(detail, /record\.id/);

assert.doesNotMatch(form, /useState<VisitorFormValue>\(\{\s*\.\.\.value/);
for (const field of ["name", "birthDate", "street", "number", "complement", "district", "city", "state", "status"]) {
  assert.match(form, new RegExp(`${field}: value\\.${field}`));
}
assert.match(form, /phone: formatPhone\(value\.phone\)/);
assert.match(manager, /setTimeout\([^]*300\)/);
assert.match(manager, /overflow-x-auto/);
assert.match(detail, /permissions\.includes\("visitor\.update"\)/);
assert.match(detail, /permissions\.includes\("visitor\.delete"\)/);
assert.doesNotMatch(`${manager}\n${detail}\n${form}`, /dangerouslySetInnerHTML/);
assert.match(navigation, /href: "\/visitantes"[^\n]+permission: "visitor\.view"/);
assert.match(middleware, /pathname\.startsWith\("\/visitantes"\)/);
assert.match(detailRoute, /error instanceof SyntaxError/);

console.log("Visitor admin contract tests passed.");
