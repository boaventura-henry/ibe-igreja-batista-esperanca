import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ScheduleMemberRole } from "@prisma/client";
import {
  getScheduleMemberRoles,
  hasInstrumentRole,
  normalizeScheduleMemberRoles,
  scheduleMemberRoleOptions
} from "../src/lib/schedule-member-role";

async function main() {
  const [manager, service, validator, types, documentation, updateRoute] = await Promise.all([
    readFile("src/components/schedules/ScheduleDetailManager.tsx", "utf8"),
    readFile("src/services/schedule.service.ts", "utf8"),
    readFile("src/validators/schedule.validator.ts", "utf8"),
    readFile("src/types/schedule.types.ts", "utf8"),
    readFile("docs/schedule-member-multiple-roles.md", "utf8"),
    readFile("src/app/api/schedules/[id]/members/[memberScheduleId]/route.ts", "utf8")
  ]);

  assert.deepEqual(
    scheduleMemberRoleOptions.map((option) => option.value),
    ["MINISTER", "LEADER", "VOCAL", "BACKING", "INSTRUMENT", "MEDIA", "RECEPTION", "CHILDREN", "SUPPORT", "OTHER"],
    "1: roles usam a ordem central oficial"
  );
  assert.match(manager, /type="checkbox"[\s\S]*name="schedule-member-roles"/, "2: controle permite multipla selecao");
  assert.match(manager, /legend[^>]*>Funções</, "3: controle possui label plural acessivel");
  assert.match(manager, /Selecione pelo menos uma função\./, "4: UI informa obrigatoriedade");
  assert.match(manager, /Informe pelo menos uma funcao\./, "5: submit impede colecao vazia");
  assert.match(validator, /\.min\(1, "Informe pelo menos uma funcao\."\)/, "6: backend preserva invariante minimo");
  assert.match(validator, /new Set\(roles\)\.size !== roles\.length/, "7: backend rejeita duplicatas");
  assert.match(service, /SCHEDULE_MEMBER_ROLE_DUPLICATE/, "8: codigo de duplicata permanece oficial");

  assert.deepEqual(normalizeScheduleMemberRoles([ScheduleMemberRole.BACKING]), [ScheduleMemberRole.BACKING], "9: create singular BACKING");
  assert.deepEqual(normalizeScheduleMemberRoles([ScheduleMemberRole.INSTRUMENT, ScheduleMemberRole.BACKING]), [ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT], "10: create BACKING + INSTRUMENT");
  assert.deepEqual(normalizeScheduleMemberRoles([ScheduleMemberRole.INSTRUMENT, ScheduleMemberRole.MINISTER]), [ScheduleMemberRole.MINISTER, ScheduleMemberRole.INSTRUMENT], "11: create MINISTER + INSTRUMENT");
  assert.match(manager, /allowMinistryException/, "12: membro excecao usa o mesmo formulario");

  assert.match(manager, /roles: getScheduleMemberRoles\(item\)/, "13: edicao carrega todas as roles reais");
  assert.deepEqual(getScheduleMemberRoles({ role: ScheduleMemberRole.OTHER, roles: [{ role: ScheduleMemberRole.BACKING }, { role: ScheduleMemberRole.INSTRUMENT }] }), [ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT], "14: colecao carregada prevalece sobre legado");
  assert.deepEqual(getScheduleMemberRoles({ role: ScheduleMemberRole.INSTRUMENT, roles: [] }), [], "15: roles vazia nao recorre ao legado");
  assert.deepEqual(getScheduleMemberRoles({ role: ScheduleMemberRole.BACKING }), [ScheduleMemberRole.BACKING], "16: contrato legado sem colecao possui fallback");

  assert.match(manager, /hasInstrumentRole\(\{ roles: memberForm\.roles \}\)/, "17: INSTRUMENT controla campos pela colecao");
  assert.equal(hasInstrumentRole({ roles: [ScheduleMemberRole.BACKING, ScheduleMemberRole.INSTRUMENT] }), true, "18: adicionar INSTRUMENT mostra campos");
  assert.equal(hasInstrumentRole({ roles: [ScheduleMemberRole.BACKING] }), false, "19: remover INSTRUMENT oculta campos");
  assert.match(manager, /!checked && role === ScheduleMemberRole\.INSTRUMENT[\s\S]*instrumentAssignment: undefined/, "20: remover INSTRUMENT limpa draft");
  assert.match(manager, /!checked && role === ScheduleMemberRole\.INSTRUMENT[\s\S]*setEligibleInstruments\(\[\]\)/, "21: remover INSTRUMENT limpa elegiveis");
  assert.match(manager, /!checked && role === ScheduleMemberRole\.INSTRUMENT[\s\S]*setFormMessage\(""\)/, "21b: remover INSTRUMENT limpa erro instrumental incompatível");
  assert.match(manager, /checked[\s\S]*\[\.\.\.current\.roles, role\]/, "22: adicionar role preserva roles existentes");
  assert.match(manager, /current\.roles\.filter\(\(currentRole\) => currentRole !== role\)/, "23: remover outra role preserva INSTRUMENT");

  assert.match(manager, /source === "REGISTERED"[\s\S]*instrumentId/, "24: REGISTERED exige patrimonio");
  assert.match(manager, /updateInstrumentSource\("OWN"\)/, "25: OWN permanece disponivel");
  assert.match(manager, /instrumentId: assignment\.instrument\?\.id \?\? ""/, "26: edicao carrega assignment atual");
  assert.match(manager, /\(Inativa\)|\(Indisponivel\)/, "27: historico inativo permanece representavel");
  assert.match(manager, /hasInstrumentRole\(selectedScheduleMember\)[\s\S]*!selectedScheduleMember\.instrumentAssignment/, "27b: fallback sem assignment vale apenas para legado instrumentista");

  assert.match(manager, /instrument-suggestion\?memberId=/, "28: suggestion 0.2.4 permanece integrada");
  assert.match(manager, /roles: normalizeScheduleMemberRoles\([\s\S]*ScheduleMemberRole\.INSTRUMENT/, "29: suggestion seleciona INSTRUMENT");
  assert.doesNotMatch(manager.match(/async function loadInstrumentSuggestion[\s\S]*?function updateMemberId/)?.[0] ?? "", /ScheduleMemberRole\.BACKING/, "30: suggestion nao marca BACKING");
  assert.match(manager, /memberId && \(!editingId \|\| memberId !== selectedScheduleMember\?\.member\.id\)/, "31: troca de membro em edicao recarrega sugestao");
  assert.match(manager, /current\.memberId !== memberId \|\| requestId !== suggestionRequest\.current/, "31: resposta obsoleta nao altera outro membro");
  assert.match(manager, /function updateRole[\s\S]*suggestionRequest\.current \+= 1/, "32: edicao manual invalida suggestion");
  assert.match(manager, /memberId,[\s\S]*roles: \[\],[\s\S]*instrumentAssignment: undefined/, "33: troca de membro limpa estado anterior");

  assert.match(manager, /const payload = \{[\s\S]*roles: form\.roles/, "34: submit envia colecao completa");
  assert.match(types, /roles\?: ScheduleMemberRole\[\]/, "35: contrato transitorio aceita roles");
  assert.match(service, /resolveLegacyScheduleMemberRole/, "36: backend projeta role legado");
  assert.match(validator, /role: z\.enum\(ScheduleMemberRole\)\.optional\(\)/, "36b: create moderno distingue role omitida de role explicita");
  assert.match(service, /!hasInstrumentRole\(result\)/, "37: remover INSTRUMENT encerra assignment");
  assert.match(documentation, /Adding `INSTRUMENT` does not create an assignment automatically/, "38: adicionar INSTRUMENT sozinho nao cria assignment");
  assert.match(manager, /if \(isSubmitting\)/, "39: double submit bloqueado");
  assert.match(manager, /permissionCodes\.includes\("schedule\.update"\)/, "40: RBAC schedule.update preservado");
  assert.match(updateRoute, /payload\.roles/, "40b: update somente de roles exige schedule.update");
  assert.match(service, /transaction\(async \(database\)/, "41: create e update permanecem transacionais");
  assert.match(service, /lockByIdWithinScope[\s\S]*lockScheduleMemberById/, "42: update preserva ordem de locks");
  assert.doesNotMatch(manager, /memberForm\.role\s*===\s*ScheduleMemberRole\.INSTRUMENT/, "43: UI nao decide instrumento pelo legado");

  console.log("Schedule member multiple roles admin: 48 scenarios passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
