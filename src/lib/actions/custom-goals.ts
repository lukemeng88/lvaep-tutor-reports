"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTutor } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import type { CustomGoal } from "@/lib/supabase/database.types";

// A tutor's own goals for a student, under E. Other(s). Row level security
// already limits every write to the tutor who owns the student; the checks
// here only give a clearer answer.

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.");
const label = z.string().trim().min(1, "Describe the goal.").max(500, "Keep the goal under 500 characters.");

const createSchema = z.object({
  studentId: z.string().uuid(),
  label,
  attained: z.boolean().default(false),
  attainedOn: isoDate.nullable().default(null),
  sortOrder: z.number().int().min(0).default(0),
});

export type CreateCustomGoalInput = z.input<typeof createSchema>;

const updateSchema = z.object({
  id: z.string().uuid(),
  label: label.optional(),
  attained: z.boolean().optional(),
  attainedOn: isoDate.nullable().optional(),
});

export type UpdateCustomGoalInput = z.input<typeof updateSchema>;

function revalidate(studentId: string) {
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/home");
}

export async function createCustomGoal(input: CreateCustomGoalInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireTutor();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "That goal is not valid.");
  const { studentId, attained, attainedOn, sortOrder } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custom_goals")
    .insert({
      student_id: studentId,
      tutor_id: user.id,
      label: parsed.data.label,
      attained,
      attained_on: attained ? attainedOn : null,
      sort_order: sortOrder,
    })
    .select("id")
    .single();
  if (error) return fail("We could not save the goal. Please try again.");

  revalidate(studentId);
  return ok({ id: data.id });
}

export async function updateCustomGoal(input: UpdateCustomGoalInput): Promise<ActionResult> {
  const user = await requireTutor();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "That goal is not valid.");
  const { id, attained, attainedOn } = parsed.data;

  const patch: Partial<Pick<CustomGoal, "label" | "attained" | "attained_on">> = {};
  if (parsed.data.label !== undefined) patch.label = parsed.data.label;
  if (attained !== undefined) {
    patch.attained = attained;
    patch.attained_on = attained ? (attainedOn ?? null) : null;
  } else if (attainedOn !== undefined) {
    patch.attained_on = attainedOn;
  }
  if (Object.keys(patch).length === 0) return ok(undefined);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custom_goals")
    .update(patch)
    .eq("id", id)
    .eq("tutor_id", user.id)
    .select("student_id")
    .maybeSingle();
  if (error) return fail("We could not save the goal. Please try again.");
  if (!data) return fail("That goal could not be found.");

  revalidate(data.student_id);
  return ok(undefined);
}

export async function deleteCustomGoal(id: string): Promise<ActionResult> {
  const user = await requireTutor();
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return fail("That goal could not be found.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custom_goals")
    .delete()
    .eq("id", parsed.data)
    .eq("tutor_id", user.id)
    .select("student_id")
    .maybeSingle();
  if (error) return fail("We could not remove the goal. Please try again.");
  if (!data) return fail("That goal could not be found.");

  revalidate(data.student_id);
  return ok(undefined);
}
