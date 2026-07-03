import {
  EventStatus,
  EventType,
  FinancialEntryType,
  FinancialPaymentMethod,
  MemberStatus,
  ScheduleStatus,
  WeekDay
} from "@prisma/client";
import { AppError } from "@/lib/errors";
import {
  createReportFilename,
  generateCsv,
  generatePdf,
  generateXlsx,
  getPagination
} from "@/lib/report";
import { reportRepository } from "@/repositories";
import type {
  ReportCatalogGroup,
  ReportColumn,
  ReportDefinition,
  ReportExportFormat,
  ReportFileResult,
  ReportFilterField,
  ReportViewResult
} from "@/types";
import type {
  EventReportInput,
  FinancialReportInput,
  MemberReportInput,
  MinistryReportInput,
  PortalContributionReportInput,
  ScheduleReportInput
} from "@/validators";

function option(label: string, value: string) {
  return { label, value };
}

const statusOptions = Object.values(MemberStatus).map((value) => option(value, value));
const scheduleStatusOptions = Object.values(ScheduleStatus).map((value) => option(value, value));
const eventTypeOptions = Object.values(EventType).map((value) => option(value, value));
const eventStatusOptions = Object.values(EventStatus).map((value) => option(value, value));
const financialTypeOptions = Object.values(FinancialEntryType).map((value) => option(value, value));
const paymentMethodOptions = Object.values(FinancialPaymentMethod).map((value) => option(value, value));
const weekDayOptions = Object.values(WeekDay).map((value) => option(value, value));

const reportColumns = {
  members: [
    { key: "name", label: "Nome" },
    { key: "cpf", label: "CPF" },
    { key: "email", label: "E-mail" },
    { key: "city", label: "Cidade" },
    { key: "status", label: "Situacao" },
    { key: "ministries", label: "Ministerios" },
    { key: "createdAt", label: "Cadastro" }
  ],
  ministries: [
    { key: "name", label: "Nome" },
    { key: "status", label: "Status" },
    { key: "leader", label: "Lider" },
    { key: "viceLeader", label: "Vice-lider" },
    { key: "meetingDay", label: "Dia" },
    { key: "meetingTime", label: "Horario" },
    { key: "location", label: "Local" }
  ],
  schedules: [
    { key: "title", label: "Escala" },
    { key: "date", label: "Data" },
    { key: "time", label: "Horario" },
    { key: "ministry", label: "Ministerio" },
    { key: "status", label: "Status" },
    { key: "members", label: "Membros" }
  ],
  events: [
    { key: "title", label: "Evento" },
    { key: "type", label: "Tipo" },
    { key: "status", label: "Status" },
    { key: "startDate", label: "Data" },
    { key: "startTime", label: "Horario" },
    { key: "ministry", label: "Ministerio" },
    { key: "location", label: "Local" }
  ],
  financial: [
    { key: "entryNumber", label: "Numero" },
    { key: "type", label: "Tipo" },
    { key: "launchDate", label: "Data" },
    { key: "category", label: "Categoria" },
    { key: "amount", label: "Valor" },
    { key: "paymentMethod", label: "Forma" },
    { key: "status", label: "Status" },
    { key: "member", label: "Membro" },
    { key: "ministry", label: "Ministerio" },
    { key: "event", label: "Evento" }
  ],
  portalContributions: [
    { key: "launchDate", label: "Data" },
    { key: "category", label: "Categoria" },
    { key: "amount", label: "Valor" },
    { key: "paymentMethod", label: "Forma pagamento" },
    { key: "status", label: "Status" }
  ]
} satisfies Record<string, ReportColumn[]>;

function date(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function money(value: { toString(): string } | string | number | null | undefined) {
  return value == null ? "" : Number(value.toString()).toFixed(2);
}

function timeRange(start: string | null, end: string | null) {
  return [start, end].filter(Boolean).join(" - ");
}

function createFile(
  reportName: string,
  format: Exclude<ReportExportFormat, "view">,
  columns: ReportColumn[],
  rows: Array<Record<string, string>>
): ReportFileResult {
  const filename = createReportFilename(reportName, format);

  if (format === "csv") {
    return { filename, contentType: "text/csv; charset=utf-8", body: generateCsv(columns, rows) };
  }

  if (format === "xlsx") {
    return {
      filename,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      body: generateXlsx(columns, rows)
    };
  }

  return { filename, contentType: "application/pdf", body: generatePdf(reportName, columns, rows) };
}

function result(
  title: string,
  columns: ReportColumn[],
  rows: Array<Record<string, string>>,
  total: number,
  input: { page: number; pageSize: number; exportFormat: ReportExportFormat }
): ReportViewResult | ReportFileResult {
  if (input.exportFormat !== "view") {
    return createFile(title, input.exportFormat, columns, rows);
  }

  return {
    title,
    columns,
    rows,
    pagination: getPagination(input.page, input.pageSize, total)
  };
}

async function catalog(): Promise<ReportCatalogGroup[]> {
  const [ministries, members, categories, events] = await reportRepository.listFilterOptions();
  const ministryOptions = ministries.map((ministry) => option(ministry.name, ministry.id));
  const memberOptions = members.map((member) => option(member.name, member.id));
  const categoryOptions = categories.map((category) => option(`${category.name} (${category.type})`, category.id));
  const eventOptions = events.map((event) => option(event.title, event.id));
  const memberFilters: ReportFilterField[] = [
    { name: "name", label: "Nome", type: "text" },
    { name: "status", label: "Situacao", type: "select", options: statusOptions },
    { name: "ministryId", label: "Ministerio", type: "select", options: ministryOptions },
    { name: "city", label: "Cidade", type: "text" },
    { name: "createdFrom", label: "Cadastro de", type: "date" },
    { name: "createdTo", label: "Cadastro ate", type: "date" }
  ];
  const definitions: ReportDefinition[] = [
    {
      key: "members",
      title: "Lista de membros",
      module: "Membros",
      description: "Membros com filtros por situacao, ministerio, cidade e data de cadastro.",
      endpoint: "/api/reports/members",
      columns: reportColumns.members,
      filters: memberFilters
    },
    {
      key: "ministries",
      title: "Lista de ministerios",
      module: "Ministerios",
      description: "Ministerios com filtros por status, lider e dia de reuniao.",
      endpoint: "/api/reports/ministries",
      columns: reportColumns.ministries,
      filters: [
        { name: "status", label: "Status", type: "select", options: [option("Ativo", "ACTIVE"), option("Inativo", "INACTIVE")] },
        { name: "leaderMemberId", label: "Lider", type: "select", options: memberOptions },
        { name: "meetingDay", label: "Dia reuniao", type: "select", options: weekDayOptions }
      ]
    },
    {
      key: "schedules",
      title: "Escalas do periodo",
      module: "Escalas",
      description: "Escalas por periodo, ministerio, status e membro.",
      endpoint: "/api/reports/schedules",
      columns: reportColumns.schedules,
      filters: [
        { name: "startDate", label: "Data inicial", type: "date" },
        { name: "endDate", label: "Data final", type: "date" },
        { name: "ministryId", label: "Ministerio", type: "select", options: ministryOptions },
        { name: "status", label: "Status", type: "select", options: scheduleStatusOptions },
        { name: "memberId", label: "Membro", type: "select", options: memberOptions }
      ]
    },
    {
      key: "events",
      title: "Eventos",
      module: "Eventos",
      description: "Eventos por tipo, status, periodo e ministerio.",
      endpoint: "/api/reports/events",
      columns: reportColumns.events,
      filters: [
        { name: "type", label: "Tipo", type: "select", options: eventTypeOptions },
        { name: "status", label: "Status", type: "select", options: eventStatusOptions },
        { name: "startDate", label: "Data inicial", type: "date" },
        { name: "endDate", label: "Data final", type: "date" },
        { name: "ministryId", label: "Ministerio", type: "select", options: ministryOptions }
      ]
    },
    {
      key: "financial",
      title: "Fluxo financeiro",
      module: "Financeiro",
      description: "Entradas, saidas e fluxo financeiro com filtros por categoria, periodo e origem.",
      endpoint: "/api/reports/financial",
      columns: reportColumns.financial,
      filters: [
        { name: "categoryId", label: "Categoria", type: "select", options: categoryOptions },
        { name: "type", label: "Tipo", type: "select", options: financialTypeOptions },
        { name: "paymentMethod", label: "Forma pagamento", type: "select", options: paymentMethodOptions },
        { name: "startDate", label: "Data inicial", type: "date" },
        { name: "endDate", label: "Data final", type: "date" },
        { name: "ministryId", label: "Ministerio", type: "select", options: ministryOptions },
        { name: "eventId", label: "Evento", type: "select", options: eventOptions },
        { name: "memberId", label: "Membro", type: "select", options: memberOptions }
      ]
    }
  ];

  return Object.values(
    definitions.reduce<Record<string, ReportCatalogGroup>>((groups, definition) => {
      groups[definition.module] ??= { module: definition.module, reports: [] };
      groups[definition.module].reports.push(definition);
      return groups;
    }, {})
  );
}

export const reportService = {
  catalog,

  async members(input: MemberReportInput) {
    const data = await reportRepository.members(input);
    const rows = data.rows.map((member) => ({
      name: member.name,
      cpf: member.cpf ?? "",
      email: member.email ?? "",
      city: [member.city, member.state].filter(Boolean).join(" / "),
      status: member.status,
      ministries: member.memberMinistries.map((item) => item.ministry.name).join(", "),
      createdAt: date(member.createdAt)
    }));

    return result("Lista de membros", reportColumns.members, rows, data.total, input);
  },

  async ministries(input: MinistryReportInput) {
    const data = await reportRepository.ministries(input);
    const rows = data.rows.map((ministry) => ({
      name: ministry.name,
      status: ministry.isActive ? "Ativo" : "Inativo",
      leader: ministry.leaderMember?.name ?? "",
      viceLeader: ministry.viceLeaderMember?.name ?? "",
      meetingDay: ministry.meetingDay ?? "",
      meetingTime: ministry.meetingTime ?? "",
      location: ministry.location ?? ""
    }));

    return result("Lista de ministerios", reportColumns.ministries, rows, data.total, input);
  },

  async schedules(input: ScheduleReportInput) {
    const data = await reportRepository.schedules(input);
    const rows = data.rows.map((schedule) => ({
      title: schedule.title,
      date: date(schedule.date),
      time: timeRange(schedule.startTime, schedule.endTime),
      ministry: schedule.ministry.name,
      status: schedule.status,
      members: schedule.members.map((item) => item.member.name).join(", ")
    }));

    return result("Escalas do periodo", reportColumns.schedules, rows, data.total, input);
  },

  async events(input: EventReportInput) {
    const data = await reportRepository.events(input);
    const rows = data.rows.map((event) => ({
      title: event.title,
      type: event.type,
      status: event.status,
      startDate: date(event.startDate),
      startTime: event.startTime ?? "",
      ministry: event.ministry?.name ?? "",
      location: event.location ?? ""
    }));

    return result("Eventos", reportColumns.events, rows, data.total, input);
  },

  async financial(input: FinancialReportInput) {
    const data = await reportRepository.financial(input);
    const rows = data.rows.map((entry) => ({
      entryNumber: String(entry.entryNumber),
      type: entry.type,
      launchDate: date(entry.launchDate),
      category: entry.category.name,
      amount: money(entry.amount),
      paymentMethod: entry.paymentMethod,
      status: entry.status,
      member: entry.member?.name ?? "",
      ministry: entry.ministry?.name ?? "",
      event: entry.event?.title ?? ""
    }));

    return result("Fluxo financeiro", reportColumns.financial, rows, data.total, input);
  },

  async portalContributions(memberId: string | null | undefined, input: PortalContributionReportInput) {
    if (!memberId) {
      throw new AppError("Seu usuario ainda nao esta vinculado a um membro.", 409, "USER_WITHOUT_MEMBER");
    }

    const rows = (await reportRepository.portalContributions(memberId)).map((entry) => ({
      launchDate: date(entry.launchDate),
      category: entry.category.name,
      amount: money(entry.amount),
      paymentMethod: entry.paymentMethod,
      status: entry.status
    }));

    return createFile("Minhas contribuicoes", input.exportFormat, reportColumns.portalContributions, rows);
  }
};
