"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatLongDate } from "@/lib/format";
import { SESSION_CODES } from "@/lib/sessions";
import { checkTimes, formatHoursLabel, hoursBetween, minutesToTime, parseTime, toHHMM } from "@/lib/times";
import type { SessionCode } from "@/lib/supabase/database.types";
import type { CalendarSession } from "@/lib/data/sessions";
import { WEEKDAY_LONG } from "@/lib/calendar";
import { weekdayOf } from "@/lib/recurrence";

export type Scope = "this" | "future";

export type EditorSubmit =
  | { kind: "add"; hours: number; code: SessionCode | null; startTime: string | null; endTime: string | null; repeatWeekly: boolean }
  | { kind: "update"; hours: number; code: SessionCode | null; startTime: string | null; endTime: string | null; scope: Scope };

type Props = {
  iso: string;
  session: CalendarSession | null;
  pending: boolean;
  onSubmit: (submit: EditorSubmit) => void;
  onDelete: () => void;
  onClose: () => void;
};

const DEFAULT_START = "10:00";
const DEFAULT_END = "11:00";

/** Where the inputs start: the session's own times, or a pair that matches its hours for older rows without times. */
function initialTimes(session: CalendarSession | null): { start: string; end: string } {
  if (!session) return { start: DEFAULT_START, end: DEFAULT_END };
  const start = toHHMM(session.start_time);
  const end = toHHMM(session.end_time);
  if (start && end) return { start, end };
  if (session.hours > 0) return { start: DEFAULT_START, end: minutesToTime((parseTime(DEFAULT_START) ?? 0) + session.hours * 60) };
  return { start: DEFAULT_START, end: DEFAULT_END };
}

// Shared form for the popover (desktop) and bottom sheet (mobile). Hours
// are never typed: they are the end time minus the start time.
export function SessionEditor({ iso, session, pending, onSubmit, onDelete, onClose }: Props) {
  const editing = session !== null;
  const recurring = Boolean(session?.recurrence_rule_id);
  const initial = initialTimes(session);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [code, setCode] = useState<SessionCode | null>(session?.code ?? null);
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [scope, setScope] = useState<Scope>("this");
  const [error, setError] = useState<string | null>(null);

  const weekday = WEEKDAY_LONG[weekdayOf(iso)];
  const timesProblem = code ? null : checkTimes(start, end);
  const hours = code ? 0 : timesProblem ? null : hoursBetween(start, end);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (code) {
      const base = { hours: 0, code, startTime: null, endTime: null };
      if (editing) onSubmit({ kind: "update", ...base, scope: recurring ? scope : "this" });
      else onSubmit({ kind: "add", ...base, repeatWeekly });
      return;
    }
    if (!start || !end) {
      setError("Enter a start and end time, or choose an absence or holiday code.");
      return;
    }
    if (timesProblem) {
      setError(timesProblem);
      return;
    }
    const base = { hours: hours ?? 0, code: null, startTime: start, endTime: end };
    if (editing) onSubmit({ kind: "update", ...base, scope: recurring ? scope : "this" });
    else onSubmit({ kind: "add", ...base, repeatWeekly });
  }

  const timeInput =
    "h-8 w-full rounded-md border border-gray-300 px-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <div>
        <p className="font-medium text-gray-900">{formatLongDate(iso)}</p>
        <p className="text-xs text-gray-500">
          {editing ? (recurring ? `Weekly session, every ${weekday}` : "Single session") : "New session"}
        </p>
      </div>

      {code === null ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="session-start">Start time</Label>
            <input
              id="session-start"
              type="time"
              step={900}
              value={start}
              onChange={(e) => setStart(e.target.value)}
              autoFocus
              className={timeInput}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="session-end">End time</Label>
            <input id="session-end" type="time" step={900} value={end} onChange={(e) => setEnd(e.target.value)} className={timeInput} />
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="session-code">Code</Label>
          <select
            id="session-code"
            value={code ?? ""}
            onChange={(e) => setCode(e.target.value === "" ? null : (e.target.value as SessionCode))}
            className="h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">None</option>
            {SESSION_CODES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <span className="text-sm font-medium text-gray-700">Hours</span>
          <p data-testid="session-hours" aria-live="polite" className="h-8 leading-8 text-sm font-medium text-gray-900">
            {code ? "0 hours" : hours !== null ? formatHoursLabel(hours) : <span className="font-normal text-gray-500">{timesProblem}</span>}
          </p>
        </div>
      </div>
      {code ? (
        <p className="text-xs text-gray-500">Absence and holiday days count as 0 hours.</p>
      ) : null}

      {!editing ? (
        <label className="flex items-center gap-2 text-sm text-gray-900">
          <input
            type="checkbox"
            checked={repeatWeekly}
            onChange={(e) => setRepeatWeekly(e.target.checked)}
            className="size-4 accent-primary"
          />
          Repeat every {weekday} until the end of the fiscal year
        </label>
      ) : null}

      {editing && recurring ? (
        <fieldset className="space-y-1.5">
          <legend className="text-xs font-medium text-gray-700">Apply changes to</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="scope"
              value="this"
              checked={scope === "this"}
              onChange={() => setScope("this")}
              className="accent-primary"
            />
            This day only
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="scope"
              value="future"
              checked={scope === "future"}
              onChange={() => setScope("future")}
              className="accent-primary"
            />
            This and future days
          </label>
        </fieldset>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        {editing ? (
          <Button type="button" variant="destructive" size="sm" onClick={onDelete} disabled={pending}>
            Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving" : editing ? "Save" : "Add"}
          </Button>
        </div>
      </div>
    </form>
  );
}
