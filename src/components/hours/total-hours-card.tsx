import Link from "next/link";
import { formatHours } from "@/lib/hours";
import type { TutorTotals } from "@/lib/data/students";
import { fiscalYearLabel, MONTH_LONG_NAMES } from "@/lib/fiscal-year";

export function TotalHoursCard({
  totals,
  fiscalYear,
  today,
}: {
  totals: TutorTotals;
  fiscalYear: number;
  today: string;
}) {
  const month = Number(today.split("-")[1]);
  return (
    <section
      aria-labelledby="total-hours-heading"
      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <h2 id="total-hours-heading" className="text-sm font-semibold text-gray-900">
          Total hours
        </h2>
        <Link href="/hours" className="text-sm font-medium text-primary hover:underline">
          See hours by month
        </Link>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-4">
        <div>
          <dt className="text-xs text-gray-500">{MONTH_LONG_NAMES[month - 1]}</dt>
          <dd className="text-2xl font-semibold text-gray-900">{formatHours(totals.thisMonth)}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Fiscal year {fiscalYearLabel(fiscalYear)}</dt>
          <dd className="text-2xl font-semibold text-gray-900">{formatHours(totals.thisFiscalYear)}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">All time</dt>
          <dd className="text-2xl font-semibold text-gray-900">{formatHours(totals.allTime)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-gray-500">
        Hours tutored across all your students, up to today. Absences and holidays count as 0.
      </p>
    </section>
  );
}
