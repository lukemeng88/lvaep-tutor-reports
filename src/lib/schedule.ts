import { parseTime, formatTimeRange, type SessionTimes } from "@/lib/times";

// What the paper form's Day(s) and Time(s) boxes say, derived from the data
// rather than typed: the weekdays of the student's active weekly schedules,
// and the start and end most of their sessions share.

const WEEKDAY_ABBREVIATION = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** Monday first, the way the form reads. */
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export type ScheduleRule = { weekday: number; start_date: string; end_date: string | null };

/**
 * "Mon, Wed" from the schedules still running on `today`: those that have
 * started and have not ended. Null when there are none.
 */
export function scheduleDays(rules: ScheduleRule[], today: string): string | null {
  const active = new Set<number>();
  for (const rule of rules) {
    if (rule.start_date > today) continue;
    if (rule.end_date !== null && rule.end_date < today) continue;
    active.add(rule.weekday);
  }
  const names = WEEKDAY_ORDER.filter((d) => active.has(d)).map((d) => WEEKDAY_ABBREVIATION[d]);
  return names.length ? names.join(", ") : null;
}

/**
 * "10:00 am to 11:30 am": the start and end pair most sessions share. Ties
 * go to the earlier start. Null when no session has times.
 */
export function commonTimes(sessions: SessionTimes[]): string | null {
  const counts = new Map<string, { start: string; end: string; count: number }>();
  for (const s of sessions) {
    if (parseTime(s.start_time) === null || parseTime(s.end_time) === null) continue;
    const key = `${s.start_time}|${s.end_time}`;
    const entry = counts.get(key) ?? { start: s.start_time as string, end: s.end_time as string, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }
  let best: { start: string; end: string; count: number } | null = null;
  for (const entry of counts.values()) {
    if (
      !best ||
      entry.count > best.count ||
      (entry.count === best.count && (parseTime(entry.start) ?? 0) < (parseTime(best.start) ?? 0))
    ) {
      best = entry;
    }
  }
  return best ? formatTimeRange(best.start, best.end) : null;
}
