import { MONTH_LONG_NAMES, MONTH_SHORT_NAMES, parseISODate } from "@/lib/fiscal-year";

/** "September 22, 2026" */
export function formatLongDate(iso: string): string {
  const d = parseISODate(iso);
  return `${MONTH_LONG_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** "Sep 22" */
export function formatShortDate(iso: string): string {
  const d = parseISODate(iso);
  return `${MONTH_SHORT_NAMES[d.getMonth()]} ${d.getDate()}`;
}

/** "Sep 22, 2026 at 9:05 AM" from a timestamp string. */
export function formatDateTime(timestamp: string): string {
  const d = new Date(timestamp);
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const suffix = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${MONTH_SHORT_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} at ${h12}:${minutes} ${suffix}`;
}
