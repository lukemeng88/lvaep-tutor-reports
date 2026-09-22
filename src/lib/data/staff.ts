import "server-only";

import { createClient } from "@/lib/supabase/server";
import { fiscalYearEnd, fiscalYearOf, fiscalYearStart, todayISO, daysInMonth } from "@/lib/fiscal-year";
import { parseSnapshot, type ReportSnapshot } from "@/lib/reports";
import type { GoalAchievement, GoalDefinition, Profile, Student } from "@/lib/supabase/database.types";
import type { HoursSession } from "@/lib/hours";

export type StaffStudent = Pick<
  Student,
  "id" | "tutor_id" | "full_name" | "tutoring_site" | "is_stopped" | "stopped_reason" | "stopped_at"
> & { lastSubmittedAt: string | null };

export type StaffTutor = {
  id: string;
  fullName: string;
  activeCount: number;
  stoppedCount: number;
};

export type MissingReport = {
  tutorId: string;
  tutorName: string;
  students: { id: string; name: string }[];
};

export type StaffHomeData = {
  today: string;
  tutors: StaffTutor[];
  students: StaffStudent[];
  submittedThisMonth: number;
  lastMonth: { month: number; year: number };
  missing: MissingReport[];
};

export async function getStaffHomeData(): Promise<StaffHomeData> {
  const supabase = await createClient();
  const today = todayISO();
  const [year, month] = today.split("-").map(Number);
  const thisMonthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastMonth = month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year };
  const lastMonthPrefix = `${lastMonth.year}-${String(lastMonth.month).padStart(2, "0")}`;
  const lastMonthStart = `${lastMonthPrefix}-01`;
  const lastMonthEnd = `${lastMonthPrefix}-${String(daysInMonth(lastMonth.year, lastMonth.month)).padStart(2, "0")}`;
  const lastMonthFy = fiscalYearOf(lastMonthStart);

  const [tutorsRes, studentsRes, reportsRes, lastMonthReportsRes, lastMonthSessionsRes] = await Promise.all([
    supabase.from("profiles").select("id, full_name").eq("role", "tutor").order("full_name"),
    supabase
      .from("students")
      .select("id, tutor_id, full_name, tutoring_site, is_stopped, stopped_reason, stopped_at")
      .order("full_name"),
    supabase
      .from("monthly_reports")
      .select("student_id, submitted_at")
      .gte("submitted_at", `${thisMonthStart}T00:00:00`),
    supabase
      .from("monthly_reports")
      .select("student_id")
      .eq("fiscal_year", lastMonthFy)
      .eq("month", lastMonth.month),
    supabase
      .from("sessions")
      .select("student_id")
      .gte("session_date", lastMonthStart)
      .lte("session_date", lastMonthEnd),
  ]);
  for (const r of [tutorsRes, studentsRes, reportsRes, lastMonthReportsRes, lastMonthSessionsRes]) {
    if (r.error) throw new Error(r.error.message);
  }

  const latestRes = await supabase
    .from("monthly_reports")
    .select("student_id, submitted_at")
    .order("submitted_at", { ascending: false });
  if (latestRes.error) throw new Error(latestRes.error.message);
  const lastSubmitted = new Map<string, string>();
  for (const r of latestRes.data) {
    if (!lastSubmitted.has(r.student_id)) lastSubmitted.set(r.student_id, r.submitted_at);
  }

  const students: StaffStudent[] = (studentsRes.data ?? []).map((s) => ({
    ...s,
    lastSubmittedAt: lastSubmitted.get(s.id) ?? null,
  }));

  const tutors: StaffTutor[] = (tutorsRes.data ?? []).map((t) => ({
    id: t.id,
    fullName: t.full_name,
    activeCount: students.filter((s) => s.tutor_id === t.id && !s.is_stopped).length,
    stoppedCount: students.filter((s) => s.tutor_id === t.id && s.is_stopped).length,
  }));

  const submittedLastMonth = new Set((lastMonthReportsRes.data ?? []).map((r) => r.student_id));
  const withSessionsLastMonth = new Set((lastMonthSessionsRes.data ?? []).map((s) => s.student_id));
  const missing: MissingReport[] = tutors
    .map((t) => ({
      tutorId: t.id,
      tutorName: t.fullName,
      students: students
        .filter(
          (s) => s.tutor_id === t.id && !s.is_stopped && withSessionsLastMonth.has(s.id) && !submittedLastMonth.has(s.id),
        )
        .map((s) => ({ id: s.id, name: s.full_name })),
    }))
    .filter((m) => m.students.length > 0);

  return {
    today,
    tutors,
    students,
    submittedThisMonth: reportsRes.data?.length ?? 0,
    lastMonth,
    missing,
  };
}

export type StaffReport = {
  id: string;
  month: number;
  version: number;
  submitted_at: string;
  snapshot: ReportSnapshot;
};

export type StaffStudentRecord = {
  today: string;
  student: Student;
  tutor: Pick<Profile, "id" | "full_name">;
  fiscalYear: number;
  fiscalYearOptions: number[];
  reports: StaffReport[];
  liveSessions: HoursSession[];
  liveGoals: Pick<GoalAchievement, "goal_id" | "attained" | "attained_on" | "other_text">[];
  definitions: GoalDefinition[];
};

export async function getStaffStudentRecord(studentId: string, requestedFiscalYear?: number): Promise<StaffStudentRecord | null> {
  const supabase = await createClient();
  const today = todayISO();
  const currentFy = fiscalYearOf(today);
  const fiscalYear = requestedFiscalYear ?? currentFy;

  const { data: student, error: studentError } = await supabase.from("students").select("*").eq("id", studentId).maybeSingle();
  if (studentError) throw new Error(studentError.message);
  if (!student) return null;

  const [tutorRes, reportsRes, allReportsRes, sessionsRes, goalsRes, definitionsRes, earliestRes] = await Promise.all([
    supabase.from("profiles").select("id, full_name").eq("id", student.tutor_id).maybeSingle(),
    supabase
      .from("monthly_reports")
      .select("id, month, version, submitted_at, snapshot")
      .eq("student_id", studentId)
      .eq("fiscal_year", fiscalYear)
      .order("month")
      .order("version"),
    supabase.from("monthly_reports").select("fiscal_year").eq("student_id", studentId),
    supabase
      .from("sessions")
      .select("session_date, hours, code")
      .eq("student_id", studentId)
      .gte("session_date", fiscalYearStart(fiscalYear))
      .lte("session_date", fiscalYearEnd(fiscalYear)),
    supabase.from("goal_achievements").select("goal_id, attained, attained_on, other_text").eq("student_id", studentId),
    supabase.from("goal_definitions").select("*").order("category").order("number"),
    supabase.from("sessions").select("session_date").eq("student_id", studentId).order("session_date").limit(1).maybeSingle(),
  ]);
  for (const r of [tutorRes, reportsRes, allReportsRes, sessionsRes, goalsRes, definitionsRes, earliestRes]) {
    if (r.error) throw new Error(r.error.message);
  }

  const years = new Set<number>([currentFy, fiscalYear]);
  for (const r of allReportsRes.data ?? []) years.add(r.fiscal_year);
  if (earliestRes.data) years.add(fiscalYearOf(earliestRes.data.session_date));

  return {
    today,
    student,
    tutor: tutorRes.data ?? { id: student.tutor_id, full_name: "Unknown tutor" },
    fiscalYear,
    fiscalYearOptions: [...years].sort((a, b) => b - a),
    reports: (reportsRes.data ?? []).flatMap((r) => {
      const snapshot = parseSnapshot(r.snapshot);
      return snapshot ? [{ id: r.id, month: r.month, version: r.version, submitted_at: r.submitted_at, snapshot }] : [];
    }),
    liveSessions: (sessionsRes.data ?? []).map((s) => ({ ...s, hours: Number(s.hours) })),
    liveGoals: goalsRes.data ?? [],
    definitions: definitionsRes.data ?? [],
  };
}
