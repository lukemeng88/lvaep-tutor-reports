import { describe, expect, it } from "vitest";
import {
  calendarYearForMonth,
  daysInMonth,
  fiscalYearEnd,
  fiscalYearLabel,
  fiscalYearMonths,
  fiscalYearOf,
  fiscalYearOfMonth,
  fiscalYearStart,
  monthLabel,
  parseISODate,
  toISODate,
} from "@/lib/fiscal-year";

describe("fiscalYearOf", () => {
  it("puts July through December in the fiscal year of the same calendar year", () => {
    expect(fiscalYearOf("2026-07-01")).toBe(2026);
    expect(fiscalYearOf("2026-09-22")).toBe(2026);
    expect(fiscalYearOf("2026-12-31")).toBe(2026);
  });

  it("puts January through June in the fiscal year of the previous calendar year", () => {
    expect(fiscalYearOf("2027-01-01")).toBe(2026);
    expect(fiscalYearOf("2027-06-30")).toBe(2026);
    expect(fiscalYearOf("2025-03-15")).toBe(2024);
  });

  it("accepts Date objects", () => {
    expect(fiscalYearOf(new Date(2026, 5, 30))).toBe(2025);
    expect(fiscalYearOf(new Date(2026, 6, 1))).toBe(2026);
  });

  it("matches fiscalYearOfMonth", () => {
    expect(fiscalYearOfMonth(2026, 6)).toBe(2025);
    expect(fiscalYearOfMonth(2026, 7)).toBe(2026);
  });
});

describe("fiscal year bounds", () => {
  it("starts July 1 and ends June 30 of the next year", () => {
    expect(fiscalYearStart(2026)).toBe("2026-07-01");
    expect(fiscalYearEnd(2026)).toBe("2027-06-30");
    expect(fiscalYearLabel(2026)).toBe("2026-2027");
  });

  it("lists months from July to June with the right calendar years", () => {
    const months = fiscalYearMonths(2026);
    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({ month: 7, year: 2026 });
    expect(months[5]).toEqual({ month: 12, year: 2026 });
    expect(months[6]).toEqual({ month: 1, year: 2027 });
    expect(months[11]).toEqual({ month: 6, year: 2027 });
    expect(calendarYearForMonth(2026, 3)).toBe(2027);
    expect(monthLabel(2026, 2)).toBe("February 2027");
  });
});

describe("date helpers", () => {
  it("round-trips ISO dates without time zone drift", () => {
    expect(toISODate(parseISODate("2026-02-28"))).toBe("2026-02-28");
    expect(toISODate(parseISODate("2027-01-01"))).toBe("2027-01-01");
  });

  it("knows month lengths including leap years", () => {
    expect(daysInMonth(2027, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 9)).toBe(30);
  });
});
