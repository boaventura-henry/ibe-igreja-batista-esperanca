import assert from "node:assert/strict";
import { appFeatures } from "../src/config/app-features";
import { appReleases, type AppRelease } from "../src/config/app-releases";
import { appRoadmap } from "../src/config/app-roadmap";
import { EXPECTED_DATABASE_SCHEMA } from "../src/config/database-schema";
import { getAppVersionInfo, shortCommitHash } from "../src/lib/app-version";
import { hasPermission } from "../src/lib/permissions";
import { compareSemanticVersions, isSemanticVersion } from "../src/lib/semantic-version";
import { getLatestPublishedRelease, getPendingPublishedRelease, getPublishedReleases, markPublishedReleaseAsSeen } from "../src/services/app-release.service";
import { buildUnavailableDatabaseDiagnostics, resolveSchemaAlignment } from "../src/services/system-diagnostics.service";
import { releaseSeenSchema } from "../src/validators/app-release.validator";

const publishedReleases: AppRelease[] = [
  { version: "0.1.0", title: "Base", summary: "Primeira entrega publicada.", type: "MINOR", status: "PUBLISHED", releaseDate: "2026-01-01", highlights: ["Base do sistema"], technicalNotes: ["Nota interna"] },
  { version: "0.2.0", title: "Atual", summary: "Entrega publicada de teste.", type: "MINOR", status: "PUBLISHED", releaseDate: "2026-02-01", highlights: ["Melhoria atual"] }
];

async function main() {

assert.equal(appReleases.find((release) => release.version === "0.2.0")?.status, "UNRELEASED", "1: 0.2.0 permanece nao publicada");
assert.equal(getLatestPublishedRelease(appReleases), null, "1: release nao publicada nao gera modal");
await assert.rejects(() => markPublishedReleaseAsSeen({ userId: "user-1", version: "0.2.0" }), /nao foi publicada/i, "1: release nao publicada nao pode ser marcada");

assert.equal(getPendingPublishedRelease("0.1.0", publishedReleases)?.version, "0.2.0", "2: usuario recebe a ultima release publicada pendente");
assert.equal(getPendingPublishedRelease("0.2.0", publishedReleases), null, "3: release ja visualizada nao reaparece");
assert.equal(getPendingPublishedRelease(null, publishedReleases)?.version, "0.2.0", "4: usuario novo recebe somente a release publicada mais recente");

const unrelatedUserState = { name: "Usuario", email: "user@example.test" };
let persisted: { userId: string; version: string } | null = null;
await markPublishedReleaseAsSeen({ userId: "user-1", version: "0.2.0" }, { releases: publishedReleases, update: async (input) => { persisted = input; return { id: input.userId, lastSeenAppVersion: input.version }; } });
assert.deepEqual(persisted, { userId: "user-1", version: "0.2.0" }, "5: confirmacao atualiza somente usuario e versao recebidos do service");
assert.deepEqual(unrelatedUserState, { name: "Usuario", email: "user@example.test" }, "5: outros campos permanecem intactos");

await assert.rejects(() => markPublishedReleaseAsSeen({ userId: "user-1", version: "9.9.9" }, { releases: publishedReleases }), /nao encontrada/i, "6: versao inexistente e rejeitada");
await assert.rejects(() => markPublishedReleaseAsSeen({ userId: "user-1", version: "0.2.0" }), /nao foi publicada/i, "7: versao futura nao publicada e rejeitada");
assert.equal(releaseSeenSchema.safeParse({ userId: "outro-usuario", version: "0.2.0" }).success, false, "8: payload nao aceita manipulacao de userId");

assert(compareSemanticVersions("0.2.0", "0.1.0") > 0 && compareSemanticVersions("0.10.0", "0.9.0") > 0 && compareSemanticVersions("1.0.0", "0.99.0") > 0, "9: comparacao SemVer e numerica");
assert.equal(isSemanticVersion("01.2.0"), false, "9: versao invalida e rejeitada");

const publicRoadmap = appRoadmap.filter((item) => item.public && item.status !== "CANCELLED");
assert(publicRoadmap.length > 0 && publicRoadmap.every((item) => item.public), "10: usuario comum ve somente roadmap publico");
assert(appRoadmap.length > publicRoadmap.length && appRoadmap.some((item) => !item.public), "11: administrador pode receber tambem itens internos");

const authorized = { permissions: [], permissionCodes: ["system.diagnostics.view"] };
const denied = { permissions: [], permissionCodes: [] };
assert.equal(hasPermission(authorized, "system.diagnostics.view"), true, "12: permissao libera a secao tecnica minima");
assert.equal(hasPermission(denied, "system.diagnostics.view"), false, "13: usuario sem permissao nao recebe diagnosticos");

assert.equal(resolveSchemaAlignment(EXPECTED_DATABASE_SCHEMA.latestMigration), "UP_TO_DATE", "14: schema correspondente esta atualizado");
assert.equal(resolveSchemaAlignment("20260720143000_add_push_retry_attempt_unique_constraint"), "OUTDATED", "15: migration anterior indica banco atrasado");
assert.equal(resolveSchemaAlignment("20260721999999_future_migration"), "AHEAD", "16: migration posterior indica banco adiantado");

const unavailable = buildUnavailableDatabaseDiagnostics(false);
assert.equal(unavailable.status, "ERROR", "17: banco indisponivel produz diagnostico seguro sem interromper a pagina");
const missingTable = buildUnavailableDatabaseDiagnostics(true);
assert.equal(missingTable.status, "UNKNOWN", "18: tabela de migrations ausente produz estado desconhecido");

assert.equal(shortCommitHash("ABCDEF1234567890"), "abcdef1", "19: hash de build e limitado a sete caracteres");
const safePayload = JSON.stringify({ application: getAppVersionInfo(), database: unavailable, releases: getPublishedReleases(publishedReleases), features: appFeatures });
for (const forbidden of ["DATABASE_URL", "password", "secret", "checksum", "SELECT ", "C:\\Users\\"]) assert(!safePayload.toLowerCase().includes(forbidden.toLowerCase()), `20: resposta nao contem ${forbidden}`);
assert(!safePayload.includes("Nota interna"), "20: endpoint comum remove notas tecnicas");

console.log("App releases, roadmap and diagnostics: 20 scenarios passed.");
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Release diagnostics tests failed.");
  process.exitCode = 1;
});
