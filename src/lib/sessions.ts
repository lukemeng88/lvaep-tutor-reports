import type { SessionCode } from "@/lib/supabase/database.types";

export const SESSION_CODES: { value: SessionCode; label: string; short: string }[] = [
  { value: "TA", label: "Tutor absent", short: "TA" },
  { value: "SA", label: "Student absent", short: "SA" },
  { value: "H", label: "Holiday", short: "H" },
];

export function codeLabel(code: SessionCode | null): string {
  return SESSION_CODES.find((c) => c.value === code)?.label ?? "None";
}

export function isQuarterHours(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 12 && Math.abs(value * 4 - Math.round(value * 4)) < 1e-9;
}

/**
 * Hours and codes are mutually exclusive. A code forces hours to 0; hours
 * above 0 clear the code. Returns the normalized pair.
 */
export function normalizeHoursAndCode(
  hours: number,
  code: SessionCode | null,
  changed: "hours" | "code",
): { hours: number; code: SessionCode | null } {
  if (changed === "code") {
    return code ? { hours: 0, code } : { hours, code: null };
  }
  return hours > 0 ? { hours, code: null } : { hours: 0, code };
}
