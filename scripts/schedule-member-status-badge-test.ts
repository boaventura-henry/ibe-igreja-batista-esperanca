import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ScheduleMemberStatus } from "@prisma/client";
import { getScheduleMemberStatusPresentation } from "../src/components/schedules/ScheduleMemberStatusBadge";

const expectations = [
  [ScheduleMemberStatus.PENDING, "Pendente", "bg-yellow-100"],
  [ScheduleMemberStatus.CONFIRMED, "Confirmada", "bg-green-100"],
  [ScheduleMemberStatus.DECLINED, "Recusada", "bg-red-100"],
  [ScheduleMemberStatus.ABSENT, "Ausente", "bg-red-100"],
  [ScheduleMemberStatus.REPLACED, "Substitu\u00edda", "bg-gray-100"]
] as const;

for (const [status, label, colorClass] of expectations) {
  const presentation = getScheduleMemberStatusPresentation(status);

  assert.equal(presentation.label, label);
  assert.match(presentation.className, new RegExp(colorClass));
}

const unknownPresentation = getScheduleMemberStatusPresentation("UNKNOWN_STATUS");

assert.equal(unknownPresentation.label, "Status desconhecido");
assert.match(unknownPresentation.className, /bg-gray-100/);

const dashboardSource = readFileSync("src/components/portal/PortalDashboard.tsx", "utf8");
const badgeSource = readFileSync(
  "src/components/schedules/ScheduleMemberStatusBadge.tsx",
  "utf8"
);

assert.match(
  badgeSource,
  /const presentation = getScheduleMemberStatusPresentation\(status\)/,
  "Badge deve utilizar a apresentacao compartilhada."
);

assert.match(
  dashboardSource,
  /<ScheduleMemberStatusBadge status=\{data\.nextSchedule\.status\} \/>/,
  "Dashboard do Portal deve reutilizar o badge compartilhado."
);
const dashboardWithoutBadge = dashboardSource.replace(
  /<ScheduleMemberStatusBadge status=\{data\.nextSchedule\.status\} \/>/,
  ""
);
assert.doesNotMatch(
  dashboardWithoutBadge,
  /\{data\.nextSchedule\.status\}/,
  "Dashboard do Portal nao deve renderizar o enum bruto."
);

console.log(`${expectations.length + 5} verificacoes de status do dashboard aprovadas.`);
