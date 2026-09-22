import type { GoalState } from "@/lib/goals";
import { calendarYearForMonth, fiscalYearOf } from "@/lib/fiscal-year";
import { sumHours, type HoursSession } from "@/lib/hours";
import type { SessionCode } from "@/lib/supabase/database.types";

// Snapshot stored in monthly_reports.snapshot. Staff views are built from it,
// so it must carry everything the paper form shows.
export type SnapshotSession = { date: string; hours: number; code: SessionCode | null };

export type ReportSnapshot = {
  tutor_name: string;
  student_name: string;
  tutoring_site: string;
  default_days: string | null;
  default_times: string | null;
  fiscal_year: number;
  month: number;
  sessions: SnapshotSession[];
  total_hours: number;
  is_stopped: boolean;
  stopped_reason: string | null;
  goals: GoalState[];
};

export type ReportIssue = {
  message: string;
  /** Where to fix it, relative to the app. */
  href: string;
  /** Short label for the link. */
  linkLabel: string;
};

export type ReportValidationInput = {
  studentId: string;
  studentName: string;
  tutoringSite: string;
  tutorName: string;
  isStopped: boolean;
  stoppedReason: string | null;
  /** Sessions that fall inside the month being submitted. */
  monthSessions: HoursSession[];
};

export function validateReport(input: ReportValidationInput): ReportIssue[] {
  const issues: ReportIssue[] = [];
  const studentPage = `/students/${input.studentId}`;

  if (!input.studentName.trim()) {
    issues.push({ message: "The student's full name is missing.", href: studentPage, linkLabel: "Edit student" });
  }
  if (!input.tutoringSite.trim()) {
    issues.push({ message: "The tutoring site is missing.", href: studentPage, linkLabel: "Edit student" });
  }
  if (!input.tutorName.trim()) {
    issues.push({ message: "Your full name is missing from your profile.", href: "/home", linkLabel: "Go to Home" });
  }
  const counted = input.monthSessions.filter((s) => s.code !== null || Number(s.hours) > 0);
  if (counted.length === 0) {
    issues.push({
      message: "There are no tutoring days in this month. Add at least one day with hours or an absence or holiday code.",
      href: studentPage,
      linkLabel: "Open calendar",
    });
  }
  if (input.isStopped && !(input.stoppedReason ?? "").trim()) {
    issues.push({
      message: "The student is marked as stopped but no reason is recorded.",
      href: studentPage,
      linkLabel: "Add a reason",
    });
  }
  return issues;
}

export type SnapshotInput = {
  tutorName: string;
  student: {
    full_name: string;
    tutoring_site: string;
    default_days: string | null;
    default_times: string | null;
    is_stopped: boolean;
    stopped_reason: string | null;
  };
  fiscalYear: number;
  month: number;
  sessions: HoursSession[];
  goals: GoalState[];
};

/** Keeps only the sessions inside the report month and computes the total. */
export function buildSnapshot(input: SnapshotInput): ReportSnapshot {
  const year = calendarYearForMonth(input.fiscalYear, input.month);
  const prefix = `${year}-${String(input.month).padStart(2, "0")}-`;
  const monthSessions = input.sessions
    .filter((s) => s.session_date.startsWith(prefix))
    .sort((a, b) => a.session_date.localeCompare(b.session_date));
  return {
    tutor_name: input.tutorName,
    student_name: input.student.full_name,
    tutoring_site: input.student.tutoring_site,
    default_days: input.student.default_days,
    default_times: input.student.default_times,
    fiscal_year: input.fiscalYear,
    month: input.month,
    sessions: monthSessions.map((s) => ({
      date: s.session_date,
      hours: s.code ? 0 : Number(s.hours),
      code: s.code,
    })),
    total_hours: sumHours(monthSessions),
    is_stopped: input.student.is_stopped,
    stopped_reason: input.student.stopped_reason,
    goals: input.goals,
  };
}

export type MonthStatus = {
  month: number;
  year: number;
  sessionCount: number;
  latestVersion: number | null;
  lastSubmittedAt: string | null;
};

/**
 * The month a tutor most likely wants to submit: the most recent month, up to
 * the current one, that has sessions but no submission. Falls back to the
 * current month when it is in this fiscal year, else the last month listed.
 */
export function defaultMonthToSubmit(months: MonthStatus[], today: string): number {
  const todayFy = fiscalYearOf(today);
  const [todayYear, todayMonth] = today.split("-").map(Number);
  const eligible = months.filter((m) => m.year < todayYear || (m.year === todayYear && m.month <= todayMonth));
  const candidates = eligible.filter((m) => m.sessionCount > 0 && m.latestVersion === null);
  if (candidates.length > 0) return candidates[candidates.length - 1].month;
  const currentFy = months.length > 0 ? fiscalYearOf(`${months[0].year}-${String(months[0].month).padStart(2, "0")}-01`) : todayFy;
  if (currentFy === todayFy) return todayMonth;
  return months[months.length - 1]?.month ?? todayMonth;
}

/** Parses a stored snapshot defensively. Returns null when the shape is wrong. */
export function parseSnapshot(value: unknown): ReportSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.student_name !== "string" || typeof v.month !== "number" || !Array.isArray(v.sessions)) return null;
  return {
    tutor_name: typeof v.tutor_name === "string" ? v.tutor_name : "",
    student_name: v.student_name,
    tutoring_site: typeof v.tutoring_site === "string" ? v.tutoring_site : "",
    default_days: typeof v.default_days === "string" ? v.default_days : null,
    default_times: typeof v.default_times === "string" ? v.default_times : null,
    fiscal_year: typeof v.fiscal_year === "number" ? v.fiscal_year : 0,
    month: v.month,
    sessions: (v.sessions as unknown[]).flatMap((s) => {
      if (!s || typeof s !== "object") return [];
      const r = s as Record<string, unknown>;
      if (typeof r.date !== "string") return [];
      const code = r.code === "TA" || r.code === "SA" || r.code === "H" ? r.code : null;
      return [{ date: r.date, hours: Number(r.hours) || 0, code }];
    }),
    total_hours: Number(v.total_hours) || 0,
    is_stopped: v.is_stopped === true,
    stopped_reason: typeof v.stopped_reason === "string" ? v.stopped_reason : null,
    goals: Array.isArray(v.goals)
      ? (v.goals as unknown[]).flatMap((g) => {
          if (!g || typeof g !== "object") return [];
          const r = g as Record<string, unknown>;
          if (typeof r.goal_id !== "string") return [];
          return [
            {
              goal_id: r.goal_id,
              attained: r.attained === true,
              attained_on: typeof r.attained_on === "string" ? r.attained_on : null,
              other_text: typeof r.other_text === "string" ? r.other_text : null,
            },
          ];
        })
      : [],
  };
}
