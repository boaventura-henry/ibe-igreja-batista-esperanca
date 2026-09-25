import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createEventForm } from "../src/components/events/EventManager";
import { createFinancialClosingForm } from "../src/components/financial/FinancialClosingManager";
import { createFinancialEntryForm } from "../src/components/financial/FinancialEntryManager";
import { createMemberMinistryForm } from "../src/components/member-ministries/MemberMinistryManager";
import { createScheduleForm } from "../src/components/schedules/ScheduleManager";
import {
  APPLICATION_TIME_ZONE,
  applicationDateInputValue,
  applicationDateOnlyCutoff,
  applicationDayRange,
  applicationDayStart,
  applicationMonthRange,
  applicationToday
} from "../src/lib/application-time";
import { currentFinancialMonthRange } from "../src/repositories/dashboard.repository";

let scenarios = 0;
function equal(actual: unknown, expected: unknown, message: string) {
  scenarios += 1;
  assert.equal(actual, expected, `${scenarios}: ${message}`);
}

const september24 = [
  "2026-09-24T23:59:00.000Z",
  "2026-09-25T00:00:00.000Z",
  "2026-09-25T00:59:00.000Z",
  "2026-09-25T01:00:00.000Z",
  "2026-09-25T02:59:00.000Z"
];
for (const instant of september24) {
  equal(applicationDateInputValue(new Date(instant)), "2026-09-24", `${instant} permanece em 24/09 em Sao Paulo`);
}
equal(applicationDateInputValue(new Date("2026-09-25T03:00:00.000Z")), "2026-09-25", "00:00 local inicia o dia 25");

const beforeMidnight = new Date("2026-09-25T02:59:59.999Z");
const atMidnight = new Date("2026-09-25T03:00:00.000Z");
equal(applicationDateOnlyCutoff(beforeMidnight).toISOString(), "2026-09-24T00:00:00.000Z", "cutoff civil nao antecipa o dia");
equal(applicationDateOnlyCutoff(atMidnight).toISOString(), "2026-09-25T00:00:00.000Z", "cutoff civil vira na meia-noite local");
equal(applicationDayStart(beforeMidnight).toISOString(), "2026-09-24T03:00:00.000Z", "inicio do dia e um instante local convertido");
const dayRange = applicationDayRange(beforeMidnight);
equal(dayRange.start.toISOString(), "2026-09-24T03:00:00.000Z", "janela diaria inicia na meia-noite local");
equal(dayRange.end.toISOString(), "2026-09-25T03:00:00.000Z", "janela diaria termina no proximo inicio local");

const skippedMidnight = new Date("2018-11-04T12:00:00.000Z");
const skippedMidnightRange = applicationDayRange(skippedMidnight);
equal(applicationDayStart(skippedMidnight).toISOString(), "2018-11-04T03:00:00.000Z", "inicio do dia respeita transicao IANA sem meia-noite");
equal(skippedMidnightRange.start.toISOString(), "2018-11-04T03:00:00.000Z", "janela inicia no primeiro instante do dia civil");
equal(skippedMidnightRange.end.toISOString(), "2018-11-05T02:00:00.000Z", "janela termina no proximo inicio local apos transicao IANA");

const septemberMonth = applicationMonthRange(new Date("2026-10-01T02:59:59.999Z"));
equal(septemberMonth.start.toISOString(), "2026-09-01T03:00:00.000Z", "mes de timestamps inicia em setembro local");
equal(septemberMonth.end.toISOString(), "2026-10-01T03:00:00.000Z", "mes de timestamps termina em outubro local");
const octoberMonth = applicationMonthRange(new Date("2026-10-01T03:00:00.000Z"));
equal(octoberMonth.start.toISOString(), "2026-10-01T03:00:00.000Z", "mes vira somente a meia-noite local");

const december = applicationMonthRange(new Date("2027-01-01T02:59:59.999Z"));
equal(applicationDateInputValue(new Date("2027-01-01T02:59:59.999Z")), "2026-12-31", "ano civil nao vira antes da meia-noite local");
equal(december.start.toISOString(), "2026-12-01T03:00:00.000Z", "janela anual preserva dezembro");
equal(applicationDateInputValue(new Date("2027-01-01T03:00:00.000Z")), "2027-01-01", "ano civil vira na meia-noite local");

const leapDay = new Date("2028-02-29T15:00:00.000Z");
equal(applicationDateInputValue(leapDay), "2028-02-29", "29 de fevereiro e preservado");
equal(applicationDayRange(leapDay).end.toISOString(), "2028-03-01T03:00:00.000Z", "dia seguinte ao ano bissexto e valido");
equal(applicationMonthRange(leapDay).end.toISOString(), "2028-03-01T03:00:00.000Z", "mes bissexto termina corretamente");

const previousTz = process.env.TZ;
process.env.TZ = "UTC";
const serverDate = applicationDateInputValue(new Date("2026-09-25T01:00:00.000Z"));
process.env.TZ = "Asia/Tokyo";
const browserDate = applicationDateInputValue(new Date("2026-09-25T01:00:00.000Z"));
process.env.TZ = previousTz;
equal(serverDate, browserDate, "browser e server produzem a mesma data civil");
equal(APPLICATION_TIME_ZONE, "America/Sao_Paulo", "timezone de negocio permanece centralizado");
equal(applicationToday(new Date("2026-09-25T01:00:00.000Z")).day, 24, "applicationToday ignora timezone da maquina");

const beforePageLoad = new Date("2026-09-25T02:50:00.000Z");
const afterModalOpen = new Date("2026-09-25T03:05:00.000Z");
equal(createFinancialEntryForm(beforePageLoad).launchDate, "2026-09-24", "lancamento usa dia da abertura simulada");
equal(createFinancialEntryForm(afterModalOpen).launchDate, "2026-09-25", "novo lancamento recalcula data apos a virada");
equal(createFinancialEntryForm(new Date("2026-09-25T01:00:00.000Z")).referenceDate, "2026-09-24", "referencia financeira respeita Sao Paulo");
equal(createFinancialClosingForm(new Date("2026-09-25T01:00:00.000Z")).date, "2026-09-24", "fechamento respeita Sao Paulo");
equal(createScheduleForm(new Date("2026-09-25T01:00:00.000Z")).date, "2026-09-24", "nova escala respeita Sao Paulo");
equal(createEventForm(new Date("2026-09-25T01:00:00.000Z")).startDate, "2026-09-24", "novo evento respeita Sao Paulo");
equal(createMemberMinistryForm(new Date("2026-09-25T01:00:00.000Z")).entryDate, "2026-09-24", "novo vinculo ministerial respeita Sao Paulo");

const financialMonth = currentFinancialMonthRange(new Date("2026-10-01T02:59:59.999Z"));
equal(financialMonth.start.toISOString(), "2026-09-01T00:00:00.000Z", "resumo financeiro date-only preserva setembro");
equal(financialMonth.end.toISOString(), "2026-10-01T00:00:00.000Z", "resumo financeiro usa limite exclusivo date-only");

const birthdayRepository = readFileSync("src/repositories/birthday.repository.ts", "utf8");
const birthdayService = readFileSync("src/services/birthday.service.ts", "utf8");
const dashboardRepository = readFileSync("src/repositories/dashboard.repository.ts", "utf8");
const pushLogRepository = readFileSync("src/repositories/push-notification-log.repository.ts", "utf8");
const pushHealthRepository = readFileSync("src/repositories/push-notification-health.repository.ts", "utf8");
const lifecycleService = readFileSync("src/services/lifecycle.service.ts", "utf8");

equal(birthdayRepository.includes("CURRENT_DATE"), false, "aniversarios nao dependem do timezone da sessao PostgreSQL");
equal(birthdayRepository.includes("list(today: string)"), true, "repository recebe data civil sem cast dependente da sessao");
equal(birthdayService.includes("birthdayRepository.list(applicationDateInputValue(now))"), true, "service envia data civil parametrizada ao repository");
equal(birthdayService.includes("records[0]?.today ?? today"), true, "mes vazio preserva a data civil calculada");
equal(dashboardRepository.includes("applicationMonthRange(value)"), true, "novos membros usam janela mensal local");
equal(pushLogRepository.includes("applicationDayRange(now)"), true, "metricas push hoje usam janela local");
equal(pushHealthRepository.includes("applicationDayRange(now)"), true, "saude push hoje usa janela local");
equal(lifecycleService.includes("applicationDateOnlyCutoff(now)"), true, "lifecycle de data civil permanece canonico");
equal(lifecycleService.includes("applicationDayStart(now)"), true, "lifecycle de comunicados permanece canonico");

console.log(`Timezone and civil date: ${scenarios} scenarios passed.`);
