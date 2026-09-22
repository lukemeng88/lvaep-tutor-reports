import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { GoalAchievement, GoalDefinition } from "@/lib/supabase/database.types";

export async function getGoalDefinitions(): Promise<GoalDefinition[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goal_definitions")
    .select("*")
    .order("category")
    .order("number");
  if (error) throw new Error(error.message);
  return data;
}

export async function getGoalAchievements(studentId: string): Promise<GoalAchievement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goal_achievements")
    .select("*")
    .eq("student_id", studentId);
  if (error) throw new Error(error.message);
  return data;
}
