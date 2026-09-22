import { describe, expect, it } from "vitest";
import { isQuarterHours, normalizeHoursAndCode } from "@/lib/sessions";
import { formatHours, sessionHours, sumHours, upToToday } from "@/lib/hours";

describe("hours and code exclusivity", () => {
  it("setting a code zeroes the hours", () => {
    expect(normalizeHoursAndCode(1.5, "TA", "code")).toEqual({ hours: 0, code: "TA" });
    expect(normalizeHoursAndCode(2, "H", "code")).toEqual({ hours: 0, code: "H" });
  });

  it("clearing the code keeps the hours", () => {
    expect(normalizeHoursAndCode(1.5, null, "code")).toEqual({ hours: 1.5, code: null });
  });

  it("entering hours above zero clears the code", () => {
    expect(normalizeHoursAndCode(0.75, "SA", "hours")).toEqual({ hours: 0.75, code: null });
  });

  it("entering zero hours keeps an existing code", () => {
    expect(normalizeHoursAndCode(0, "SA", "hours")).toEqual({ hours: 0, code: "SA" });
  });
});

describe("isQuarterHours", () => {
  it("accepts quarter hour steps between 0 and 12", () => {
    expect(isQuarterHours(0)).toBe(true);
    expect(isQuarterHours(0.25)).toBe(true);
    expect(isQuarterHours(1.75)).toBe(true);
    expect(isQuarterHours(12)).toBe(true);
  });

  it("rejects other values", () => {
    expect(isQuarterHours(1.1)).toBe(false);
    expect(isQuarterHours(-0.25)).toBe(false);
    expect(isQuarterHours(12.25)).toBe(false);
    expect(isQuarterHours(Number.NaN)).toBe(false);
  });
});

describe("hours totals", () => {
  const sessions = [
    { session_date: "2026-09-01", hours: 1.5, code: null },
    { session_date: "2026-09-03", hours: 0, code: "TA" as const },
    { session_date: "2026-09-08", hours: 2, code: null },
    { session_date: "2026-09-30", hours: 1, code: null },
  ];

  it("counts coded days as zero", () => {
    expect(sessionHours(sessions[1])).toBe(0);
    expect(sumHours(sessions)).toBe(4.5);
  });

  it("ignores sessions after today", () => {
    expect(sumHours(upToToday(sessions, "2026-09-10"))).toBe(3.5);
  });

  it("formats quarter hours without trailing zeros", () => {
    expect(formatHours(4)).toBe("4");
    expect(formatHours(4.5)).toBe("4.5");
    expect(formatHours(4.25)).toBe("4.25");
  });
});
