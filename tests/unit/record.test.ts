import { describe, expect, it } from "vitest";
import { assembleYearGrid, gridToCsv, latestSnapshot, pickSubmittedMonths } from "@/lib/record";
import type { ReportSnapshot } from "@/lib/reports";

function snapshot(month: number, sessions: ReportSnapshot["sessions"]): ReportSnapshot {
  return {
    tutor_name: "Maria",
    student_name: "Rosa",
    tutoring_site: "Library",
    days: null,
    times: null,
    fiscal_year: 2026,
    month,
    sessions,
    total_hours: sessions.reduce((s, x) => s + (x.code ? 0 : x.hours), 0),
    is_stopped: false,
    stopped_reason: null,
    goals: [],
  };
}

const at = (start: string | null, end: string | null) => ({ start_time: start, end_time: end });

const reports = [
  { id: "r1", month: 8, version: 1, submitted_at: "2026-09-01T09:00:00Z", snapshot: snapshot(8, [{ date: "2026-08-03", hours: 1, code: null, ...at("10:00", "11:00") }]) },
  {
    id: "r2",
    month: 8,
    version: 2,
    submitted_at: "2026-09-02T09:00:00Z",
    snapshot: snapshot(8, [
      { date: "2026-08-03", hours: 1.5, code: null, ...at("10:00", "11:30") },
      { date: "2026-08-05", hours: 0, code: "SA", ...at(null, null) },
    ]),
  },
  { id: "r3", month: 7, version: 1, submitted_at: "2026-08-01T09:00:00Z", snapshot: snapshot(7, [{ date: "2026-07-31", hours: 2, code: null, ...at("09:00", "11:00") }]) },
];

describe("pickSubmittedMonths", () => {
  it("keeps the latest version per month", () => {
    const months = pickSubmittedMonths(reports);
    expect(months.get(8)?.version).toBe(2);
    expect(months.get(7)?.version).toBe(1);
    expect(latestSnapshot(months)?.reportId).toBe("r2");
  });

  it("can pin an older version for one month", () => {
    const months = pickSubmittedMonths(reports, "r1");
    expect(months.get(8)?.version).toBe(1);
    expect(months.get(7)?.version).toBe(1);
  });
});

describe("assembleYearGrid", () => {
  it("fills cells from submitted snapshots and totals hours with codes as 0", () => {
    const grid = assembleYearGrid({
      fiscalYear: 2026,
      mode: "submitted",
      submittedByMonth: pickSubmittedMonths(reports),
      liveSessions: [],
    });
    expect(grid.columns).toHaveLength(12);
    const july = grid.columns[0];
    const august = grid.columns[1];
    expect(july.cells[30]).toEqual({ hours: 2, code: null, start_time: "09:00", end_time: "11:00" });
    expect(july.total).toBe(2);
    expect(august.cells[2]).toEqual({ hours: 1.5, code: null, start_time: "10:00", end_time: "11:30" });
    expect(august.cells[4]).toEqual({ hours: 0, code: "SA", start_time: null, end_time: null });
    expect(august.total).toBe(1.5);
    expect(august.version).toBe(2);
    expect(grid.columns[2].source).toBe("none");
    expect(grid.grandTotal).toBe(3.5);
  });

  it("uses live sessions in live mode regardless of submissions", () => {
    const grid = assembleYearGrid({
      fiscalYear: 2026,
      mode: "live",
      submittedByMonth: pickSubmittedMonths(reports),
      liveSessions: [
        { session_date: "2026-09-14", hours: 1.25, code: null, start_time: "18:00:00", end_time: "19:15:00" },
        { session_date: "2027-06-30", hours: 0, code: "H", start_time: null, end_time: null },
      ],
    });
    // Times arrive from the database as HH:MM:SS and come out as HH:MM.
    expect(grid.columns[2].cells[13]).toEqual({ hours: 1.25, code: null, start_time: "18:00", end_time: "19:15" });
    expect(grid.columns[11].cells[29]).toEqual({ hours: 0, code: "H", start_time: null, end_time: null });
    expect(grid.columns[1].total).toBe(0);
    expect(grid.grandTotal).toBe(1.25);
    expect(grid.columns.every((c) => c.source === "live")).toBe(true);
  });

  it("exports a CSV with one row per recorded day", () => {
    const grid = assembleYearGrid({
      fiscalYear: 2026,
      mode: "submitted",
      submittedByMonth: pickSubmittedMonths(reports),
      liveSessions: [],
    });
    const csv = gridToCsv(grid, { studentName: "Rosa, Jr", tutorName: "Maria" });
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe("date,student,tutor,start_time,end_time,hours,code,source");
    expect(lines[1]).toBe('2026-07-31,"Rosa, Jr",Maria,09:00,11:00,2,,submitted v1');
    expect(lines[3]).toBe('2026-08-05,"Rosa, Jr",Maria,,,0,SA,submitted v2');
    expect(lines).toHaveLength(4);
  });
});
