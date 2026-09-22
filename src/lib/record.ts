import { fiscalYearMonths } from "@/lib/fiscal-year";
import { roundHours, type HoursSession } from "@/lib/hours";
import type { ReportSnapshot } from "@/lib/reports";
import type { SessionCode } from "@/lib/supabase/database.types";

export type GridCell = { hours: number; code: SessionCode | null } | null;

export type SubmittedMonth = {
  reportId: string;
  version: number;
  submittedAt: string;
  snapshot: ReportSnapshot;
};

export type GridColumn = {
  month: number;
  year: number;
  source: "submitted" | "live" | "none";
  version: number | null;
  submittedAt: string | null;
  cells: GridCell[]; // index 0 = day 1 ... index 30 = day 31
  total: number;
};

export type YearGrid = {
  fiscalYear: number;
  columns: GridColumn[];
  grandTotal: number;
};

function emptyCells(): GridCell[] {
  return new Array<GridCell>(31).fill(null);
}

/**
 * Assembles the 31 x 12 form grid for a fiscal year.
 * In "submitted" mode each month comes from the given submitted snapshot
 * (normally the latest version). In "live" mode every month comes from the
 * current sessions, whether or not they were submitted.
 */
export function assembleYearGrid(input: {
  fiscalYear: number;
  mode: "submitted" | "live";
  submittedByMonth: Map<number, SubmittedMonth>;
  liveSessions: HoursSession[];
}): YearGrid {
  const columns: GridColumn[] = fiscalYearMonths(input.fiscalYear).map(({ month, year }) => {
    const cells = emptyCells();
    const prefix = `${year}-${String(month).padStart(2, "0")}-`;
    let total = 0;

    if (input.mode === "live") {
      for (const s of input.liveSessions) {
        if (!s.session_date.startsWith(prefix)) continue;
        const day = Number(s.session_date.slice(8, 10));
        const hours = s.code ? 0 : Number(s.hours) || 0;
        cells[day - 1] = { hours, code: s.code };
        total += hours;
      }
      return { month, year, source: "live", version: null, submittedAt: null, cells, total: roundHours(total) };
    }

    const submitted = input.submittedByMonth.get(month);
    if (!submitted) {
      return { month, year, source: "none", version: null, submittedAt: null, cells, total: 0 };
    }
    for (const s of submitted.snapshot.sessions) {
      if (!s.date.startsWith(prefix)) continue;
      const day = Number(s.date.slice(8, 10));
      const hours = s.code ? 0 : Number(s.hours) || 0;
      cells[day - 1] = { hours, code: s.code };
      total += hours;
    }
    return {
      month,
      year,
      source: "submitted",
      version: submitted.version,
      submittedAt: submitted.submittedAt,
      cells,
      total: roundHours(total),
    };
  });

  return {
    fiscalYear: input.fiscalYear,
    columns,
    grandTotal: roundHours(columns.reduce((sum, c) => sum + c.total, 0)),
  };
}

/** Picks the latest version of each month, unless a specific report id is requested for that month. */
export function pickSubmittedMonths(
  reports: { id: string; month: number; version: number; submitted_at: string; snapshot: ReportSnapshot }[],
  pinnedReportId?: string | null,
): Map<number, SubmittedMonth> {
  const byMonth = new Map<number, SubmittedMonth>();
  const pinned = pinnedReportId ? reports.find((r) => r.id === pinnedReportId) : undefined;
  for (const r of reports) {
    if (pinned && r.month === pinned.month) {
      if (r.id !== pinned.id) continue;
    } else {
      const current = byMonth.get(r.month);
      if (current && current.version >= r.version) continue;
    }
    byMonth.set(r.month, { reportId: r.id, version: r.version, submittedAt: r.submitted_at, snapshot: r.snapshot });
  }
  return byMonth;
}

/** The most recently submitted snapshot in the year, used for status and goals. */
export function latestSnapshot(months: Map<number, SubmittedMonth>): SubmittedMonth | null {
  let best: SubmittedMonth | null = null;
  for (const m of months.values()) {
    if (!best || m.submittedAt > best.submittedAt) best = m;
  }
  return best;
}

export function gridToCsv(
  grid: YearGrid,
  meta: { studentName: string; tutorName: string },
): string {
  const rows: string[][] = [["date", "student", "tutor", "hours", "code", "source"]];
  for (const column of grid.columns) {
    const source =
      column.source === "submitted"
        ? `submitted v${column.version}`
        : column.source === "live"
          ? "live (not submitted)"
          : "";
    column.cells.forEach((cell, index) => {
      if (!cell) return;
      const date = `${column.year}-${String(column.month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`;
      rows.push([date, meta.studentName, meta.tutorName, String(cell.hours), cell.code ?? "", source]);
    });
  }
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return rows.map((r) => r.map(escape).join(",")).join("\n") + "\n";
}
