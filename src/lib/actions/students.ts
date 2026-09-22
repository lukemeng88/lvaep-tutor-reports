"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTutor } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import type { Student } from "@/lib/supabase/database.types";

// Days and times are no longer typed on a student: the form's Day(s) come
// from the weekly schedules and Time(s) from the sessions themselves.
const studentFieldsSchema = z.object({
  fullName: z.string().trim().min(1, "Enter the student's full name.").max(200),
  tutoringSite: z.string().trim().min(1, "Enter the tutoring site.").max(200),
});

export type StudentFields = z.input<typeof studentFieldsSchema>;

const idSchema = z.string().uuid();

function revalidateStudent(studentId?: string) {
  revalidatePath("/home");
  revalidatePath("/hours");
  if (studentId) revalidatePath(`/students/${studentId}`);
}

export async function createStudent(input: StudentFields): Promise<ActionResult<{ id: string }>> {
  const user = await requireTutor();
  const parsed = studentFieldsSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .insert({
      tutor_id: user.id,
      full_name: parsed.data.fullName,
      tutoring_site: parsed.data.tutoringSite,
    })
    .select("id")
    .single();
  if (error) return fail("We could not add the student. Please try again.");

  revalidateStudent(data.id);
  return ok({ id: data.id });
}

export async function updateStudent(
  studentId: string,
  input: StudentFields,
): Promise<ActionResult> {
  const user = await requireTutor();
  const id = idSchema.safeParse(studentId);
  const parsed = studentFieldsSchema.safeParse(input);
  if (!id.success) return fail("That student could not be found.");
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form.");

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("students")
    .update(
      {
        full_name: parsed.data.fullName,
        tutoring_site: parsed.data.tutoringSite,
      },
      { count: "exact" },
    )
    .eq("id", id.data)
    .eq("tutor_id", user.id);
  if (error) return fail("We could not save the changes. Please try again.");
  if (!count) return fail("That student could not be found.");

  revalidateStudent(id.data);
  return ok(undefined);
}

// Inline edits from the student header: one field at a time.
const inlineFieldSchema = z.object({
  field: z.enum(["full_name", "tutoring_site"]),
  value: z.string().trim().max(200),
});

export async function updateStudentField(
  studentId: string,
  input: z.input<typeof inlineFieldSchema>,
): Promise<ActionResult> {
  const user = await requireTutor();
  const id = idSchema.safeParse(studentId);
  const parsed = inlineFieldSchema.safeParse(input);
  if (!id.success) return fail("That student could not be found.");
  if (!parsed.success) return fail("That value is not valid.");

  const { field, value } = parsed.data;
  if (!value) {
    return fail(field === "full_name" ? "The student's name cannot be empty." : "The tutoring site cannot be empty.");
  }

  const patch: Partial<Pick<Student, "full_name" | "tutoring_site">> =
    field === "full_name" ? { full_name: value } : { tutoring_site: value };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("students")
    .update(patch, { count: "exact" })
    .eq("id", id.data)
    .eq("tutor_id", user.id);
  if (error) return fail("We could not save the change. Please try again.");
  if (!count) return fail("That student could not be found.");

  revalidateStudent(id.data);
  return ok(undefined);
}

const stopSchema = z.object({
  reason: z.string().trim().min(3, "Please enter a reason.").max(500, "Keep the reason under 500 characters."),
});

export async function stopStudent(
  studentId: string,
  input: z.input<typeof stopSchema>,
): Promise<ActionResult> {
  const user = await requireTutor();
  const id = idSchema.safeParse(studentId);
  const parsed = stopSchema.safeParse(input);
  if (!id.success) return fail("That student could not be found.");
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please enter a reason.");

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("students")
    .update(
      { is_stopped: true, stopped_reason: parsed.data.reason, stopped_at: new Date().toISOString() },
      { count: "exact" },
    )
    .eq("id", id.data)
    .eq("tutor_id", user.id);
  if (error) return fail("We could not mark the student as stopped. Please try again.");
  if (!count) return fail("That student could not be found.");

  revalidateStudent(id.data);
  return ok(undefined);
}

export async function reactivateStudent(studentId: string): Promise<ActionResult> {
  const user = await requireTutor();
  const id = idSchema.safeParse(studentId);
  if (!id.success) return fail("That student could not be found.");

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("students")
    .update({ is_stopped: false, stopped_reason: null, stopped_at: null }, { count: "exact" })
    .eq("id", id.data)
    .eq("tutor_id", user.id);
  if (error) return fail("We could not reactivate the student. Please try again.");
  if (!count) return fail("That student could not be found.");

  revalidateStudent(id.data);
  return ok(undefined);
}
