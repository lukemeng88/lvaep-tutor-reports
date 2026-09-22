import { roundHours } from "@/lib/hours";

// Session start and end times. Stored as Postgres time columns, handled here
// as "HH:MM" strings in 15 minute steps; hours are always end minus start.

export type SessionTimes = { start_time: string | null; end_time: string | null };

export const TIME_STEP_MINUTES = 15;
export const MAX_SESSION_HOURS = 12;

/** "HH:MM" or "HH:MM:SS" to minutes since midnight, or null when it is not a time. */
export function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Minutes since midnight to "HH:MM". */
export function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

/** A stored time ("10:00:00") as the "HH:MM" the inputs use; null stays null. */
export function toHHMM(value: string | null | undefined): string | null {
  const minutes = parseTime(value);
  return minutes === null ? null : minutesToTime(minutes);
}

/** End minus start in hours, rounded to the nearest quarter, or null when either is missing. */
export function hoursBetween(start: string | null | undefined, end: string | null | undefined): number | null {
  const a = parseTime(start);
  const b = parseTime(end);
  if (a === null || b === null) return null;
  return roundHours((b - a) / 60);
}

/**
 * Why a start and end pair is not acceptable, or null when it is: both must
 * be given, on quarter hours, the end after the start, and no longer than
 * twelve hours.
 */
export function checkTimes(start: string | null | undefined, end: string | null | undefined): string | null {
  const a = parseTime(start);
  const b = parseTime(end);
  if (a === null || b === null) return "Enter a start time and an end time.";
  if (a % TIME_STEP_MINUTES !== 0 || b % TIME_STEP_MINUTES !== 0) return "Times are in 15 minute steps.";
  if (b <= a) return "The end time must be after the start time.";
  if (b - a > MAX_SESSION_HOURS * 60) return `A session cannot be longer than ${MAX_SESSION_HOURS} hours.`;
  return null;
}

/** "10:00 am", "1:30 pm". */
export function formatTime12(value: string | null | undefined): string {
  const minutes = parseTime(value);
  if (minutes === null) return "";
  const h = Math.floor(minutes / 60);
  const m = String(minutes % 60).padStart(2, "0");
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${suffix}`;
}

/** "10:00 am to 11:30 am", or "" when either time is missing. */
export function formatTimeRange(start: string | null | undefined, end: string | null | undefined): string {
  const a = formatTime12(start);
  const b = formatTime12(end);
  return a && b ? `${a} to ${b}` : "";
}

/** "1.5 hours", "1 hour", "0.25 hours". */
export function formatHoursLabel(hours: number): string {
  const rounded = roundHours(hours);
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0$/, "");
  return `${text} ${rounded === 1 ? "hour" : "hours"}`;
}
