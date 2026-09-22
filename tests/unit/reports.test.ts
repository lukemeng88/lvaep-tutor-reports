import { describe, expect, it } from "vitest";
import {
  buildSnapshot,
  defaultMonthToSubmit,
  parseSnapshot,
  validateReport,
  type MonthStatus,
  type ReportValidationInput,
} from "@/lib/reports";

const base: ReportValidationInput = {
  studentId: "11111111-1111-4111-8111-111111111111",
  studentName: "Rosa Mendes",
  tutoringSite: "Bloomfield Public Library",
  tutorName: "Maria Alvarez",
  isStopped: false,
  stoppedReason: null,
  monthSessions: [{ session_date: "2026-08-03", hours: 1.5, code: null }],
};

describe("validateReport", () => {
  it("passes a complete month", () => {
    expect(validateReport(base)).toEqual([]);
  });

  it("requires student name, site and tutor name", () => {
    const issues = validateReport({ ...base, studentName: " ", tutoringSite: "", tutorName: "" });
    expect(issues.map((i) => i.message)).toEqual([
      "The student's full name is missing.",
      "The tutoring site is missing.",
      "Your full name is missing from your profile.",
    ]);
    expect(issues[0].href).toBe(`/students/${base.studentId}`);
  });

  it("requires at least one session with hours or a code", () => {
    expect(validateReport({ ...base, monthSessions: [] })).toHaveLength(1);
    expect(validateReport({ ...base, monthSessions: [{ session_date: "2026-08-03", hours: 0, code: null }] })).toHaveLength(1);
    expect(validateReport({ ...base, monthSessions: [{ session_date: "2026-08-03", hours: 0, code: "H" }] })).toEqual([]);
  });

  it("requires a reason when the student is stopped", () => {
    expect(validateReport({ ...base, isStopped: true, stoppedReason: "  " })).toHaveLength(1);
    expect(validateReport({ ...base, isStopped: true, stoppedReason: "Moved away" })).toEqual([]);
  });
});

describe("buildSnapshot", () => {
  const input = {
    tutorName: "Maria Alvarez",
    student: {
      full_name: "Rosa Mendes",
      tutoring_site: "Bloomfield Public Library",
      default_days: "Mon, Wed",
      default_times: "10 to 11:30",
      is_stopped: false,
      stopped_reason: null,
    },
    fiscalYear: 2026,
    month: 1, // January 2027
    sessions: [
      { session_date: "2026-12-30", hours: 2, code: null },
      { session_date: "2027-01-04", hours: 1.5, code: null },
      { session_date: "2027-01-06", hours: 0, code: "TA" as const },
      { session_date: "2027-01-13", hours: 0.75, code: null },
      { session_date: "2027-02-01", hours: 3, code: null },
    ],
    goals: [{ goal_id: "A1", attained: true, attained_on: "2027-01-10", other_text: null }],
  };

  it("keeps only the month's sessions, in date order, and totals hours with codes as 0", () => {
    const snapshot = buildSnapshot(input);
    expect(snapshot.sessions.map((s) => s.date)).toEqual(["2027-01-04", "2027-01-06", "2027-01-13"]);
    expect(snapshot.total_hours).toBe(2.25);
    expect(snapshot.sessions[1]).toEqual({ date: "2027-01-06", hours: 0, code: "TA" });
    expect(snapshot.fiscal_year).toBe(2026);
    expect(snapshot.month).toBe(1);
    expect(snapshot.goals).toEqual(input.goals);
  });

  it("round-trips through parseSnapshot", () => {
    const snapshot = buildSnapshot(input);
    expect(parseSnapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot);
    expect(parseSnapshot({ nope: true })).toBeNull();
  });
});

describe("defaultMonthToSubmit", () => {
  const months: MonthStatus[] = [
    { month: 7, year: 2026, sessionCount: 4, latestVersion: 1, lastSubmittedAt: "x" },
    { month: 8, year: 2026, sessionCount: 5, latestVersion: null, lastSubmittedAt: null },
    { month: 9, year: 2026, sessionCount: 3, latestVersion: null, lastSubmittedAt: null },
    { month: 10, year: 2026, sessionCount: 6, latestVersion: null, lastSubmittedAt: null },
    { month: 11, year: 2026, sessionCount: 0, latestVersion: null, lastSubmittedAt: null },
    { month: 12, year: 2026, sessionCount: 0, latestVersion: null, lastSubmittedAt: null },
    { month: 1, year: 2027, sessionCount: 0, latestVersion: null, lastSubmittedAt: null },
    { month: 2, year: 2027, sessionCount: 0, latestVersion: null, lastSubmittedAt: null },
    { month: 3, year: 2027, sessionCount: 0, latestVersion: null, lastSubmittedAt: null },
    { month: 4, year: 2027, sessionCount: 0, latestVersion: null, lastSubmittedAt: null },
    { month: 5, year: 2027, sessionCount: 0, latestVersion: null, lastSubmittedAt: null },
    { month: 6, year: 2027, sessionCount: 0, latestVersion: null, lastSubmittedAt: null },
  ];

  it("picks the most recent past month with sessions and no submission", () => {
    expect(defaultMonthToSubmit(months, "2026-09-22")).toBe(9);
  });

  it("does not pick a future month even if it has sessions", () => {
    expect(defaultMonthToSubmit(months, "2026-08-15")).toBe(8);
  });

  it("falls back to the current month when everything is submitted", () => {
    const all = months.map((m) => ({ ...m, latestVersion: 1 }));
    expect(defaultMonthToSubmit(all, "2026-09-22")).toBe(9);
  });
});
