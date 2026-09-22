"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTutor } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { planWeeklyRecurrence } from "@/lib/recurrence";
import { isQuarterHours } from "@/lib/sessions";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.");
const hoursSchema = z
  .number()
  .refine(isQuarterHours, "Hours must be between 0 and 12 in steps of 0.25.");
const codeSchema = z.enum(["TA", "SA", "H"]).nullable();

const addSessionSchema = z
  .object({
    studentId: z.string().uuid(),
    date: isoDate,
    hours: hoursSchema,
    code: codeSchema.default(null),
    repeatWeekly: z.boolean().default(false),
  })
  .refine((v) => v.code === null || v.hours === 0, "A day with an absence or holiday code has 0 hours.");

export type AddSessionInput = z.input<typeof addSessionSchema>;

const scopeSchema = z.enum(["this", "future"]);

const updateSessionSchema = z
  .object({
    sessionId: z.string().uuid(),
    hours: hoursSchema,
    code: codeSchema,
    scope: scopeSchema.default("this"),
  })
  .refine((v) => v.code === null || v.hours === 0, "A day with an absence or holiday code has 0 hours.");

export type UpdateSessionInput = z.input<typeof updateSessionSchema>;

const deleteSessionSchema = z.object({
  sessionId: z.string().uuid(),
  scope: scopeSchema.default("this"),
});

export type DeleteSessionInput = z.input<typeof deleteSessionSchema>;

function revalidate(studentId: string) {
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/home");
  revalidatePath("/hours");
}

export type AddSessionResult = { created: number; skipped: number };

export async function addSession(input: AddSessionInput): Promise<ActionResult<AddSessionResult>> {
  const user = await requireTutor();
  const parsed = addSessionSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the session details.");
  const { studentId, date, hours, code, repeatWeekly } = parsed.data;

  const supabase = await createClient();

  if (!repeatWeekly) {
    const { error } = await supabase.from("sessions").insert({
      student_id: studentId,
      tutor_id: user.id,
      session_date: date,
      hours,
      code,
    });
    if (error) {
      if (error.code === "23505") return fail("There is already a session on that day.");
      return fail("We could not add the session. Please try again.");
    }
    revalidate(studentId);
    return ok({ created: 1, skipped: 0 });
  }

  // Weekly: plan the dates here (tested logic), then create the rule and
  // every session in one database transaction.
  const { data: existing, error: existingError } = await supabase
    .from("sessions")
    .select("session_date")
    .eq("student_id", studentId)
    .gte("session_date", date);
  if (existingError) return fail("We could not check existing sessions. Please try again.");

  const plan = planWeeklyRecurrence(date, existing.map((s) => s.session_date));
  const { error } = await supabase.rpc("create_recurring_sessions", {
    p_student_id: studentId,
    p_weekday: plan.weekday,
    p_start_date: plan.startDate,
    p_end_date: plan.endDate,
    p_hours: hours,
    p_dates: plan.dates,
  });
  if (error) return fail("We could not add the weekly sessions. Please try again.");

  revalidate(studentId);
  return ok({ created: plan.dates.length, skipped: plan.skipped.length });
}

async function loadOwnSession(sessionId: string, tutorId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("id, student_id, session_date, recurrence_rule_id")
    .eq("id", sessionId)
    .eq("tutor_id", tutorId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateSession(input: UpdateSessionInput): Promise<ActionResult<{ updated: number }>> {
  const user = await requireTutor();
  const parsed = updateSessionSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the session details.");
  const { sessionId, hours, code, scope } = parsed.data;

  const session = await loadOwnSession(sessionId, user.id);
  if (!session) return fail("That session could not be found.");

  const supabase = await createClient();

  if (scope === "future" && session.recurrence_rule_id) {
    const { data, error } = await supabase.rpc("update_recurring_sessions_from", {
      p_rule_id: session.recurrence_rule_id,
      p_from_date: session.session_date,
      p_hours: hours,
      p_code: code,
    });
    if (error) return fail("We could not update the sessions. Please try again.");
    revalidate(session.student_id);
    return ok({ updated: data ?? 0 });
  }

  const { error } = await supabase
    .from("sessions")
    .update({ hours, code })
    .eq("id", sessionId)
    .eq("tutor_id", user.id);
  if (error) return fail("We could not update the session. Please try again.");

  revalidate(session.student_id);
  return ok({ updated: 1 });
}

export async function deleteSession(input: DeleteSessionInput): Promise<ActionResult<{ deleted: number }>> {
  const user = await requireTutor();
  const parsed = deleteSessionSchema.safeParse(input);
  if (!parsed.success) return fail("That session could not be found.");
  const { sessionId, scope } = parsed.data;

  const session = await loadOwnSession(sessionId, user.id);
  if (!session) return fail("That session could not be found.");

  const supabase = await createClient();

  if (scope === "future" && session.recurrence_rule_id) {
    const { data, error } = await supabase.rpc("delete_recurring_sessions_from", {
      p_rule_id: session.recurrence_rule_id,
      p_from_date: session.session_date,
    });
    if (error) return fail("We could not delete the sessions. Please try again.");
    revalidate(session.student_id);
    return ok({ deleted: data ?? 0 });
  }

  const { error } = await supabase.from("sessions").delete().eq("id", sessionId).eq("tutor_id", user.id);
  if (error) return fail("We could not delete the session. Please try again.");

  // A weekly schedule with no days left is removed so it does not linger.
  if (session.recurrence_rule_id) {
    const { count } = await supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("recurrence_rule_id", session.recurrence_rule_id);
    if (count === 0) {
      await supabase.from("recurrence_rules").delete().eq("id", session.recurrence_rule_id);
    }
  }

  revalidate(session.student_id);
  return ok({ deleted: 1 });
}
