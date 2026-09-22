"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useSaveStatus } from "@/hooks/use-save-status";
import type { Student } from "@/lib/supabase/database.types";
import { formatLongDate } from "@/lib/format";
import { StopStudentDialog } from "@/components/students/stop-student-dialog";
import { ReactivateStudentDialog } from "@/components/students/reactivate-student-dialog";
import { SubmitReportButton } from "@/components/reports/submit-report-button";
import { InlineEditField } from "./inline-edit-field";
import { SaveIndicator } from "./save-indicator";

export function StudentHeader({ student }: { student: Student }) {
  const { status, track, markError } = useSaveStatus();
  const [stopOpen, setStopOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);

  return (
    <header className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      {student.is_stopped ? (
        <div
          role="status"
          className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          <span className="font-medium">You are no longer tutoring this student</span>
          {student.stopped_at ? ` since ${formatLongDate(student.stopped_at.slice(0, 10))}` : ""}.
          {student.stopped_reason ? ` Reason: ${student.stopped_reason}` : ""} You can still edit their
          record, or reactivate them.
        </div>
      ) : null}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <InlineEditField
            studentId={student.id}
            field="full_name"
            label="Student"
            value={student.full_name}
            required
            inputClassName="text-2xl font-semibold tracking-tight"
            onSaving={track}
            onError={markError}
          />
          <div className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-3">
            <InlineEditField
              studentId={student.id}
              field="tutoring_site"
              label="Tutoring site"
              value={student.tutoring_site}
              required
              onSaving={track}
              onError={markError}
            />
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
            <span>Click a field to edit. Changes save automatically.</span>
            <SaveIndicator status={status} />
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <SubmitReportButton studentId={student.id} studentName={student.full_name} />
          {student.is_stopped ? (
            <Button variant="outline" onClick={() => setReactivateOpen(true)}>
              Reactivate
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setStopOpen(true)}>
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
    </header>
  );
}
