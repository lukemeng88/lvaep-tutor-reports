import type { GoalAchievement, GoalCategory, GoalDefinition } from "@/lib/supabase/database.types";

export const GOAL_CATEGORIES: GoalCategory[] = ["A", "B", "C", "D", "E"];

// The state of one goal for one student, as shown on the Goals tab and stored
// in report snapshots.
export type GoalState = {
  goal_id: string;
  attained: boolean;
  attained_on: string | null;
  other_text: string | null;
};

export type GoalGroup = {
  category: GoalCategory;
  label: string;
  goals: GoalDefinition[];
};

export function groupGoals(definitions: GoalDefinition[]): GoalGroup[] {
  return GOAL_CATEGORIES.map((category) => {
    const goals = definitions
      .filter((g) => g.category === category)
      .sort((a, b) => a.number - b.number);
    return { category, label: goals[0]?.category_label ?? category, goals };
  }).filter((group) => group.goals.length > 0);
}

export function toGoalStates(
  definitions: GoalDefinition[],
  achievements: Pick<GoalAchievement, "goal_id" | "attained" | "attained_on" | "other_text">[],
): GoalState[] {
  const byId = new Map(achievements.map((a) => [a.goal_id, a]));
  return definitions.map((d) => {
    const a = byId.get(d.id);
    return {
      goal_id: d.id,
      attained: a?.attained ?? false,
      attained_on: a?.attained_on ?? null,
      other_text: a?.other_text ?? null,
    };
  });
}

export function countAttained(states: GoalState[], goalIds: string[]): number {
  const ids = new Set(goalIds);
  return states.filter((s) => ids.has(s.goal_id) && s.attained).length;
}
