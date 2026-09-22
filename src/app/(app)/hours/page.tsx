import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/layout/page-header";
import { HoursChart } from "@/components/hours/hours-chart";
import { FiscalYearSelect } from "@/components/hours/fiscal-year-select";
import { requireTutor } from "@/lib/auth/session";
import { getTutorHoursData } from "@/lib/data/hours";
import { fiscalYearLabel, MONTH_SHORT_NAMES } from "@/lib/fiscal-year";
import { formatHours } from "@/lib/hours";

export const metadata: Metadata = { title: "Hours" };

export default async function HoursPage({
  searchParams,
}: {
  searchParams: Promise<{ fy?: string }>;
}) {
  const user = await requireTutor();
  const { fy } = await searchParams;
  const requested = fy && /^\d{4}$/.test(fy) ? Number(fy) : undefined;
  const data = await getTutorHoursData(user.id, requested);
  const hasHours = data.total > 0;

  return (
    <div>
      <Breadcrumbs items={[{ label: "Home", href: "/home" }, { label: "Hours" }]} />
      <PageHeader
        title="Hours"
        description={`Hours tutored per month in fiscal year ${fiscalYearLabel(data.fiscalYear)}, up to today. Absences and holidays count as 0.`}
        actions={
          <FiscalYearSelect value={data.fiscalYear} options={data.fiscalYearOptions} current={data.currentFiscalYear} />
        }
      />

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Hours per month</h2>
          <p className="text-sm text-gray-600">
            Total: <span className="font-semibold text-gray-900">{formatHours(data.total)}</span>
          </p>
        </div>
        {hasHours ? (
          <div className="mt-3">
            <HoursChart months={data.months} perMonth={data.perMonth} running={data.running} />
          </div>
        ) : (
          <p className="mt-6 rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-600">
            No hours recorded in this fiscal year yet. Add tutoring days on a student&apos;s calendar and they show up here.
          </p>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm">
        <h2 className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900">Hours per student</h2>
        {data.rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-600">No students yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-xs text-gray-500">
                  <th scope="col" className="sticky left-0 bg-white px-4 py-2 text-left font-medium">
                    Student
                  </th>
                  {data.months.map((m) => (
                    <th key={m.month} scope="col" className="px-2 py-2 text-right font-medium">
                      {MONTH_SHORT_NAMES[m.month - 1]}
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.studentId} className="border-t border-gray-100">
                    <th scope="row" className="sticky left-0 bg-white px-4 py-2 text-left font-medium text-gray-900">
                      {row.name}
                      {row.isStopped ? <span className="ml-2 text-xs font-normal text-gray-500">(stopped)</span> : null}
                    </th>
                    {row.byMonth.map((h, i) => (
                      <td key={i} className="px-2 py-2 text-right tabular-nums text-gray-700">
                        {h ? formatHours(h) : <span className="text-gray-300">0</span>}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right font-medium tabular-nums text-gray-900">{formatHours(row.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-50 font-medium text-gray-900">
                  <th scope="row" className="sticky left-0 bg-gray-50 px-4 py-2 text-left">
                    All students
                  </th>
                  {data.perMonth.map((h, i) => (
                    <td key={i} className="px-2 py-2 text-right tabular-nums">
                      {formatHours(h)}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right tabular-nums">{formatHours(data.total)}</td>
                </tr>
                <tr className="border-t border-gray-100 text-gray-600">
                  <th scope="row" className="sticky left-0 bg-white px-4 py-2 text-left font-medium">
                    Running total
                  </th>
                  {data.running.map((h, i) => (
                    <td key={i} className="px-2 py-2 text-right tabular-nums">
                      {formatHours(h)}
                    </td>
                  ))}
                  <td className="px-4 py-2" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
