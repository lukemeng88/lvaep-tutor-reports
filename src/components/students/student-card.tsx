"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatHours } from "@/lib/hours";
import { formatLongDate } from "@/lib/format";
import type { StudentWithStats } from "@/lib/data/students";
import { StopStudentDialog } from "./stop-student-dialog";
import { ReactivateStudentDialog } from "./reactivate-student-dialog";
import { SubmitReportButton } from "@/components/reports/submit-report-button";

export function StudentCard({ student, today }: { student: StudentWithStats; today: string }) {
  const [stopOpen, setStopOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const stopped = student.is_stopped;

  return (
    <li
      data-student-card={student.id}
      className={
        "rounded-lg border bg-white p-4 shadow-sm " +
        (stopped ? "border-gray-200 opacity-75" : "border-gray-200")
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            href={`/students/${student.id}`}
            className="text-base font-semibold text-gray-900 hover:text-primary hover:underline"
          >
            {student.full_name}
          </Link>
          <p className="mt-0.5 text-sm text-gray-600">{student.tutoring_site}</p>
          {stopped ? (
            <p className="mt-2 text-sm text-gray-600">
              <span className="font-medium text-gray-800">No longer tutored</span>
              {student.stopped_at ? ` on ${formatLongDate(student.stopped_at.slice(0, 10))}` : ""}
              {student.stopped_reason ? `: ${student.stopped_reason}` : ""}
            </p>
          ) : null}
        </div>
        <dl className="grid shrink-0 grid-cols-3 gap-x-5 gap-y-1 text-sm sm:text-right">
          <div>
            <dt className="text-xs text-gray-500">This month</dt>
            <dd className="font-medium text-gray-900">{formatHours(student.hoursThisMonth)} h</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">This fiscal year</dt>
            <dd className="font-medium text-gray-900">{formatHours(student.hoursThisFiscalYear)} h</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Goals attained</dt>
            <dd className="font-medium text-gray-900">{student.goalsAttained}</dd>
          </div>
        </dl>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
        <p className="text-xs text-gray-500">
          {student.nextSessionDate
            ? student.nextSessionDate === today
              ? "Next session: today"
              : `Next session: ${formatLongDate(student.nextSessionDate)}`
            : stopped
              ? "No sessions scheduled"
              : "No upcoming session"}
        </p>
        <div className="flex flex-wrap gap-2">
          {/* Edit opens the student's page, where the name, site, days and
              times are edited in place in the header. */}
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/students/${student.id}`} />}>
            Edit
          </Button>
          <SubmitReportButton studentId={student.id} studentName={student.full_name} size="sm" variant="outline" />
          {stopped ? (
            <Button variant="outline" size="sm" onClick={() => setReactivateOpen(true)}>
              Reactivate
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setStopOpen(true)}>
              No longer tutoring
            </Button>
          )}
        </div>
      </div>

      <StopStudentDialog
        open={stopOpen}
        onOpenChange={setStopOpen}
        studentId={student.id}
        studentName={student.full_name}
      />
      <ReactivateStudentDialog
        open={reactivateOpen}
        onOpenChange={setReactivateOpen}
        studentId={student.id}
        studentName={student.full_name}
      />
    </li>
  );
}
