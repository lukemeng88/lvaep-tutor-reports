import { fiscalYearOf } from "@/lib/fiscal-year";
import type { SessionCode } from "@/lib/supabase/database.types";

// A minimal session shape shared by the tutor and staff views.
export type HoursSession = {
  session_date: string;
  hours: number;
  code: SessionCode | null;
};

// Absence and holiday codes always count as zero hours.
export function sessionHours(session: HoursSession): number {
  if (session.code) return 0;
  return Number(session.hours) || 0;
}

export function sumHours(sessions: HoursSession[]): number {
  return roundHours(sessions.reduce((total, s) => total + sessionHours(s), 0));
}

// Avoid floating point noise like 4.499999 when summing quarter hours.
export function roundHours(value: number): number {
  return Math.round(value * 4) / 4;
}

export function formatHours(value: number): string {
  const rounded = roundHours(value);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0$/, "");
}

export function isInMonth(iso: string, year: number, month: number): boolean {
  const [y, m] = iso.split("-").map(Number);
  return y === year && m === month;
}

export function isInFiscalYear(iso: string, fiscalYear: number): boolean {
  return fiscalYearOf(iso) === fiscalYear;
}

/** Sessions dated on or before `today` (YYYY-MM-DD). Planned future days do not count yet. */
export function upToToday<T extends HoursSession>(sessions: T[], today: string): T[] {
  return sessions.filter((s) => s.session_date <= today);
}
