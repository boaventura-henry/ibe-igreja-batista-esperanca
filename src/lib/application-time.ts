export const APPLICATION_TIME_ZONE = "America/Sao_Paulo";

type CalendarDate = { year: number; month: number; day: number };
type CalendarDateTime = CalendarDate & { hour: number; minute: number; second: number };

function calendarParts(value: Date, timeZone: string): CalendarDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return { year: read("year"), month: read("month"), day: read("day") };
}

export function applicationToday(now = new Date()) {
  return calendarParts(now, APPLICATION_TIME_ZONE);
}

export function applicationDateOnlyCutoff(now = new Date()) {
  const today = applicationToday(now);
  return new Date(Date.UTC(today.year, today.month - 1, today.day));
}

export function applicationDayStart(now = new Date()) {
  const today = applicationToday(now);
  const desired = Date.UTC(today.year, today.month - 1, today.day);
  let candidate = desired;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: APPLICATION_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date(candidate));
    const read = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value);
    const actual: CalendarDateTime = {
      year: read("year"),
      month: read("month"),
      day: read("day"),
      hour: read("hour"),
      minute: read("minute"),
      second: read("second")
    };
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second
    );
    candidate += desired - actualAsUtc;
  }

  return new Date(candidate);
}
