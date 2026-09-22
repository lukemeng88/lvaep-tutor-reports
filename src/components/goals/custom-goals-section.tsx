"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronDownIcon, PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { createCustomGoal, deleteCustomGoal, updateCustomGoal } from "@/lib/actions/custom-goals";
import { todayISO } from "@/lib/fiscal-year";
import type { CustomGoalState } from "@/lib/goals";

/**
 * E. Other(s): the tutor's own goals, as many as they like. Each row is a
 * description, an Attained box with a date once checked, and a Remove
 * control. A row is saved once it has a description; a new row that stays
 * empty is never written and is simply gone when the tab is left. Removing
 * an attained goal asks first.
 */

type Row = {
  key: string;
  id: string | null;
  label: string;
  attained: boolean;
  attained_on: string | null;
};

type Props = {
  studentId: string;
  initial: CustomGoalState[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaving: <T>(work: () => Promise<T>) => Promise<T>;
  onError: () => void;
};

let nextKey = 0;

export function CustomGoalsSection({ studentId, initial, open, onOpenChange, onSaving, onError }: Props) {
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((g) => ({ key: g.id, id: g.id, label: g.label, attained: g.attained, attained_on: g.attained_on })),
  );
  const [removeAsk, setRemoveAsk] = useState<Row | null>(null);
  // The row whose text field should take focus once it is on the page.
  const focusKey = useRef<string | null>(null);
  // A row being created has no id yet; anything typed meanwhile is applied
  // once the id arrives.
  const creating = useRef(new Map<string, Promise<string | null>>());
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const saved = rows.filter((r) => r.id !== null);
  const attainedCount = saved.filter((r) => r.attained).length;

  function patch(key: string, changes: Partial<Row>) {
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...changes } : r)));
  }

  async function run<T>(work: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>): Promise<T | null> {
    try {
      const result = await onSaving(work);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    } catch (err) {
      onError();
      toast.error(err instanceof Error ? err.message : "We could not save the goal.");
      return null;
    }
  }

  /** Writes the row as it stands: creates it on first text, updates it after. */
  async function persist(key: string) {
    const row = rowsRef.current.find((r) => r.key === key);
    if (!row) return;
    const label = row.label.trim();
    if (!label) return;
    if (row.id) {
      await run(() => updateCustomGoal({ id: row.id as string, label, attained: row.attained, attainedOn: row.attained_on }));
      return;
    }
    if (creating.current.has(key)) return;
    const pending = run(() =>
      createCustomGoal({ studentId, label, attained: row.attained, attainedOn: row.attained_on, sortOrder: rowsRef.current.indexOf(row) }),
    ).then((data) => {
      creating.current.delete(key);
      const id = data?.id ?? null;
      if (id) patch(key, { id });
      return id;
    });
    creating.current.set(key, pending);
    const id = await pending;
    // Anything that changed while the create was in flight goes out now.
    const latest = rowsRef.current.find((r) => r.key === key);
    if (id && latest && (latest.label.trim() !== label || latest.attained !== row.attained || latest.attained_on !== row.attained_on)) {
      await run(() => updateCustomGoal({ id, label: latest.label.trim() || label, attained: latest.attained, attainedOn: latest.attained_on }));
    }
  }

  const { debounced: persistLater, cancel } = useDebouncedCallback((key: string) => void persist(key), 600);

  function addRow() {
    const key = `new-${nextKey++}`;
    focusKey.current = key;
    setRows((current) => [...current, { key, id: null, label: "", attained: false, attained_on: null }]);
  }

  function changeLabel(key: string, value: string) {
    patch(key, { label: value });
    if (value.trim()) persistLater(key);
    else cancel();
  }

  async function blurLabel(key: string) {
    cancel();
    const row = rowsRef.current.find((r) => r.key === key);
    if (!row) return;
    if (row.label.trim()) {
      await persist(key);
      return;
    }
    // An emptied goal is removed; an empty new row is left alone until the tab is left.
    if (row.id) await remove(row, false);
  }

  function changeAttained(key: string, checked: boolean) {
    const row = rowsRef.current.find((r) => r.key === key);
    if (!row) return;
    patch(key, { attained: checked, attained_on: checked ? (row.attained_on ?? todayISO()) : null });
    queueMicrotask(() => void persist(key));
  }

  function changeDate(key: string, value: string) {
    if (!value) return;
    patch(key, { attained_on: value });
    queueMicrotask(() => void persist(key));
  }

  async function remove(row: Row, ask: boolean) {
    if (ask && row.attained) {
      setRemoveAsk(row);
      return;
    }
    setRemoveAsk(null);
    const pending = creating.current.get(row.key);
    const id = row.id ?? (pending ? await pending : null);
    setRows((current) => current.filter((r) => r.key !== row.key));
    if (id) {
      const result = await run(() => deleteCustomGoal(id).then((r) => (r.ok ? { ok: true as const, data: undefined } : r)));
      if (result === null && rowsRef.current.every((r) => r.key !== row.key)) {
        setRows((current) => [...current, { ...row, id }]);
      }
    }
  }

  return (
    <>
      <Collapsible open={open} onOpenChange={onOpenChange} className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
          <span className="font-medium text-gray-900">E. Other(s)</span>
          <span className="flex items-center gap-3 text-sm text-gray-600">
            <span>
              {attainedCount} of {saved.length} attained
            </span>
            <ChevronDownIcon className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="divide-y divide-gray-100 border-t border-gray-100" data-testid="custom-goals">
            {rows.length === 0 ? (
              <li className="px-4 py-3 text-sm text-gray-600">No other goals yet. Add one below.</li>
            ) : null}
            {rows.map((row) => {
              const checkboxId = `custom-goal-${row.key}`;
              const dateId = `${checkboxId}-date`;
              return (
                <li key={row.key} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" data-custom-goal={row.id ?? "new"}>
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <input
                      id={checkboxId}
                      type="checkbox"
                      aria-label="Attained"
                      checked={row.attained}
                      onChange={(e) => changeAttained(row.key, e.target.checked)}
                      className="size-4 shrink-0 cursor-pointer rounded border-gray-300 accent-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    />
                    <Input
                      ref={(el) => {
                        // A new row starts in its text field.
                        if (el && focusKey.current === row.key) {
                          focusKey.current = null;
                          el.focus();
                        }
                      }}
                      aria-label="Goal description"
                      placeholder="Describe the goal"
                      value={row.label}
                      onChange={(e) => changeLabel(row.key, e.target.value)}
                      onBlur={() => void blurLabel(row.key)}
                      className="min-w-0 flex-1"
                    />
                  </div>
                  <div className="flex items-center gap-2 sm:pl-4">
                    {row.attained ? (
                      <>
                        <Label htmlFor={dateId} className="text-xs text-gray-500">
                          Attained on
                        </Label>
                        <input
                          id={dateId}
                          type="date"
                          value={row.attained_on ?? ""}
                          onChange={(e) => changeDate(row.key, e.target.value)}
                          className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </>
                    ) : null}
                    <Button type="button" variant="ghost" size="sm" aria-label="Remove goal" onClick={() => void remove(row, true)}>
                      <XIcon className="size-4" aria-hidden="true" />
                      Remove
                    </Button>
                  </div>
                </li>
              );
            })}
            <li className="px-4 py-3">
              <Button type="button" variant="outline" size="sm" onClick={addRow}>
                <PlusIcon className="size-4" aria-hidden="true" />
                Add goal
              </Button>
            </li>
          </ul>
        </CollapsibleContent>
      </Collapsible>

      <Dialog open={removeAsk !== null} onOpenChange={(next) => (next ? null : setRemoveAsk(null))}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove this goal?</DialogTitle>
            <DialogDescription>
              {removeAsk ? `"${removeAsk.label}" is marked attained. Removing it takes it off the record.` : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRemoveAsk(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => removeAsk && void remove(removeAsk, false)}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
