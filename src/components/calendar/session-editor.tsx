"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatLongDate } from "@/lib/format";
import { SESSION_CODES, normalizeHoursAndCode } from "@/lib/sessions";
import type { SessionCode } from "@/lib/supabase/database.types";
import type { CalendarSession } from "@/lib/data/sessions";
import { WEEKDAY_LONG } from "@/lib/calendar";
import { weekdayOf } from "@/lib/recurrence";

export type Scope = "this" | "future";

export type EditorSubmit =
  | { kind: "add"; hours: number; code: SessionCode | null; repeatWeekly: boolean }
  | { kind: "update"; hours: number; code: SessionCode | null; scope: Scope };

type Props = {
  iso: string;
  session: CalendarSession | null;
  pending: boolean;
  onSubmit: (submit: EditorSubmit) => void;
  onDelete: () => void;
  onClose: () => void;
};

// Shared form for the popover (desktop) and bottom sheet (mobile).
export function SessionEditor({ iso, session, pending, onSubmit, onDelete, onClose }: Props) {
  const editing = session !== null;
  const recurring = Boolean(session?.recurrence_rule_id);
  const [hours, setHours] = useState<number>(session ? session.hours : 1);
  const [hoursText, setHoursText] = useState<string>(session ? String(session.hours) : "1");
  const [code, setCode] = useState<SessionCode | null>(session?.code ?? null);
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [scope, setScope] = useState<Scope>("this");
  const [error, setError] = useState<string | null>(null);

  const weekday = WEEKDAY_LONG[weekdayOf(iso)];

  function commitHours(text: string) {
    setHoursText(text);
    const value = Number(text);
    if (text === "" || !Number.isFinite(value)) return;
    const next = normalizeHoursAndCode(value, code, "hours");
    setHours(next.hours);
    setCode(next.code);
  }

  function changeCode(value: string) {
    const nextCode = value === "" ? null : (value as SessionCode);
    const next = normalizeHoursAndCode(hours, nextCode, "code");
    setHours(next.hours);
    setHoursText(String(next.hours));
    setCode(next.code);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const value = Number(hoursText);
    if (!Number.isFinite(value) || value < 0 || value > 12 || Math.round(value * 4) !== value * 4) {
      setError("Enter hours between 0 and 12 in steps of 0.25.");
      return;
    }
    if (!editing && value === 0 && !code) {
      setError("Enter the hours tutored, or choose an absence or holiday code.");
      return;
    }
    const normalized = normalizeHoursAndCode(value, code, "hours");
    if (editing) {
      onSubmit({ kind: "update", hours: normalized.hours, code: normalized.code, scope: recurring ? scope : "this" });
    } else {
      onSubmit({ kind: "add", hours: normalized.hours, code: normalized.code, repeatWeekly });
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <div>
        <p className="font-medium text-gray-900">{formatLongDate(iso)}</p>
        <p className="text-xs text-gray-500">
          {editing ? (recurring ? `Weekly session, every ${weekday}` : "Single session") : "New session"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="session-hours">Hours</Label>
          <input
            id="session-hours"
            type="number"
            inputMode="decimal"
            min={0}
            max={12}
            step={0.25}
            value={hoursText}
            onChange={(e) => commitHours(e.target.value)}
            disabled={code !== null}
            autoFocus
            className="h-8 w-full rounded-md border border-gray-300 px-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:bg-gray-100 disabled:text-gray-400"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="session-code">Code</Label>
          <select
            id="session-code"
            value={code ?? ""}
            onChange={(e) => changeCode(e.target.value)}
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
