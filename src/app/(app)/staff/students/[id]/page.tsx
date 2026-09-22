import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Achievements } from "@/components/staff/achievements";
import { RecordToolbar } from "@/components/staff/record-toolbar";
import { SubmissionHistory } from "@/components/staff/submission-history";
import { YearGridTable } from "@/components/staff/year-grid";
import { requireStaff } from "@/lib/auth/session";
import { getStaffStudentRecord } from "@/lib/data/staff";
import { fiscalYearLabel, MONTH_LONG_NAMES } from "@/lib/fiscal-year";
import { formatDateTime, formatLongDate } from "@/lib/format";
import { toGoalStates } from "@/lib/goals";
import { FOOTER_NOTE, OFFICE } from "@/lib/office";
import { assembleYearGrid, latestSnapshot, pickSubmittedMonths } from "@/lib/record";
import { commonTimes, scheduleDays } from "@/lib/schedule";

type Params = { id: string };
type Query = { fy?: string; live?: string; version?: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  await requireStaff();
  const record = await getStaffStudentRecord(id);
  return { title: record ? `${record.student.full_name} record` : "Student record" };
}

export default async function StaffStudentPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Query>;
}) {
  const { id } = await params;
  const query = await searchParams;
  await requireStaff();

  const requestedFy = query.fy && /^\d{4}$/.test(query.fy) ? Number(query.fy) : undefined;
  const record = await getStaffStudentRecord(id, requestedFy);
  if (!record) notFound();

  const live = query.live === "1";
  const pinnedId = query.version && record.reports.some((r) => r.id === query.version) ? query.version : null;
  const submittedByMonth = pickSubmittedMonths(record.reports, pinnedId);
  const grid = assembleYearGrid({
    fiscalYear: record.fiscalYear,
    mode: live ? "live" : "submitted",
    submittedByMonth,
    liveSessions: record.liveSessions,
  });
  const latest = latestSnapshot(submittedByMonth);
  const pinned = pinnedId ? record.reports.find((r) => r.id === pinnedId) ?? null : null;

  // Header, stopped status and goals: live data in live view, else the most
  // recent snapshot. Day(s) are the weekdays of the active weekly schedules
  // and Time(s) the start and end most of the year's sessions share.
  const header = live || !latest
    ? {
        tutor: record.tutor.full_name,
        student: record.student.full_name,
        site: record.student.tutoring_site,
        days: scheduleDays(record.rules, record.today),
        times: commonTimes(record.liveSessions),
        stopped: record.student.is_stopped,
        stoppedReason: record.student.stopped_reason,
        goals: toGoalStates(record.definitions, record.liveGoals),
      }
    : {
        tutor: latest.snapshot.tutor_name,
        student: latest.snapshot.student_name,
        site: latest.snapshot.tutoring_site,
        days: latest.snapshot.days,
        times: latest.snapshot.times,
        stopped: latest.snapshot.is_stopped,
        stoppedReason: latest.snapshot.stopped_reason,
        goals: latest.snapshot.goals,
      };

  const basePath = `/staff/students/${record.student.id}`;
  const csvHref = `${basePath}/sessions.csv?fy=${record.fiscalYear}${live ? "&live=1" : ""}${pinnedId ? `&version=${pinnedId}` : ""}`;
  const submittedCount = grid.columns.filter((c) => c.source === "submitted").length;

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/staff" },
          { label: record.tutor.full_name, href: `/staff?tutor=${record.tutor.id}` },
          { label: record.student.full_name },
        ]}
      />

      <div className="print-hidden mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{record.student.full_name}</h1>
          <p className="mt-1 text-sm text-gray-600">
            Tutor: {record.tutor.full_name}. {submittedCount} of 12 months submitted for {fiscalYearLabel(record.fiscalYear)}.
          </p>
        </div>
        <RecordToolbar fiscalYear={record.fiscalYear} fiscalYearOptions={record.fiscalYearOptions} live={live} csvHref={csvHref} />
      </div>

      {live ? (
        <div role="status" className="print-hidden mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span className="font-medium">Live view.</span> Showing the tutor&apos;s current calendar and goals, including days that
          have not been submitted yet. Submitted reports are not affected.
        </div>
      ) : null}
      {pinned ? (
        <div role="status" className="print-hidden mb-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          Showing version {pinned.version} of {MONTH_LONG_NAMES[pinned.month - 1]}, submitted {formatDateTime(pinned.submitted_at)}.{" "}
          <Link href={`${basePath}?fy=${record.fiscalYear}`} className="font-medium underline">
            Back to the latest versions
          </Link>
        </div>
      ) : null}
      {!live && submittedCount === 0 ? (
        <div className="print-hidden mb-4 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
          No reports have been submitted for this fiscal year yet. Use Live view to see the tutor&apos;s progress so far.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px] print:block">
        {/* The form, laid out like the paper original */}
        <article
          id="record-form"
          className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none"
        >
          <header className="flex flex-col gap-2 border-b border-gray-300 pb-3 sm:flex-row sm:items-start sm:justify-between print:pb-1">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Literacy Volunteers of America, Essex/Passaic County</p>
              <h2 className="text-lg font-semibold text-gray-900">Tutor Session Report {fiscalYearLabel(record.fiscalYear)}</h2>
              {live ? <p className="text-xs font-medium text-amber-700">Live view: includes days not yet submitted</p> : null}
            </div>
          </header>

          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3 print:mt-1 print:grid-cols-5 print:gap-y-0.5 print:text-[10px]">
            <div className="col-span-2 sm:col-span-1 print:col-span-2">
              <dt className="text-xs text-gray-500">Tutor</dt>
              <dd className="font-medium text-gray-900">{header.tutor}</dd>
            </div>
            <div className="col-span-2 sm:col-span-1 print:col-span-2">
              <dt className="text-xs text-gray-500">Student</dt>
              <dd className="font-medium text-gray-900">{header.student}</dd>
            </div>
            <div className="col-span-2 sm:col-span-1 print:col-span-1">
              <dt className="text-xs text-gray-500">Tutoring Site</dt>
              <dd className="font-medium text-gray-900">{header.site}</dd>
            </div>
            <div className="print:col-span-2">
              <dt className="text-xs text-gray-500">Day(s)</dt>
              <dd className="font-medium text-gray-900">{header.days || <span aria-label="No days">&nbsp;</span>}</dd>
            </div>
            <div className="print:col-span-3">
              <dt className="text-xs text-gray-500">Time(s)</dt>
              <dd className="font-medium text-gray-900">{header.times || <span aria-label="No times">&nbsp;</span>}</dd>
            </div>
          </dl>

          <div className="mt-4 print:mt-2">
            <YearGridTable grid={grid} live={live} />
            <p className="mt-1 text-xs text-gray-500 print:text-[9px]">TA = Tutor Absent, SA = Student Absent, H = Holiday. Absence and holiday days count as 0 hours.</p>
          </div>

          <div className="mt-4 rounded-md border border-gray-300 p-3 text-sm print:mt-2 print:p-2 print:text-xs">
            <p className="flex items-center gap-2">
              <span
                aria-label={header.stopped ? "Stopped" : "Not stopped"}
                className={`flex size-4 items-center justify-center border ${header.stopped ? "border-gray-900 bg-gray-900 text-white" : "border-gray-500"}`}
              >
                {header.stopped ? "X" : ""}
              </span>
              <span className="font-semibold uppercase tracking-wide text-gray-900">Stopped</span>
              <span className="text-gray-600">
                {header.stopped
                  ? record.student.stopped_at && (live || !latest)
                    ? `since ${formatLongDate(record.student.stopped_at.slice(0, 10))}`
                    : ""
                  : "The student is still being tutored."}
              </span>
            </p>
            <p className="mt-1 text-gray-800">
              <span className="text-gray-500">Reason: </span>
              {header.stopped ? header.stoppedReason || <span className="text-gray-400">No reason recorded</span> : <span className="text-gray-400">Not applicable</span>}
            </p>
          </div>

          <div className="mt-4 print:mt-2">
            <Achievements definitions={record.definitions} states={header.goals} />
          </div>

          <footer className="mt-4 border-t border-gray-300 pt-3 text-xs text-gray-700 print:mt-2 print:pt-2 print:text-[10px]">
            <p className="font-medium text-gray-900">
              {OFFICE.name}, {OFFICE.location}, {OFFICE.street}, {OFFICE.cityStateZip}
            </p>
            <p>
              {OFFICE.email}, {OFFICE.phone}
            </p>
            <p className="mt-2 italic">{FOOTER_NOTE}</p>
          </footer>
        </article>

        <SubmissionHistory reports={record.reports} fiscalYear={record.fiscalYear} pinnedId={pinnedId} basePath={basePath} />
      </div>
    </div>
  );
}
