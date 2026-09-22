"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTutor } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { commonTimes, scheduleDays } from "@/lib/schedule";
import { calendarYearForMonth, daysInMonth, fiscalYearEnd, fiscalYearMonths, fiscalYearOf, fiscalYearStart, todayISO } from "@/lib/fiscal-year";
import { toGoalStates } from "@/lib/goals";
import { buildSnapshot, defaultMonthToSubmit, validateReport, type MonthStatus, type ReportIssue } from "@/lib/reports";
import type { Json } from "@/lib/supabase/database.types";

const monthsSchema = z.object({
  studentId: z.string().uuid(),
  fiscalYear: z.number().int().min(2000).max(2100).optional(),
});

export type ReportMonthsData = {
  fiscalYear: number;
  fiscalYearOptions: number[];
  months: MonthStatus[];
  defaultMonth: number;
};

export async function getReportMonths(input: z.input<typeof monthsSchema>): Promise<ActionResult<ReportMonthsData>> {
  const user = await requireTutor();
  const parsed = monthsSchema.safeParse(input);
  if (!parsed.success) return fail("That student could not be found.");
  const today = todayISO();
  const currentFy = fiscalYearOf(today);
  const fiscalYear = parsed.data.fiscalYear ?? currentFy;
  const { studentId } = parsed.data;

  const supabase = await createClient();
  const [sessionsRes, reportsRes] = await Promise.all([
    supabase
      .from("sessions")
      .select("session_date, hours, code")
      .eq("student_id", studentId)
      .eq("tutor_id", user.id)
      .gte("session_date", fiscalYearStart(fiscalYear))
      .lte("session_date", fiscalYearEnd(fiscalYear)),
    supabase
      .from("monthly_reports")
      .select("month, version, submitted_at")
      .eq("student_id", studentId)
      .eq("tutor_id", user.id)
      .eq("fiscal_year", fiscalYear),
  ]);
  if (sessionsRes.error || reportsRes.error) return fail("We could not load the report months. Please try again.");

  const months: MonthStatus[] = fiscalYearMonths(fiscalYear).map(({ month, year }) => {
    const prefix = `${year}-${String(month).padStart(2, "0")}-`;
    const sessionCount = sessionsRes.data.filter(
      (s) => s.session_date.startsWith(prefix) && (s.code !== null || Number(s.hours) > 0),
    ).length;
    const versions = reportsRes.data.filter((r) => r.month === month);
    const latest = versions.reduce<{ version: number; submitted_at: string } | null>(
      (best, r) => (best === null || r.version > best.version ? r : best),
      null,
    );
    return {
      month,
      year,
      sessionCount,
      latestVersion: latest?.version ?? null,
      lastSubmittedAt: latest?.submitted_at ?? null,
    };
  });

  return ok({
    fiscalYear,
    fiscalYearOptions: [currentFy, currentFy - 1].filter((fy) => fy !== fiscalYear).concat(fiscalYear).sort((a, b) => b - a),
    months,
    defaultMonth: defaultMonthToSubmit(months, today),
  });
}

const submitSchema = z.object({
  studentId: z.string().uuid(),
  fiscalYear: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});

export type SubmitReportInput = z.input<typeof submitSchema>;

type Loaded = {
  student: {
    id: string;
    full_name: string;
    tutoring_site: string;
    is_stopped: boolean;
    stopped_reason: string | null;
  };
  tutorName: string;
  monthSessions: { session_date: string; hours: number; code: "TA" | "SA" | "H" | null; start_time: string | null; end_time: string | null }[];
  /** The form's Day(s) and Time(s): active schedules, and the year's most common times. */
  days: string | null;
  times: string | null;
};

async function loadForReport(tutorId: string, tutorName: string, studentId: string, fiscalYear: number, month: number): Promise<Loaded | null> {
  const supabase = await createClient();
  const year = calendarYearForMonth(fiscalYear, month);
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const from = `${prefix}-01`;
  const to = `${prefix}-${String(daysInMonth(year, month)).padStart(2, "0")}`;
  const [studentRes, sessionsRes, yearSessionsRes, rulesRes] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name, tutoring_site, is_stopped, stopped_reason")
      .eq("id", studentId)
      .eq("tutor_id", tutorId)
      .maybeSingle(),
    supabase
      .from("sessions")
      .select("session_date, hours, code, start_time, end_time")
      .eq("student_id", studentId)
      .eq("tutor_id", tutorId)
      .gte("session_date", from)
      .lte("session_date", to),
    supabase
      .from("sessions")
      .select("start_time, end_time")
      .eq("student_id", studentId)
      .eq("tutor_id", tutorId)
      .gte("session_date", fiscalYearStart(fiscalYear))
      .lte("session_date", fiscalYearEnd(fiscalYear)),
    supabase.from("recurrence_rules").select("weekday, start_date, end_date").eq("student_id", studentId),
  ]);
  if (studentRes.error || sessionsRes.error || yearSessionsRes.error || rulesRes.error || !studentRes.data) return null;
  return {
    student: studentRes.data,
    tutorName,
    monthSessions: sessionsRes.data.map((s) => ({ ...s, hours: Number(s.hours) })),
    days: scheduleDays(rulesRes.data, todayISO()),
    times: commonTimes(yearSessionsRes.data),
  };
}

export async function validateReportMonth(input: SubmitReportInput): Promise<ActionResult<{ issues: ReportIssue[]; totalHours: number; sessionCount: number }>> {
  const user = await requireTutor();
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return fail("Choose a month to submit.");
  const loaded = await loadForReport(user.id, user.profile.full_name, parsed.data.studentId, parsed.data.fiscalYear, parsed.data.month);
  if (!loaded) return fail("That student could not be found.");
  const issues = validateReport({
    studentId: loaded.student.id,
    studentName: loaded.student.full_name,
    tutoringSite: loaded.student.tutoring_site,
    tutorName: loaded.tutorName,
    isStopped: loaded.student.is_stopped,
    stoppedReason: loaded.student.stopped_reason,
    monthSessions: loaded.monthSessions,
  });
  const counted = loaded.monthSessions.filter((s) => s.code !== null || s.hours > 0);
  const totalHours = counted.reduce((sum, s) => sum + (s.code ? 0 : s.hours), 0);
  return ok({ issues, totalHours: Math.round(totalHours * 4) / 4, sessionCount: counted.length });
}

export async function submitReport(input: SubmitReportInput): Promise<ActionResult<{ version: number }>> {
  const user = await requireTutor();
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return fail("Choose a month to submit.");
  const { studentId, fiscalYear, month } = parsed.data;

  const loaded = await loadForReport(user.id, user.profile.full_name, studentId, fiscalYear, month);
  if (!loaded) return fail("That student could not be found.");

  // Validate again on the server so a stale dialog cannot submit an incomplete month.
  const issues = validateReport({
    studentId: loaded.student.id,
    studentName: loaded.student.full_name,
    tutoringSite: loaded.student.tutoring_site,
    tutorName: loaded.tutorName,
    isStopped: loaded.student.is_stopped,
    stoppedReason: loaded.student.stopped_reason,
    monthSessions: loaded.monthSessions,
  });
  if (issues.length > 0) return fail(issues[0].message);

  const supabase = await createClient();
  const [definitionsRes, achievementsRes, latestRes] = await Promise.all([
    supabase.from("goal_definitions").select("*").order("category").order("number"),
    supabase.from("goal_achievements").select("goal_id, attained, attained_on, other_text").eq("student_id", studentId),
    supabase
      .from("monthly_reports")
      .select("version")
      .eq("student_id", studentId)
      .eq("fiscal_year", fiscalYear)
      .eq("month", month)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (definitionsRes.error || achievementsRes.error || latestRes.error) {
    return fail("We could not prepare the report. Please try again.");
  }

  const snapshot = buildSnapshot({
    tutorName: loaded.tutorName,
    student: loaded.student,
    days: loaded.days,
    times: loaded.times,
    fiscalYear,
    month,
    sessions: loaded.monthSessions,
    goals: toGoalStates(definitionsRes.data, achievementsRes.data),
  });

  // Retry once if another submission landed between reading and writing.
  let version = (latestRes.data?.version ?? 0) + 1;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { error } = await supabase.from("monthly_reports").insert({
      student_id: studentId,
      tutor_id: user.id,
      fiscal_year: fiscalYear,
      month,
      version,
      snapshot: snapshot as unknown as Json,
    });
    if (!error) {
      revalidatePath("/home");
      revalidatePath(`/students/${studentId}`);
      revalidatePath("/staff");
      revalidatePath(`/staff/students/${studentId}`);
      return ok({ version });
    }
    if (error.code !== "23505") return fail("We could not submit the report. Please try again.");
    version += 1;
  }
  return fail("We could not submit the report. Please try again.");
}
