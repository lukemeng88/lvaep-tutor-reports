"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTutor } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/actions/result";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.");

const goalInputSchema = z.object({
  studentId: z.string().uuid(),
  goalId: z.string().regex(/^[A-E]\d+$/),
  attained: z.boolean(),
  attainedOn: isoDate.nullable(),
  otherText: z.string().trim().max(500).nullable(),
});

export type GoalInput = z.input<typeof goalInputSchema>;

export async function saveGoal(input: GoalInput): Promise<ActionResult> {
  const user = await requireTutor();
  const parsed = goalInputSchema.safeParse(input);
  if (!parsed.success) return fail("That goal update is not valid.");

  const { studentId, goalId, attained, attainedOn, otherText } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("goal_achievements").upsert(
    {
      student_id: studentId,
      tutor_id: user.id,
      goal_id: goalId,
      attained,
      attained_on: attained ? attainedOn : null,
      other_text: goalId.startsWith("E") ? otherText || null : null,
    },
    { onConflict: "student_id,goal_id" },
  );
  if (error) return fail("We could not save the goal. Please try again.");

  revalidatePath(`/students/${studentId}`);
  revalidatePath("/home");
  return ok(undefined);
}
