"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { useMediaQuery } from "@/hooks/use-media-query";
import { addSession, deleteSession, updateSession } from "@/lib/actions/sessions";
import type { ActionResult } from "@/lib/actions/result";
import { monthGrid, WEEKDAY_SHORT } from "@/lib/calendar";
import type { CalendarSession } from "@/lib/data/sessions";
import {
  calendarYearForMonth,
  FISCAL_MONTH_ORDER,
  fiscalYearLabel,
  fiscalYearOf,
  MONTH_LONG_NAMES,
  parseISODate,
  toISODate,
} from "@/lib/fiscal-year";
import { formatHours, isInFiscalYear, isInMonth, sumHours, upToToday } from "@/lib/hours";
import { planWeeklyRecurrence } from "@/lib/recurrence";
import { codeLabel, SESSION_CODES } from "@/lib/sessions";
import type { SessionCode } from "@/lib/supabase/database.types";
import { formatLongDate } from "@/lib/format";
import { formatHoursLabel } from "@/lib/times";
import { cn } from "@/lib/utils";
import { DeleteSessionDialog } from "./delete-session-dialog";
import { SessionEditor, type EditorSubmit, type Scope } from "./session-editor";

type Props = {
  studentId: string;
  sessions: CalendarSession[];
  today: string;
};

const CHIP_STYLES: Record<"hours" | "TA" | "SA" | "H", string> = {
  hours: "bg-[var(--session-hours-bg)] text-[var(--session-hours-fg)]",
  TA: "bg-[var(--session-ta-bg)] text-[var(--session-ta-fg)]",
  SA: "bg-[var(--session-sa-bg)] text-[var(--session-sa-fg)]",
  H: "bg-[var(--session-h-bg)] text-[var(--session-h-fg)]",
};

// The legend is a tool palette in two groups: Edit, with "Tutoring hours",
// the normal mode where a day opens the popover; and Mark day as, with the
// three codes that paint a day with one click. One button is selected at a
// time. The cells keep the short codes (TA, SA, H).
type Mode = "hours" | SessionCode;

const EDIT_TOOLS: { mode: Mode; label: string }[] = [{ mode: "hours", label: "Tutoring hours" }];
const MARK_TOOLS: { mode: Mode; label: string }[] = SESSION_CODES.map((c) => ({ mode: c.value as Mode, label: c.label }));

export function CalendarTab({ studentId, sessions: serverSessions, today }: Props) {
  const currentFiscalYear = fiscalYearOf(today);
  const todayMonth = Number(today.split("-")[1]);

  const [fiscalYear, setFiscalYear] = useState(currentFiscalYear);
  const [month, setMonth] = useState(todayMonth);
  const [sessions, setSessions] = useState(serverSessions);
  const [seenSessions, setSeenSessions] = useState(serverSessions);
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [focusedIso, setFocusedIso] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("hours");
  // A day with hours is not painted over silently: this holds the question.
  const [replaceAsk, setReplaceAsk] = useState<{ iso: string; hours: number; code: SessionCode } | null>(null);
  const [pending, startTransition] = useTransition();
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useMediaQuery("(max-width: 639px)");

  // The server list is the source of truth after every save.
  if (serverSessions !== seenSessions) {
    setSeenSessions(serverSessions);
    setSessions(serverSessions);
  }

  const year = calendarYearForMonth(fiscalYear, month);
  const rows = useMemo(() => monthGrid(year, month), [year, month]);
  const byDate = useMemo(() => new Map(sessions.map((s) => [s.session_date, s])), [sessions]);

  const monthSessions = sessions.filter((s) => isInMonth(s.session_date, year, month));
  const monthSoFar = sumHours(upToToday(monthSessions, today));
  const monthPlanned = sumHours(monthSessions) - monthSoFar;
  const yearSessions = sessions.filter((s) => isInFiscalYear(s.session_date, fiscalYear));
  const yearSoFar = sumHours(upToToday(yearSessions, today));
  const yearPlanned = sumHours(yearSessions) - yearSoFar;

  const fiscalYearOptions = useMemo(() => {
    const years = new Set<number>([currentFiscalYear, currentFiscalYear - 1, currentFiscalYear + 1]);
    for (const s of sessions) years.add(fiscalYearOf(s.session_date));
    return [...years].sort((a, b) => b - a);
  }, [sessions, currentFiscalYear]);

  const selectedSession = selectedIso ? (byDate.get(selectedIso) ?? null) : null;
  const firstIso = rows.flat().find((c) => c !== null)?.iso ?? null;
  const rovingIso =
    focusedIso && isInMonth(focusedIso, year, month)
      ? focusedIso
      : isInMonth(today, year, month)
        ? today
        : firstIso;

  function goToMonth(nextFiscalYear: number, nextMonth: number) {
    setFiscalYear(nextFiscalYear);
    setMonth(nextMonth);
    setSelectedIso(null);
  }

  function previousMonth() {
    if (month === 7) goToMonth(fiscalYear - 1, 6);
    else goToMonth(fiscalYear, month === 1 ? 12 : month - 1);
  }

  function nextMonth() {
    if (month === 6) goToMonth(fiscalYear + 1, 7);
    else goToMonth(fiscalYear, month === 12 ? 1 : month + 1);
  }

  // Escape leaves a code mode. The mode also resets with the tab, since the
  // component unmounts when the tutor navigates away.
  useEffect(() => {
    if (mode === "hours") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMode("hours");
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mode]);

  function openDay(iso: string, element: HTMLButtonElement) {
    const existing = byDate.get(iso);
    if (existing && existing.id.startsWith("temp-")) {
      toast.info("That day is still saving. Try again in a moment.");
      return;
    }
    setFocusedIso(iso);
    if (mode !== "hours") {
      paintDay(iso, mode, existing ?? null);
      return;
    }
    anchorRef.current = element;
    setSelectedIso(iso);
  }

  /**
   * One click in a code mode. The same code again clears the day (a coded
   * row holds nothing else, so it is deleted); another code replaces it; a
   * day with hours asks first; an empty day gets a new coded row.
   */
  function paintDay(iso: string, code: SessionCode, existing: CalendarSession | null) {
    const label = codeLabel(code);
    const when = formatLongDate(iso);
    if (!existing) {
      const addition: CalendarSession = {
        id: `temp-${iso}`,
        session_date: iso,
        hours: 0,
        code,
        recurrence_rule_id: null,
        notes: null,
        start_time: null,
        end_time: null,
      };
      runOptimistic(
        [...sessions, addition],
        () => addSession({ studentId, date: iso, code, startTime: null, endTime: null, repeatWeekly: false }),
        () => `Marked ${when} as ${label}.`,
      );
      return;
    }
    if (existing.code === code) {
      runOptimistic(
        sessions.filter((s) => s.id !== existing.id),
        () => deleteSession({ sessionId: existing.id, scope: "this" }),
        () => `Cleared ${label} from ${when}.`,
      );
      return;
    }
    if (existing.code === null && existing.hours > 0) {
      setReplaceAsk({ iso, hours: existing.hours, code });
      return;
    }
    applyCodeTo(existing, code);
  }

  function applyCodeTo(existing: CalendarSession, code: SessionCode) {
    runOptimistic(
      sessions.map((s) => (s.id === existing.id ? { ...s, hours: 0, code, start_time: null, end_time: null } : s)),
      () => updateSession({ sessionId: existing.id, code, startTime: null, endTime: null, scope: "this" }),
      () => `Marked ${formatLongDate(existing.session_date)} as ${codeLabel(code)}.`,
    );
  }

  function closeEditor() {
    setSelectedIso(null);
    setDeleteOpen(false);
    anchorRef.current?.focus();
  }

  function runOptimistic<T>(
    next: CalendarSession[],
    work: () => Promise<ActionResult<T>>,
    successMessage: (data: T) => string,
  ) {
    const snapshot = sessions;
    setSessions(next);
    setSelectedIso(null);
    setDeleteOpen(false);
    startTransition(async () => {
      const result = await work();
      if (!result.ok) {
        setSessions(snapshot);
        toast.error(result.error);
        return;
      }
      toast.success(successMessage(result.data));
    });
  }

  function handleSubmit(submit: EditorSubmit) {
    if (!selectedIso) return;
    const iso = selectedIso;

    if (submit.kind === "add") {
      const plan = submit.repeatWeekly
        ? planWeeklyRecurrence(iso, sessions.map((s) => s.session_date))
        : null;
      const dates = plan ? plan.dates : [iso];
      const tempRule = plan ? `temp-rule-${iso}` : null;
      const additions: CalendarSession[] = dates.map((d) => ({
        id: `temp-${d}`,
        session_date: d,
        hours: submit.hours,
        code: submit.code,
        recurrence_rule_id: tempRule,
        notes: null,
        start_time: submit.startTime,
        end_time: submit.endTime,
      }));
      runOptimistic(
        [...sessions, ...additions],
        () =>
          addSession({
            studentId,
            date: iso,
            code: submit.code,
            startTime: submit.startTime,
            endTime: submit.endTime,
            repeatWeekly: submit.repeatWeekly,
          }),
        (data) =>
          submit.repeatWeekly
            ? `Added ${data.created} weekly ${data.created === 1 ? "session" : "sessions"}${
                data.skipped ? ` (${data.skipped} already existed)` : ""
              }.`
            : "Session added.",
      );
      return;
    }

    const target = byDate.get(iso);
    if (!target) return;
    const affects = (s: CalendarSession) =>
      s.id === target.id ||
      (submit.scope === "future" &&
        target.recurrence_rule_id !== null &&
        s.recurrence_rule_id === target.recurrence_rule_id &&
        s.session_date >= target.session_date);
    runOptimistic(
      sessions.map((s) =>
        affects(s) ? { ...s, hours: submit.hours, code: submit.code, start_time: submit.startTime, end_time: submit.endTime } : s,
      ),
      () =>
        updateSession({
          sessionId: target.id,
          code: submit.code,
          startTime: submit.startTime,
          endTime: submit.endTime,
          scope: submit.scope,
        }),
      (data) => (data.updated === 1 ? "Session updated." : `Updated ${data.updated} sessions.`),
    );
  }

  function handleDelete(scope: Scope) {
    if (!selectedIso) return;
    const target = byDate.get(selectedIso);
    if (!target) return;
    const affects = (s: CalendarSession) =>
      s.id === target.id ||
      (scope === "future" &&
        target.recurrence_rule_id !== null &&
        s.recurrence_rule_id === target.recurrence_rule_id &&
        s.session_date >= target.session_date);
    runOptimistic(
      sessions.filter((s) => !affects(s)),
      () => deleteSession({ sessionId: target.id, scope }),
      (data) => (data.deleted === 1 ? "Session deleted." : `Deleted ${data.deleted} sessions.`),
    );
  }

  function handleGridKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const current = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-iso]");
    if (!current) return;
    const iso = current.dataset.iso;
    if (!iso) return;
    const deltas: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    let target: string | null = null;
    if (event.key in deltas) {
      const d = parseISODate(iso);
      d.setDate(d.getDate() + deltas[event.key]);
      target = toISODate(d);
    } else if (event.key === "Home") {
      target = firstIso;
    } else if (event.key === "End") {
      target = rows.flat().filter((c) => c !== null).at(-1)?.iso ?? null;
    }
    if (!target) return;
    event.preventDefault();
    if (!isInMonth(target, year, month)) {
      // Moving past the edge of the month pages the calendar.
      if (target < `${year}-${String(month).padStart(2, "0")}-01`) previousMonth();
      else nextMonth();
      setFocusedIso(target);
      requestAnimationFrame(() => {
        gridRef.current?.querySelector<HTMLButtonElement>(`button[data-iso="${target}"]`)?.focus();
      });
      return;
    }
    setFocusedIso(target);
    gridRef.current?.querySelector<HTMLButtonElement>(`button[data-iso="${target}"]`)?.focus();
  }

  const editorOpen = selectedIso !== null && !deleteOpen;
  const editor = selectedIso ? (
    <SessionEditor
      key={`${selectedIso}-${selectedSession?.id ?? "new"}`}
      iso={selectedIso}
      session={selectedSession}
      pending={pending}
      onSubmit={handleSubmit}
      onDelete={() => setDeleteOpen(true)}
      onClose={closeEditor}
    />
  ) : null;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon-sm" onClick={previousMonth} aria-label="Previous month">
            <ChevronLeftIcon />
          </Button>
          <h2 className="min-w-40 text-center text-lg font-semibold text-gray-900" aria-live="polite">
            {MONTH_LONG_NAMES[month - 1]} {year}
          </h2>
          <Button variant="outline" size="icon-sm" onClick={nextMonth} aria-label="Next month">
            <ChevronRightIcon />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => goToMonth(currentFiscalYear, todayMonth)}
            disabled={fiscalYear === currentFiscalYear && month === todayMonth}
          >
            Today
          </Button>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          Fiscal year
          <select
            value={fiscalYear}
            onChange={(e) => goToMonth(Number(e.target.value), 7)}
            className="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {fiscalYearOptions.map((fy) => (
              <option key={fy} value={fy}>
                {fiscalYearLabel(fy)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Month strip within the fiscal year */}
      <div className="mt-3 flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Months">
        {FISCAL_MONTH_ORDER.map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={m === month}
            onClick={() => goToMonth(fiscalYear, m)}
            className={cn(
              "rounded-md px-2 py-1 text-xs font-medium transition-colors",
              m === month ? "bg-primary text-primary-foreground" : "text-gray-600 hover:bg-gray-100",
            )}
          >
            {MONTH_LONG_NAMES[m - 1].slice(0, 3)}
          </button>
        ))}
      </div>

      {/* Summary strip */}
      <dl className="mt-3 grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-sm">
        <div>
          <dt className="text-xs text-gray-500">Hours in {MONTH_LONG_NAMES[month - 1]}</dt>
          <dd className="font-semibold text-gray-900">
            {formatHours(monthSoFar)}
            {monthPlanned > 0 ? (
              <span className="ml-1 font-normal text-gray-500">({formatHours(monthPlanned)} more planned)</span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Hours in fiscal year {fiscalYearLabel(fiscalYear)}</dt>
          <dd className="font-semibold text-gray-900">
            {formatHours(yearSoFar)}
            {yearPlanned > 0 ? (
              <span className="ml-1 font-normal text-gray-500">({formatHours(yearPlanned)} more planned)</span>
            ) : null}
          </dd>
        </div>
      </dl>

      {/* Tool palette: the selected button is filled in its color and checked. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2" role="group" aria-label="Calendar tools">
        {[
          { label: "Edit:", tools: EDIT_TOOLS },
          { label: "Mark day as:", tools: MARK_TOOLS },
        ].map((group) => (
          <div key={group.label} className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">{group.label}</span>
            {group.tools.map((item) => {
              const selected = mode === item.mode;
              return (
                <button
                  key={item.mode}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setMode(selected && item.mode !== "hours" ? "hours" : item.mode)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    selected ? cn("border-transparent", CHIP_STYLES[item.mode]) : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
                  )}
                >
                  {selected ? (
                    <CheckIcon className="size-3.5" aria-hidden="true" />
                  ) : (
                    <span className={cn("inline-block size-2.5 rounded-full", CHIP_STYLES[item.mode])} aria-hidden="true" />
                  )}
                  {item.label}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {mode !== "hours" ? (
        <p role="status" className={cn("mt-2 rounded-md px-3 py-2 text-sm", CHIP_STYLES[mode])}>
          Click any day to mark it as {codeLabel(mode)}. Press Escape when finished.
        </p>
      ) : null}

      {/* Grid */}
      <div
        ref={gridRef}
        role="grid"
        aria-label={`${MONTH_LONG_NAMES[month - 1]} ${year}`}
        onKeyDown={handleGridKeyDown}
        className={cn("mt-2 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm", mode !== "hours" && "cursor-pointer")}
      >
        <div role="row" className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 text-center text-xs font-medium text-gray-500">
          {WEEKDAY_SHORT.map((d) => (
            <div key={d} role="columnheader" className="py-1.5">
              {d}
            </div>
          ))}
        </div>
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} role="row" className="grid grid-cols-7 border-b border-gray-100 last:border-b-0">
            {row.map((cell, cellIndex) => {
              if (!cell) {
                return <div key={`blank-${cellIndex}`} role="gridcell" className="min-h-14 bg-gray-50/60 sm:min-h-20" />;
              }
              const session = byDate.get(cell.iso);
              const isToday = cell.iso === today;
              const chipStyle = session ? (session.code ? CHIP_STYLES[session.code] : CHIP_STYLES.hours) : null;
              const label = session
                ? session.code
                  ? `${codeLabel(session.code)}`
                  : `${formatHours(session.hours)} ${session.hours === 1 ? "hour" : "hours"}`
                : "No session";
              return (
                <div key={cell.iso} role="gridcell" className="border-r border-gray-100 last:border-r-0">
                  <button
                    type="button"
                    data-iso={cell.iso}
                    tabIndex={cell.iso === rovingIso ? 0 : -1}
                    aria-label={`${MONTH_LONG_NAMES[month - 1]} ${cell.day}, ${label}`}
                    aria-pressed={selectedIso === cell.iso}
                    onClick={(e) => openDay(cell.iso, e.currentTarget)}
                    onFocus={() => setFocusedIso(cell.iso)}
                    className={cn(
                      "flex min-h-14 w-full flex-col items-start gap-1 p-1 text-left transition-colors hover:bg-gray-50 focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:min-h-20 sm:p-1.5",
                      selectedIso === cell.iso && "bg-accent",
                      mode !== "hours" && "cursor-pointer",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full text-xs font-medium",
                        isToday ? "ring-2 ring-primary text-primary" : "text-gray-700",
                      )}
                    >
                      {cell.day}
                    </span>
                    {session ? (
                      <span
                        className={cn(
                          "w-full truncate rounded px-1 py-0.5 text-center text-[11px] font-semibold sm:text-xs",
                          chipStyle,
                          session.id.startsWith("temp-") && "opacity-60",
                        )}
                      >
                        {session.code ? session.code : `${formatHours(session.hours)} h`}
                      </span>
                    ) : null}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Click a day to add or change a session. To mark an absence or holiday, choose a color above and then click the day.
      </p>

      {/* Editor: popover on wide screens, bottom sheet on phones */}
      {isMobile ? (
        <Dialog open={editorOpen} onOpenChange={(open) => (open ? null : closeEditor())}>
          <DialogContent
            showCloseButton={false}
            className="top-auto bottom-0 left-0 w-full max-w-full translate-x-0 translate-y-0 rounded-b-none rounded-t-xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))] data-open:slide-in-from-bottom-4 data-closed:slide-out-to-bottom-4"
          >
            <DialogTitle className="sr-only">Session</DialogTitle>
            {editor}
          </DialogContent>
        </Dialog>
      ) : (
        <Popover open={editorOpen} onOpenChange={(open) => (open ? null : closeEditor())}>
          <PopoverContent anchor={anchorRef} side="bottom" align="start" className="w-80 p-4">
            {editor}
          </PopoverContent>
        </Popover>
      )}

      {/* A day with hours is only painted over after a yes. */}
      <Dialog open={replaceAsk !== null} onOpenChange={(open) => (open ? null : setReplaceAsk(null))}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {replaceAsk ? `Replace ${formatHoursLabel(replaceAsk.hours)} with ${codeLabel(replaceAsk.code)}?` : ""}
            </DialogTitle>
            <DialogDescription>
              {replaceAsk ? `${formatLongDate(replaceAsk.iso)} will count as 0 hours and lose its start and end time.` : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReplaceAsk(null)} disabled={pending}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!replaceAsk) return;
                const existing = byDate.get(replaceAsk.iso);
                setReplaceAsk(null);
                if (existing) applyCodeTo(existing, replaceAsk.code);
              }}
            >
              Replace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedIso ? (
        <DeleteSessionDialog
          open={deleteOpen}
          onOpenChange={(open) => (open ? setDeleteOpen(true) : setDeleteOpen(false))}
          iso={selectedIso}
          recurring={Boolean(selectedSession?.recurrence_rule_id)}
          pending={pending}
          onConfirm={handleDelete}
        />
      ) : null}
    </div>
  );
}
