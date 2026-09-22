import Link from "next/link";
import type { StaffReport } from "@/lib/data/staff";
import { MONTH_LONG_NAMES } from "@/lib/fiscal-year";
import { formatDateTime } from "@/lib/format";
import { formatHours } from "@/lib/hours";
import { cn } from "@/lib/utils";

export function SubmissionHistory({
  reports,
  fiscalYear,
  pinnedId,
  basePath,
}: {
  reports: StaffReport[];
  fiscalYear: number;
  pinnedId: string | null;
  basePath: string;
}) {
  const byMonth = new Map<number, StaffReport[]>();
  for (const r of reports) {
    const list = byMonth.get(r.month) ?? [];
    list.push(r);
    byMonth.set(r.month, list);
  }
  const months = [...byMonth.entries()].sort((a, b) => {
    const order = (m: number) => (m >= 7 ? m - 7 : m + 5);
    return order(a[0]) - order(b[0]);
  });

  return (
    <section aria-labelledby="history-heading" className="print-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <h2 id="history-heading" className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900">
        Submission history
      </h2>
      {months.length === 0 ? (
        <p className="p-4 text-sm text-gray-600">No reports have been submitted for this fiscal year.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {months.map(([month, versions]) => {
            const sorted = [...versions].sort((a, b) => b.version - a.version);
            const year = sorted[0].snapshot.fiscal_year === fiscalYear && month >= 7 ? fiscalYear : fiscalYear + 1;
            return (
              <li key={month} className="px-4 py-3">
                <p className="text-sm font-medium text-gray-900">
                  {MONTH_LONG_NAMES[month - 1]} {year}
                </p>
                <ul className="mt-1 space-y-1">
                  {sorted.map((r, index) => {
                    const isLatest = index === 0;
                    const viewing = pinnedId ? pinnedId === r.id : isLatest;
                    return (
                      <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-700">
                        <span>
                          Version {r.version}
                          {isLatest ? <span className="ml-1 text-gray-500">(latest)</span> : null}: {formatDateTime(r.submitted_at)},{" "}
                          {formatHours(r.snapshot.total_hours)} hours
                        </span>
                        {isLatest && !pinnedId ? (
                          <span className="rounded-full bg-accent px-2 py-0.5 font-medium text-accent-foreground">Shown</span>
                        ) : (
                          <Link
                            href={isLatest ? `${basePath}?fy=${fiscalYear}` : `${basePath}?fy=${fiscalYear}&version=${r.id}`}
                            className={cn("font-medium text-primary hover:underline", viewing && "rounded-full bg-accent px-2 py-0.5 text-accent-foreground no-underline")}
                          >
                            {viewing ? "Shown" : "View this version"}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
