import { fiscalYearEnd, fiscalYearOf, parseISODate, toISODate } from "@/lib/fiscal-year";

/** JavaScript weekday (0 = Sunday) for a YYYY-MM-DD date. */
export function weekdayOf(iso: string): number {
  return parseISODate(iso).getDay();
}

/**
 * Every date on the same weekday as `startDate`, from `startDate` through
 * `endDate` inclusive. Defaults to the end of the fiscal year that contains
 * the start date.
 */
export function weeklyDates(startDate: string, endDate?: string): string[] {
  const end = endDate ?? fiscalYearEnd(fiscalYearOf(startDate));
  const dates: string[] = [];
  const cursor = parseISODate(startDate);
  const last = parseISODate(end);
  while (cursor <= last) {
    dates.push(toISODate(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  return dates;
}

export type RecurrencePlan = {
  weekday: number;
  startDate: string;
  endDate: string;
  /** Dates that will get a new session row. */
  dates: string[];
  /** Dates skipped because a session already exists. */
  skipped: string[];
};

/**
 * Plans a weekly recurrence: which sessions to create for a student from a
 * start date through the end of its fiscal year, skipping days that already
 * have a session.
 */
export function planWeeklyRecurrence(startDate: string, existingDates: Iterable<string>): RecurrencePlan {
  const existing = new Set(existingDates);
  const endDate = fiscalYearEnd(fiscalYearOf(startDate));
  const all = weeklyDates(startDate, endDate);
  return {
    weekday: weekdayOf(startDate),
    startDate,
    endDate,
    dates: all.filter((d) => !existing.has(d)),
    skipped: all.filter((d) => existing.has(d)),
  };
}
