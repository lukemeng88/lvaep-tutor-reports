import "server-only";

import { createClient } from "@/lib/supabase/server";
import { fiscalYearOf, todayISO } from "@/lib/fiscal-year";
import { isInFiscalYear, isInMonth, sumHours, upToToday } from "@/lib/hours";
import type { Student } from "@/lib/supabase/database.types";

export type StudentWithStats = Student & {
  hoursThisMonth: number;
  hoursThisFiscalYear: number;
  goalsAttained: number;
  nextSessionDate: string | null;
};

export type TutorTotals = {
  thisMonth: number;
  thisFiscalYear: number;
  allTime: number;
};

export type TutorHomeData = {
  today: string;
  fiscalYear: number;
  active: StudentWithStats[];
  stopped: StudentWithStats[];
  totals: TutorTotals;
};

export async function getTutorHomeData(tutorId: string): Promise<TutorHomeData> {
  const supabase = await createClient();
  const today = todayISO();
  const fiscalYear = fiscalYearOf(today);
  const [year, month] = today.split("-").map(Number);

  const [studentsRes, sessionsRes, goalsRes] = await Promise.all([
    supabase.from("students").select("*").eq("tutor_id", tutorId).order("full_name"),
    supabase
      .from("sessions")
      .select("student_id, session_date, hours, code")
      .eq("tutor_id", tutorId),
    supabase
      .from("goal_achievements")
      .select("student_id")
      .eq("tutor_id", tutorId)
      .eq("attained", true),
  ]);

  if (studentsRes.error) throw new Error(studentsRes.error.message);
  if (sessionsRes.error) throw new Error(sessionsRes.error.message);
  if (goalsRes.error) throw new Error(goalsRes.error.message);

  const sessions = sessionsRes.data;
  const pastSessions = upToToday(sessions, today);
  const goalsByStudent = new Map<string, number>();
  for (const g of goalsRes.data) {
    goalsByStudent.set(g.student_id, (goalsByStudent.get(g.student_id) ?? 0) + 1);
  }

  const withStats: StudentWithStats[] = studentsRes.data.map((student) => {
    const mine = pastSessions.filter((s) => s.student_id === student.id);
    const upcoming = sessions
      .filter((s) => s.student_id === student.id && s.session_date >= today && !s.code)
      .map((s) => s.session_date)
      .sort();
    return {
      ...student,
      hoursThisMonth: sumHours(mine.filter((s) => isInMonth(s.session_date, year, month))),
      hoursThisFiscalYear: sumHours(mine.filter((s) => isInFiscalYear(s.session_date, fiscalYear))),
      goalsAttained: goalsByStudent.get(student.id) ?? 0,
      nextSessionDate: upcoming[0] ?? null,
    };
  });

  return {
    today,
    fiscalYear,
    active: withStats.filter((s) => !s.is_stopped),
    stopped: withStats.filter((s) => s.is_stopped),
    totals: {
      thisMonth: sumHours(pastSessions.filter((s) => isInMonth(s.session_date, year, month))),
      thisFiscalYear: sumHours(pastSessions.filter((s) => isInFiscalYear(s.session_date, fiscalYear))),
      allTime: sumHours(pastSessions),
    },
  };
}

export async function getStudentForTutor(tutorId: string, studentId: string): Promise<Student | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("tutor_id", tutorId)
    .eq("id", studentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
