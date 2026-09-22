import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { RecurrenceRule, Session } from "@/lib/supabase/database.types";

export type CalendarSession = Pick<
  Session,
  "id" | "session_date" | "hours" | "code" | "recurrence_rule_id" | "notes"
>;

export async function getStudentSessions(studentId: string): Promise<CalendarSession[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("id, session_date, hours, code, recurrence_rule_id, notes")
    .eq("student_id", studentId)
    .order("session_date");
  if (error) throw new Error(error.message);
  return data.map((s) => ({ ...s, hours: Number(s.hours) }));
}

export async function getStudentRules(studentId: string): Promise<RecurrenceRule[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurrence_rules")
    .select("*")
    .eq("student_id", studentId);
  if (error) throw new Error(error.message);
  return data.map((r) => ({ ...r, default_hours: Number(r.default_hours) }));
}
