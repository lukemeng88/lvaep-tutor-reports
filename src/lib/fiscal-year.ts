// Fiscal year helpers. The fiscal year runs July 1 through June 30 and is
// named after the calendar year in which it starts. This mirrors the
// fiscal_year_of() SQL function in supabase/migrations.

export const FISCAL_YEAR_START_MONTH = 7; // July

// Month numbers 1-12 in fiscal year order: Jul, Aug, ..., Jun.
export const FISCAL_MONTH_ORDER: number[] = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];

export const MONTH_SHORT_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

export const MONTH_LONG_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/** Parse a YYYY-MM-DD string into a local Date. */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Format a Date as YYYY-MM-DD using local date parts. */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Today's date as YYYY-MM-DD in the local time zone. */
export function todayISO(): string {
  return toISODate(new Date());
}

/** Fiscal year for a date (Date or YYYY-MM-DD string). */
export function fiscalYearOf(input: Date | string): number {
  const date = typeof input === "string" ? parseISODate(input) : input;
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return month >= FISCAL_YEAR_START_MONTH ? year : year - 1;
}

/** Fiscal year for a calendar year and month number (1-12). */
export function fiscalYearOfMonth(year: number, month: number): number {
  return month >= FISCAL_YEAR_START_MONTH ? year : year - 1;
}

/** First day of a fiscal year as YYYY-MM-DD. */
export function fiscalYearStart(fiscalYear: number): string {
  return `${fiscalYear}-07-01`;
}

/** Last day of a fiscal year as YYYY-MM-DD. */
export function fiscalYearEnd(fiscalYear: number): string {
  return `${fiscalYear + 1}-06-30`;
}

/** "2026-2027" style label. */
export function fiscalYearLabel(fiscalYear: number): string {
  return `${fiscalYear}-${fiscalYear + 1}`;
}

/** Calendar year that a given month falls in for a fiscal year. */
export function calendarYearForMonth(fiscalYear: number, month: number): number {
  return month >= FISCAL_YEAR_START_MONTH ? fiscalYear : fiscalYear + 1;
}

/** Every month of a fiscal year in order, with its calendar year. */
export function fiscalYearMonths(fiscalYear: number): { month: number; year: number }[] {
  return FISCAL_MONTH_ORDER.map((month) => ({
    month,
    year: calendarYearForMonth(fiscalYear, month),
  }));
}

/** Number of days in a month (month is 1-12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** "August 2026" style label for a month in a fiscal year. */
export function monthLabel(fiscalYear: number, month: number): string {
  return `${MONTH_LONG_NAMES[month - 1]} ${calendarYearForMonth(fiscalYear, month)}`;
}
