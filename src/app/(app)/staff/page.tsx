import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { StaffBrowser } from "@/components/staff/staff-browser";
import { requireStaff } from "@/lib/auth/session";
import { getStaffHomeData } from "@/lib/data/staff";
import { MONTH_LONG_NAMES } from "@/lib/fiscal-year";

export const metadata: Metadata = { title: "Staff home" };

export default async function StaffPage() {
  const user = await requireStaff();
  const data = await getStaffHomeData();
  const [, monthNum] = data.today.split("-").map(Number);

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user.profile.full_name}`}
        description="Pick a tutor, then a student, to see the full record assembled from submitted reports."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Reports submitted in {MONTH_LONG_NAMES[monthNum - 1]}
          </h2>
          <p className="mt-1 text-3xl font-semibold text-gray-900">{data.submittedThisMonth}</p>
          <p className="mt-1 text-xs text-gray-500">Counts every submission this month, including resubmissions.</p>
        </section>
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Missing reports for {MONTH_LONG_NAMES[data.lastMonth.month - 1]} {data.lastMonth.year}
          </h2>
          {data.missing.length === 0 ? (
            <p className="mt-2 text-sm text-gray-700">Every student with sessions last month has a submitted report.</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm">
              {data.missing.map((m) => (
                <li key={m.tutorId}>
                  <Link href={`/staff?tutor=${m.tutorId}`} className="font-medium text-primary hover:underline">
                    {m.tutorName}
                  </Link>
                  <span className="text-gray-600">
                    {": "}
                    {m.students.map((s, i) => (
                      <span key={s.id}>
                        {i > 0 ? ", " : ""}
                        <Link href={`/staff/students/${s.id}`} className="hover:underline">
                          {s.name}
                        </Link>
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-gray-500">Active students who had sessions last month but no submission for it.</p>
        </section>
      </div>

      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-gray-200" />}>
        <StaffBrowser tutors={data.tutors} students={data.students} />
      </Suspense>
    </div>
  );
}
