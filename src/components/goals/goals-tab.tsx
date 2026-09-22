"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChevronDownIcon } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { SaveIndicator } from "@/components/student-detail/save-indicator";
import { useSaveStatus } from "@/hooks/use-save-status";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { saveGoal } from "@/lib/actions/goals";
import { countAttained, type CustomGoalState, type GoalGroup, type GoalState } from "@/lib/goals";
import { todayISO } from "@/lib/fiscal-year";
import type { GoalDefinition } from "@/lib/supabase/database.types";
import { CustomGoalsSection } from "./custom-goals-section";

type Props = {
  studentId: string;
  groups: GoalGroup[];
  initialStates: GoalState[];
  /** The tutor's own goals under E. Other(s). */
  initialCustomGoals: CustomGoalState[];
};

export function GoalsTab({ studentId, groups, initialStates, initialCustomGoals }: Props) {
  const [states, setStates] = useState<Map<string, GoalState>>(
    () => new Map(initialStates.map((s) => [s.goal_id, s])),
  );
  const { status, track, markError } = useSaveStatus();
  const [openCategories, setOpenCategories] = useState<Set<string>>(() => new Set(["A"]));

  async function persist(next: GoalState, previous: GoalState) {
    try {
      const result = await track(() =>
        saveGoal({
          studentId,
          goalId: next.goal_id,
          attained: next.attained,
          attainedOn: next.attained_on,
          otherText: next.other_text,
        }),
      );
      if (!result.ok) throw new Error(result.error);
    } catch (err) {
      setStates((current) => new Map(current).set(previous.goal_id, previous));
      markError();
      toast.error(err instanceof Error ? err.message : "We could not save the goal.");
    }
  }

  const { debounced: persistDebounced } = useDebouncedCallback(
    (next: GoalState, previous: GoalState) => void persist(next, previous),
    600,
  );

  function update(goalId: string, patch: Partial<GoalState>, debounce = false) {
    const previous = states.get(goalId) ?? {
      goal_id: goalId,
      attained: false,
      attained_on: null,
      other_text: null,
    };
    const next: GoalState = { ...previous, ...patch };
    setStates((current) => new Map(current).set(goalId, next));
    if (debounce) persistDebounced(next, previous);
    else void persist(next, previous);
  }

  const allStates = [...states.values()];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">
          Check each goal when the student attains it. Goals marked with an asterisk (*) are the ones the
          program specifically tracks. You do not need to do anything different for them.
        </p>
        <SaveIndicator status={status} />
      </div>
      <div className="space-y-3">
        {groups.map((group) => {
          const attained = countAttained(allStates, group.goals.map((g) => g.id));
          const open = openCategories.has(group.category);
          return (
            <Collapsible
              key={group.category}
              open={open}
              onOpenChange={(next) =>
                setOpenCategories((current) => {
                  const copy = new Set(current);
                  if (next) copy.add(group.category);
                  else copy.delete(group.category);
                  return copy;
                })
              }
              className="rounded-lg border border-gray-200 bg-white shadow-sm"
            >
              <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-lg">
                <span className="font-medium text-gray-900">
                  {group.category}. {group.label}
                </span>
                <span className="flex items-center gap-3 text-sm text-gray-600">
                  <span>
                    {attained} of {group.goals.length} attained
                  </span>
                  <ChevronDownIcon
                    className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="divide-y divide-gray-100 border-t border-gray-100">
                  {group.goals.map((goal) => (
                    <GoalRow
                      key={goal.id}
                      goal={goal}
                      state={states.get(goal.id)}
                      onChange={(patch, debounce) => update(goal.id, patch, debounce)}
                    />
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
        <CustomGoalsSection
          studentId={studentId}
          initial={initialCustomGoals}
          open={openCategories.has("E")}
          onOpenChange={(next) =>
            setOpenCategories((current) => {
              const copy = new Set(current);
              if (next) copy.add("E");
              else copy.delete("E");
              return copy;
            })
          }
          onSaving={track}
          onError={markError}
        />
      </div>
    </div>
  );
}

function GoalRow({
  goal,
  state,
  onChange,
}: {
  goal: GoalDefinition;
  state: GoalState | undefined;
  onChange: (patch: Partial<GoalState>, debounce?: boolean) => void;
}) {
  const attained = state?.attained ?? false;
  const checkboxId = `goal-${goal.id}`;
  const dateId = `goal-${goal.id}-date`;

  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <input
          id={checkboxId}
          type="checkbox"
          checked={attained}
          onChange={(e) =>
            onChange({
              attained: e.target.checked,
              attained_on: e.target.checked ? (state?.attained_on ?? todayISO()) : null,
            })
          }
          className="mt-1 size-4 shrink-0 cursor-pointer rounded border-gray-300 accent-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        />
        <div className="min-w-0 flex-1">
          <Label htmlFor={checkboxId} className="cursor-pointer font-normal text-gray-900">
            {goal.number}. {goal.label}
          </Label>
        </div>
      </div>
      {attained ? (
        <div className="flex items-center gap-2 sm:pl-4">
          <Label htmlFor={dateId} className="text-xs text-gray-500">
            Attained on
          </Label>
          <input
            id={dateId}
            type="date"
            value={state?.attained_on ?? ""}
            onChange={(e) => {
              if (e.target.value) onChange({ attained_on: e.target.value });
            }}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      ) : null}
    </li>
  );
}
