import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MemberMinistryStatus, ScheduleScope } from "@prisma/client";
import {
  buildActiveMemberMinistryWhere,
  buildScheduleScopeWhere
} from "../src/repositories/schedule-access.repository";
import { resolveScheduleAccessContext } from "../src/services/schedule-access.service";

async function main() {
  let repositoryCalls = 0;
  const all = await resolveScheduleAccessContext(
    { memberId: "member-1", scheduleScope: ScheduleScope.ALL },
    {
      async listActiveMinistryIds() {
        repositoryCalls += 1;
        return ["ministry-1"];
      }
    }
  );

  assert.equal(all.scope, ScheduleScope.ALL, "1: perfil ALL resolve contexto global");
  assert.equal(all.authorizedMinistryIds, null, "1: contexto global nao mantem lista ministerial");
  assert.equal(repositoryCalls, 0, "1: perfil ALL nao consulta vinculos ministeriais");
  assert.deepEqual(buildScheduleScopeWhere(all), {}, "1: perfil ALL nao adiciona filtro");

  const restricted = await resolveScheduleAccessContext(
    { memberId: "member-1", scheduleScope: ScheduleScope.MEMBER_MINISTRIES },
    {
      async listActiveMinistryIds(memberId) {
        repositoryCalls += 1;
        assert.equal(memberId, "member-1");
        return ["ministry-2", "ministry-1", "ministry-2"];
      }
    }
  );

  assert.deepEqual(
    restricted.authorizedMinistryIds,
    ["ministry-2", "ministry-1"],
    "2: contexto restrito contem somente IDs unicos retornados pelos vinculos vigentes"
  );
  assert(Object.isFrozen(restricted) && Object.isFrozen(restricted.authorizedMinistryIds), "2: contexto e IDs sao imutaveis");

  const activeLinkWhere = buildActiveMemberMinistryWhere("member-1");
  assert.equal(activeLinkWhere.exitDate, null, "3: vinculo encerrado nao e vigente");
  assert.equal(activeLinkWhere.deletedAt, null, "4: vinculo removido por soft delete nao e vigente");
  assert.equal(activeLinkWhere.status, MemberMinistryStatus.ACTIVE, "5: somente status ACTIVE e vigente");
  assert.equal(activeLinkWhere.memberId, "member-1", "5: vinculos pertencem exclusivamente ao Member autenticado");

  const withoutMember = await resolveScheduleAccessContext(
    { memberId: null, scheduleScope: ScheduleScope.MEMBER_MINISTRIES },
    { async listActiveMinistryIds() { throw new Error("Nao deve consultar sem memberId."); } }
  );
  assert.deepEqual(withoutMember.authorizedMinistryIds, [], "6: usuario sem Member recebe escopo vazio");

  const withoutLinks = await resolveScheduleAccessContext(
    { memberId: "member-2", scheduleScope: ScheduleScope.MEMBER_MINISTRIES },
    { async listActiveMinistryIds() { return []; } }
  );
  assert.deepEqual(withoutLinks.authorizedMinistryIds, [], "7: membro sem vinculos vigentes recebe escopo vazio");

  assert.deepEqual(
    buildScheduleScopeWhere(restricted),
    { ministryId: { in: ["ministry-2", "ministry-1"] } },
    "8: filtro restrito usa ministryId in"
  );
  assert.deepEqual(
    buildScheduleScopeWhere(withoutLinks),
    { ministryId: { in: [] } },
    "8: escopo restrito vazio produz consulta sem resultados"
  );

  const mySchedulesRepository = readFileSync("src/repositories/my-schedule.repository.ts", "utf8");
  const portalRepository = readFileSync("src/repositories/member-portal.repository.ts", "utf8");
  assert.match(
    mySchedulesRepository,
    /OR:\s*\[\{ memberId \}, \{ replacedByMemberId: memberId \}\]/,
    "9: Minhas Escalas isola o membro titular ou substituto da sessao"
  );
  assert.match(portalRepository, /memberId,\s*deletedAt:\s*null,\s*schedule:/, "9: Portal continua filtrando ScheduleMember.memberId");
  assert(!mySchedulesRepository.includes("scheduleScope") && !portalRepository.includes("scheduleScope"), "9: escopo administrativo nao foi conectado ao Portal");

  console.log("Schedule access infrastructure: 9 scenarios passed.");
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Schedule access infrastructure tests failed.");
  process.exitCode = 1;
});
