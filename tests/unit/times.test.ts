import { describe, expect, it } from "vitest";
import { commonTimes, scheduleDays } from "@/lib/schedule";
import { checkTimes, formatHoursLabel, formatTime12, formatTimeRange, hoursBetween, minutesToTime, parseTime, toHHMM } from "@/lib/times";

describe("times", () => {
  it("parses input and database forms", () => {
    expect(parseTime("10:00")).toBe(600);
    expect(parseTime("10:00:00")).toBe(600);
    expect(parseTime("9:15")).toBe(555);
    expect(parseTime("25:00")).toBeNull();
    expect(parseTime("")).toBeNull();
    expect(toHHMM("18:30:00")).toBe("18:30");
    expect(toHHMM(null)).toBeNull();
    expect(minutesToTime(600 + 90)).toBe("11:30");
  });

  it("computes hours as end minus start in quarter hours", () => {
    expect(hoursBetween("10:00", "11:30")).toBe(1.5);
    expect(hoursBetween("18:00", "18:45")).toBe(0.75);
    expect(hoursBetween("10:00", null)).toBeNull();
  });

  it("rejects an end at or before the start and sessions over twelve hours", () => {
    expect(checkTimes("10:00", "11:30")).toBeNull();
    expect(checkTimes("10:00", "10:00")).toBe("The end time must be after the start time.");
    expect(checkTimes("11:00", "10:00")).toBe("The end time must be after the start time.");
    expect(checkTimes("06:00", "18:15")).toBe("A session cannot be longer than 12 hours.");
    expect(checkTimes("10:05", "11:00")).toBe("Times are in 15 minute steps.");
    expect(checkTimes("", "11:00")).toBe("Enter a start time and an end time.");
  });

  it("formats twelve hour times and labels", () => {
    expect(formatTime12("10:00")).toBe("10:00 am");
    expect(formatTime12("13:30")).toBe("1:30 pm");
    expect(formatTime12("00:15")).toBe("12:15 am");
    expect(formatTimeRange("10:00", "11:30")).toBe("10:00 am to 11:30 am");
    expect(formatTimeRange("10:00", null)).toBe("");
    expect(formatHoursLabel(1.5)).toBe("1.5 hours");
    expect(formatHoursLabel(1)).toBe("1 hour");
    expect(formatHoursLabel(0.25)).toBe("0.25 hours");
  });
});

describe("schedule", () => {
  it("lists the weekdays of active rules, Monday first", () => {
    const rules = [
      { weekday: 3, start_date: "2026-07-01", end_date: null },
      { weekday: 1, start_date: "2026-07-01", end_date: "2027-06-30" },
      { weekday: 6, start_date: "2026-07-01", end_date: "2026-08-01" },
      { weekday: 0, start_date: "2026-12-01", end_date: null },
    ];
    expect(scheduleDays(rules, "2026-09-22")).toBe("Mon, Wed");
    expect(scheduleDays([], "2026-09-22")).toBeNull();
  });

  it("takes the most common start and end, earliest start on a tie", () => {
    const sessions = [
      { start_time: "10:00:00", end_time: "11:30:00" },
      { start_time: "10:00:00", end_time: "11:30:00" },
      { start_time: "18:00:00", end_time: "19:00:00" },
      { start_time: null, end_time: null },
    ];
    expect(commonTimes(sessions)).toBe("10:00 am to 11:30 am");
    expect(commonTimes([{ start_time: "18:00", end_time: "19:00" }, { start_time: "09:00", end_time: "10:00" }])).toBe("9:00 am to 10:00 am");
    expect(commonTimes([{ start_time: null, end_time: null }])).toBeNull();
  });
});
