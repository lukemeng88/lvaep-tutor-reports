"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getReportMonths,
  submitReport,
  validateReportMonth,
  type ReportMonthsData,
} from "@/lib/actions/reports";
import { fiscalYearLabel, MONTH_LONG_NAMES } from "@/lib/fiscal-year";
import { formatDateTime } from "@/lib/format";
import { formatHours } from "@/lib/hours";
import type { ReportIssue } from "@/lib/reports";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
};

type Step =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "pick"; data: ReportMonthsData; month: number }
  | { kind: "issues"; data: ReportMonthsData; month: number; issues: ReportIssue[] }
  | { kind: "confirm"; data: ReportMonthsData; month: number; totalHours: number; sessionCount: number };

export function SubmitReportDialog({ open, onOpenChange, studentId, studentName }: Props) {
  const [step, setStep] = useState<Step>({ kind: "loading" });
  const [pending, startTransition] = useTransition();

  function load(fiscalYear?: number) {
    setStep({ kind: "loading" });
    startTransition(async () => {
      const result = await getReportMonths({ studentId, fiscalYear });
      if (!result.ok) {
        setStep({ kind: "error", message: result.error });
        return;
      }
      setStep({ kind: "pick", data: result.data, month: result.data.defaultMonth });
    });
  }

  // The dialog is mounted only while open, so the first load runs once per opening.
  useEffect(() => {
    let cancelled = false;
    getReportMonths({ studentId }).then((result) => {
      if (cancelled) return;
      if (!result.ok) setStep({ kind: "error", message: result.error });
      else setStep({ kind: "pick", data: result.data, month: result.data.defaultMonth });
    });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  function next() {
    if (step.kind !== "pick") return;
    const { data, month } = step;
    startTransition(async () => {
      const result = await validateReportMonth({ studentId, fiscalYear: data.fiscalYear, month });
      if (!result.ok) {
        setStep({ kind: "error", message: result.error });
        return;
      }
      if (result.data.issues.length > 0) {
        setStep({ kind: "issues", data, month, issues: result.data.issues });
      } else {
        setStep({ kind: "confirm", data, month, totalHours: result.data.totalHours, sessionCount: result.data.sessionCount });
      }
    });
  }

  function confirm() {
    if (step.kind !== "confirm") return;
    const { data, month } = step;
    startTransition(async () => {
      const result = await submitReport({ studentId, fiscalYear: data.fiscalYear, month });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Report submitted for ${studentName}, ${MONTH_LONG_NAMES[month - 1]} ${
          data.months.find((m) => m.month === month)?.year ?? ""
        } (version ${result.data.version}).`,
      );
      onOpenChange(false);
    });
  }

  const monthLabel = (data: ReportMonthsData, month: number) =>
    `${MONTH_LONG_NAMES[month - 1]} ${data.months.find((m) => m.month === month)?.year ?? ""}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Submit report for {studentName}</DialogTitle>
          <DialogDescription>
            {step.kind === "confirm"
              ? "Please confirm."
              : step.kind === "issues"
                ? "A few things need fixing before this month can be submitted."
                : "Choose the month to submit. You can resubmit a month later if something changes."}
          </DialogDescription>
        </DialogHeader>

        {step.kind === "loading" ? (
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded bg-gray-200" />
            ))}
          </div>
        ) : null}

        {step.kind === "error" ? (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            <p>{step.message}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => load()}>
              Try again
            </Button>
          </div>
        ) : null}

        {step.kind === "pick" ? (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              Fiscal year
              <select
                value={step.data.fiscalYear}
                onChange={(e) => load(Number(e.target.value))}
                className="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {step.data.fiscalYearOptions.map((fy) => (
                  <option key={fy} value={fy}>
                    {fiscalYearLabel(fy)}
                  </option>
                ))}
              </select>
            </label>
            <ul className="max-h-80 divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-200" role="radiogroup" aria-label="Month">
              {step.data.months.map((m) => {
                const selected = m.month === step.month;
                return (
                  <li key={m.month}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50",
                        selected && "bg-accent",
                      )}
                    >
                      <input
                        type="radio"
                        name="report-month"
                        value={m.month}
                        checked={selected}
                        onChange={() => setStep({ ...step, month: m.month })}
                        className="accent-primary"
                      />
                      <span className="flex-1">
                        <span className="font-medium text-gray-900">
                          {MONTH_LONG_NAMES[m.month - 1]} {m.year}
                        </span>
                        <span className="ml-2 text-xs text-gray-500">
                          {m.sessionCount} {m.sessionCount === 1 ? "day" : "days"}
                        </span>
                      </span>
                      {m.latestVersion ? (
                        <span
                          className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700"
                          title={m.lastSubmittedAt ? `Last submitted ${formatDateTime(m.lastSubmittedAt)}` : undefined}
                        >
                          Submitted (v{m.latestVersion})
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                          Not submitted
                        </span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {step.kind === "issues" ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-900">
              {monthLabel(step.data, step.month)} cannot be submitted yet:
            </p>
            <ul className="space-y-2">
              {step.issues.map((issue) => (
                <li key={issue.message} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <p>{issue.message}</p>
                  <Link href={issue.href} className="mt-1 inline-block font-medium text-primary hover:underline" onClick={() => onOpenChange(false)}>
                    {issue.linkLabel}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {step.kind === "confirm" ? (
          <div className="space-y-2 text-sm text-gray-800">
            <p>
              Are you sure you want to submit the report for <span className="font-medium">{studentName}</span>,{" "}
              <span className="font-medium">{monthLabel(step.data, step.month)}</span>? Staff will be able to see it. You
              can resubmit later if something changes.
            </p>
            <p className="rounded-md bg-gray-50 px-3 py-2 text-gray-700">
              {step.sessionCount} {step.sessionCount === 1 ? "day" : "days"}, {formatHours(step.totalHours)} hours tutored.
              {step.data.months.find((m) => m.month === step.month)?.latestVersion
                ? " This creates a new version of an earlier submission."
                : ""}
            </p>
          </div>
        ) : null}

        <DialogFooter>
          {step.kind === "confirm" || step.kind === "issues" ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep({ kind: "pick", data: step.data, month: step.month })}
              disabled={pending}
            >
              Back
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          {step.kind === "pick" ? (
            <Button type="button" onClick={next} disabled={pending}>
              {pending ? "Checking" : "Continue"}
            </Button>
          ) : null}
          {step.kind === "confirm" ? (
            <Button type="button" onClick={confirm} disabled={pending}>
              {pending ? "Submitting" : "Submit"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
