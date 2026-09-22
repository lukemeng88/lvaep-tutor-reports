import { describe, expect, it } from "vitest";
import { planWeeklyRecurrence, weekdayOf, weeklyDates } from "@/lib/recurrence";

describe("weeklyDates", () => {
  it("lists every week on the same weekday through the end of the fiscal year", () => {
    const dates = weeklyDates("2026-09-07"); // a Monday, fiscal year 2026
    expect(dates[0]).toBe("2026-09-07");
    expect(dates[1]).toBe("2026-09-14");
    expect(dates.at(-1)).toBe("2027-06-28"); // last Monday on or before 2027-06-30
    expect(dates.every((d) => weekdayOf(d) === 1)).toBe(true);
    expect(dates).toHaveLength(43);
  });

  it("stops at the fiscal year end even when the start is late in the year", () => {
    const dates = weeklyDates("2027-06-29"); // Tuesday, one day before FY end
    expect(dates).toEqual(["2027-06-29"]);
  });

  it("starts a new fiscal year on July 1", () => {
    const dates = weeklyDates("2027-07-01"); // Thursday, fiscal year 2027
    expect(dates.at(-1)).toBe("2028-06-29");
    expect(dates.every((d) => d >= "2027-07-01" && d <= "2028-06-30")).toBe(true);
  });

  it("handles a leap day without drifting", () => {
    const dates = weeklyDates("2028-02-22", "2028-03-14"); // Tuesdays across Feb 29, 2028
    expect(dates).toEqual(["2028-02-22", "2028-02-29", "2028-03-07", "2028-03-14"]);
  });
});

describe("planWeeklyRecurrence", () => {
  it("skips dates that already have a session and reports them", () => {
    const plan = planWeeklyRecurrence("2026-09-07", ["2026-09-14", "2026-10-05", "2026-09-08"]);
    expect(plan.weekday).toBe(1);
    expect(plan.endDate).toBe("2027-06-30");
    expect(plan.dates).not.toContain("2026-09-14");
    expect(plan.dates).not.toContain("2026-10-05");
    expect(plan.skipped).toEqual(["2026-09-14", "2026-10-05"]);
    expect(plan.dates).toHaveLength(41);
    expect(plan.dates[0]).toBe("2026-09-07");
  });

  it("creates nothing new when every week already exists", () => {
    const all = weeklyDates("2027-06-16");
    const plan = planWeeklyRecurrence("2027-06-16", all);
    expect(plan.dates).toEqual([]);
    expect(plan.skipped).toEqual(all);
  });
});
