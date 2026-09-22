import { CheckIcon } from "lucide-react";
import { groupGoals, type GoalState } from "@/lib/goals";
import { formatShortDate } from "@/lib/format";
import type { GoalDefinition } from "@/lib/supabase/database.types";

export function Achievements({ definitions, states }: { definitions: GoalDefinition[]; states: GoalState[] }) {
  const byId = new Map(states.map((s) => [s.goal_id, s]));
  const groups = groupGoals(definitions);
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900 print:text-xs">Achievements</h3>
      <p className="text-xs text-gray-600 print:text-[9px]">Place a check next to each student&apos;s goal when attained.</p>
      <div className="mt-2 grid gap-x-6 gap-y-3 sm:grid-cols-2 print:mt-1 print:grid-cols-3 print:gap-y-1 print:text-[9px]">
        {groups.map((group) => (
          <div key={group.category} className={group.category === "E" ? "sm:col-span-2 print:col-span-3" : ""}>
            <p className="text-xs font-semibold text-gray-900">
              {group.category}. {group.label}
            </p>
            <ul className="mt-0.5 space-y-0.5">
              {group.goals.map((goal) => {
                const state = byId.get(goal.id);
                const attained = state?.attained ?? false;
                return (
                  <li key={goal.id} className="flex items-start gap-1.5 text-xs text-gray-800 print:text-[9px] print:leading-tight">
                    <span
                      aria-label={attained ? "Attained" : "Not attained"}
                      className={`mt-px flex size-3.5 shrink-0 items-center justify-center rounded-sm border ${
                        attained ? "border-primary bg-primary text-white" : "border-gray-400 bg-white"
                      }`}
                    >
                      {attained ? <CheckIcon className="size-2.5" aria-hidden="true" /> : null}
                    </span>
                    <span>
                      {goal.number}. {group.category === "E" ? (state?.other_text ? state.other_text : "Other(s)") : goal.label}
                      {attained && state?.attained_on ? (
                        <span className="ml-1 text-gray-500">({formatShortDate(state.attained_on)})</span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
