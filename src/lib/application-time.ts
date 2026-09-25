export const APPLICATION_TIME_ZONE = "America/Sao_Paulo";

type CalendarDate = { year: number; month: number; day: number };

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

export function applicationDateInputValue(now = new Date()) {
  const today = applicationToday(now);
  return `${today.year}-${String(today.month).padStart(2, "0")}-${String(today.day).padStart(2, "0")}`;
}

export function applicationDateOnlyCutoff(now = new Date()) {
  const today = applicationToday(now);
  return new Date(Date.UTC(today.year, today.month - 1, today.day));
}

function calendarDateStart(date: CalendarDate) {
  const desired = Date.UTC(date.year, date.month - 1, date.day);
  const searchWindow = 2 * 24 * 60 * 60 * 1000;
  let lower = desired - searchWindow;
  let upper = desired + searchWindow;

  while (lower < upper) {
    const candidate = lower + Math.floor((upper - lower) / 2);
    const actual = calendarParts(new Date(candidate), APPLICATION_TIME_ZONE);
    const actualDate = Date.UTC(actual.year, actual.month - 1, actual.day);

    if (actualDate < desired) lower = candidate + 1;
    else upper = candidate;
  }

  return new Date(lower);
}

function normalizedCalendarDate(year: number, monthIndex: number, day: number): CalendarDate {
  const normalized = new Date(Date.UTC(year, monthIndex, day));
  return {
    year: normalized.getUTCFullYear(),
    month: normalized.getUTCMonth() + 1,
    day: normalized.getUTCDate()
  };
}

export function applicationDayStart(now = new Date()) {
  return calendarDateStart(applicationToday(now));
}

export function applicationDayRange(now = new Date()) {
  const today = applicationToday(now);
  return {
    start: calendarDateStart(today),
    end: calendarDateStart(normalizedCalendarDate(today.year, today.month - 1, today.day + 1))
  };
}

export function applicationMonthRange(now = new Date()) {
  const today = applicationToday(now);
  return {
    start: calendarDateStart({ year: today.year, month: today.month, day: 1 }),
    end: calendarDateStart(normalizedCalendarDate(today.year, today.month, 1))
  };
}
