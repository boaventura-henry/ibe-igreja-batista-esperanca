import assert from "node:assert/strict";
import { ScheduleMemberRole } from "@prisma/client";
import { readFile } from "node:fs/promises";
import { getScheduleMemberDisplayRole } from "../src/lib/schedule-member-role";

const bassCategory = { instrumentCategory: { name: "Baixo" } };
const physicalBassName = "Baixo Tagima Millennium Top 5";

async function main() {
  assert.equal(
    getScheduleMemberDisplayRole(ScheduleMemberRole.INSTRUMENT, bassCategory),
    "Baixo",
    "REGISTERED assignments display their category."
  );
  assert.equal(
    getScheduleMemberDisplayRole(
      ScheduleMemberRole.INSTRUMENT,
      { ...bassCategory, source: "OWN" } as never
    ),
    "Baixo",
    "OWN assignments display their category."
  );
  assert.equal(
    getScheduleMemberDisplayRole(ScheduleMemberRole.INSTRUMENT),
    "Instrumento",
    "Historical assignments without a category use the deterministic fallback."
  );
  assert.equal(
    getScheduleMemberDisplayRole(
      ScheduleMemberRole.INSTRUMENT,
      { instrumentCategory: { name: "Baixo" }, instrument: { name: physicalBassName, status: "INACTIVE" } } as never
    ),
    "Baixo",
    "Instrument status does not change the historical category display."
  );
  assert.equal(
    getScheduleMemberDisplayRole(
      ScheduleMemberRole.INSTRUMENT,
      { instrumentCategory: { name: "Baixo" }, instrument: { name: physicalBassName, deletedAt: new Date() } } as never
    ),
    "Baixo",
    "Soft-deleted physical instruments do not replace the historical category display."
  );
  assert.notEqual(
    getScheduleMemberDisplayRole(ScheduleMemberRole.INSTRUMENT, bassCategory),
    physicalBassName,
    "Normal schedule surfaces never show the physical asset name."
  );
  assert.notEqual(
    getScheduleMemberDisplayRole(ScheduleMemberRole.INSTRUMENT, bassCategory),
    "Instrumento proprio",
    "Assignment source remains an administrative concept."
  );
  assert.equal(
    getScheduleMemberDisplayRole(ScheduleMemberRole.VOCAL, bassCategory),
    "Vocal",
    "Non-instrument roles keep their shared labels."
  );

  const files = await Promise.all([
    readFile("src/components/schedules/ScheduleDetailManager.tsx", "utf8"),
    readFile("src/components/my-schedules/MyScheduleManager.tsx", "utf8"),
    readFile("src/components/portal/PortalDashboard.tsx", "utf8"),
    readFile("src/services/schedule-notification.service.ts", "utf8"),
    readFile("src/repositories/my-schedule.repository.ts", "utf8"),
    readFile("src/repositories/dashboard.repository.ts", "utf8")
  ]);

  for (const file of files.slice(0, 4)) {
    assert.match(file, /getScheduleMemberDisplayRole/, "Surface must use the shared display helper.");
  }
  for (const repository of files.slice(4)) {
    assert.match(repository, /instrumentCategory: \{ select: \{ id: true, name: true \} \}/, "Display DTOs select only the category identity and name.");
  }
  assert.doesNotMatch(
    files.slice(0, 4).join("\n"),
    /Funcao: \$\{getScheduleMemberRolePresentation/,
    "Notifications must not resolve the raw instrument role."
  );

  console.log("Schedule instrument display: 12 scenarios passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});