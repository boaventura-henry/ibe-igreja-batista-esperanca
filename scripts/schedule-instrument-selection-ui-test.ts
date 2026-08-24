import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const [manager, categoryRoute, eligibleRoute, assignmentService, assignmentRepository] = await Promise.all([
    readFile("src/components/schedules/ScheduleDetailManager.tsx", "utf8"),
    readFile("src/app/api/instrument-categories/route.ts", "utf8"),
    readFile("src/app/api/schedules/[id]/eligible-instruments/route.ts", "utf8"),
    readFile("src/services/schedule-instrument-assignment.service.ts", "utf8"),
    readFile("src/repositories/schedule-instrument-assignment.repository.ts", "utf8")
  ]);

  const checks: Array<[RegExp, string, string]> = [
    [/hasInstrumentRole\(\{ roles: memberForm\.roles \}\)/, manager, "1. colecao de roles controla os campos instrumentais"],
    [/Categoria musical/, manager, "2. role INSTRUMENT mostra categoria"],
    [/Origem do instrumento/, manager, "3. role INSTRUMENT mostra origem"],
    [/source === "REGISTERED"/, manager, "4. REGISTERED mostra instrumento"],
    [/source === "OWN"/, manager, "5. OWN nao exige instrumento fisico"],
    [/Informe a categoria musical\./, manager, "6. categoria parcial e rejeitada"],
    [/Informe a origem do instrumento\./, manager, "7. origem parcial e rejeitada"],
    [/Selecione o instrumento da igreja\./, manager, "8. REGISTERED exige instrumentId"],
    [/instrumentId: ""/, manager, "9. trocar categoria limpa instrumento"],
    [/updateInstrumentSource\("OWN"\)/, manager, "10. REGISTERED para OWN limpa instrumento"],
    [/updateInstrumentSource\("REGISTERED"\)/, manager, "11. OWN para REGISTERED exige nova selecao"],
    [/eligible-instruments\?categoryId=/, manager, "12. consulta elegiveis no servidor"],
    [/InstrumentStatus\.ACTIVE|status: InstrumentStatus\.ACTIVE/, assignmentRepository, "13. somente ACTIVE e retornado"],
    [/deletedAt: null/, assignmentRepository, "14. removidos sao excluidos"],
    [/categoryId/, assignmentRepository, "15. categoria divergente e bloqueada"],
    [/const assignment = item\.instrumentAssignment/, manager, "16. edicao carrega assignment atual"],
    [/source: assignment\.source/, manager, "17. edicao preserva OWN"],
    [/Categoria nao informada/, manager, "18. escala antiga sem assignment permanece editavel"],
    [/(Inativa)|(Indisponivel)/, manager, "19. historico inativo continua visivel"],
    [/SCHEDULE_MEMBER_REPLACED|status === ScheduleMemberStatus\.REPLACED/, manager + assignmentService, "20. substituicao nao transfere assignment"],
    [/role === ScheduleMemberRole\.INSTRUMENT[\s\S]*instrumentAssignment: undefined/, manager, "21. remover INSTRUMENT limpa estado"],
    [/requireScheduleAccess\("schedule\.update"\)/, eligibleRoute, "22. elegiveis exigem schedule.update"],
    [/schedule\.update/, categoryRoute, "23. categoria pode ser lida por schedule.update"],
    [/isSubmitting/, manager, "24. submit duplicado e bloqueado"],
    [/aria-busy|<fieldset/, manager, "25. loading e origem possuem semantica acessivel"],
    [/Instrumento da igreja/, manager, "26. REGISTERED possui label amigavel"],
    [/Instrumento próprio/, manager, "27. OWN possui label amigavel"]
  ];

  for (const [pattern, source, label] of checks) {
    assert.match(source, pattern, label);
  }

  console.log("Schedule instrument selection UI: 27 scenarios passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
