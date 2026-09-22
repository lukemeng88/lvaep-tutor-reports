import "server-only";

import { createClient } from "@/lib/supabase/server";
import { fiscalYearEnd, fiscalYearMonths, fiscalYearOf, fiscalYearStart, todayISO } from "@/lib/fiscal-year";
import { roundHours, sumHours, upToToday } from "@/lib/hours";

export type MonthColumn = { month: number; year: number };

export type StudentHoursRow = {
  studentId: string;
  name: string;
  isStopped: boolean;
  byMonth: number[]; // 12 entries in fiscal month order
  total: number;
};

export type HoursPageData = {
  today: string;
  fiscalYear: number;
  currentFiscalYear: number;
  fiscalYearOptions: number[];
  months: MonthColumn[];
  perMonth: number[]; // total hours per month, fiscal order
  running: number[]; // running total per month, fiscal order
  rows: StudentHoursRow[];
  total: number;
};

export async function getTutorHoursData(tutorId: string, requestedFiscalYear?: number): Promise<HoursPageData> {
  const supabase = await createClient();
  const today = todayISO();
  const currentFiscalYear = fiscalYearOf(today);
  const fiscalYear = requestedFiscalYear ?? currentFiscalYear;
  const months = fiscalYearMonths(fiscalYear);

  const [studentsRes, sessionsRes, earliestRes] = await Promise.all([
    supabase.from("students").select("id, full_name, is_stopped").eq("tutor_id", tutorId).order("full_name"),
    supabase
      .from("sessions")
      .select("student_id, session_date, hours, code")
      .eq("tutor_id", tutorId)
      .gte("session_date", fiscalYearStart(fiscalYear))
      .lte("session_date", fiscalYearEnd(fiscalYear)),
    supabase
      .from("sessions")
      .select("session_date")
      .eq("tutor_id", tutorId)
      .order("session_date")
      .limit(1)
      .maybeSingle(),
  ]);
  if (studentsRes.error) throw new Error(studentsRes.error.message);
  if (sessionsRes.error) throw new Error(sessionsRes.error.message);
  if (earliestRes.error) throw new Error(earliestRes.error.message);

  const sessions = upToToday(sessionsRes.data, today);
  const monthIndex = new Map(months.map((m, i) => [`${m.year}-${String(m.month).padStart(2, "0")}`, i]));

  const rows: StudentHoursRow[] = studentsRes.data.map((student) => {
    const byMonth = new Array<number>(12).fill(0);
    for (const s of sessions) {
      if (s.student_id !== student.id) continue;
      const idx = monthIndex.get(s.session_date.slice(0, 7));
      if (idx === undefined) continue;
      byMonth[idx] = roundHours(byMonth[idx] + sumHours([s]));
    }
    return {
      studentId: student.id,
      name: student.full_name,
      isStopped: student.is_stopped,
      byMonth,
      total: roundHours(byMonth.reduce((a, b) => a + b, 0)),
    };
  });

  const perMonth = months.map((_, i) => roundHours(rows.reduce((sum, r) => sum + r.byMonth[i], 0)));
  const running: number[] = [];
  perMonth.reduce((acc, v) => {
    const next = roundHours(acc + v);
    running.push(next);
    return next;
  }, 0);

  const earliestFiscalYear = earliestRes.data ? fiscalYearOf(earliestRes.data.session_date) : currentFiscalYear;
  const fiscalYearOptions: number[] = [];
  for (let fy = Math.max(currentFiscalYear, fiscalYear); fy >= Math.min(earliestFiscalYear, fiscalYear, currentFiscalYear - 1); fy -= 1) {
    fiscalYearOptions.push(fy);
  }

  return {
    today,
    fiscalYear,
    currentFiscalYear,
    fiscalYearOptions,
    months,
    perMonth,
    running,
    rows,
    total: roundHours(perMonth.reduce((a, b) => a + b, 0)),
  };
}
