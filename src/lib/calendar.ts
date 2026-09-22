import { daysInMonth, toISODate } from "@/lib/fiscal-year";

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const WEEKDAY_LONG = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
] as const;

export type CalendarCell = { iso: string; day: number } | null;

/** Rows of 7 cells for a month grid, Sunday first, with blanks outside the month. */
export function monthGrid(year: number, month: number): CalendarCell[][] {
  const first = new Date(year, month - 1, 1);
  const lead = first.getDay();
  const count = daysInMonth(year, month);
  const cells: CalendarCell[] = [];
  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (let day = 1; day <= count; day += 1) {
    cells.push({ iso: toISODate(new Date(year, month - 1, day)), day });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}
