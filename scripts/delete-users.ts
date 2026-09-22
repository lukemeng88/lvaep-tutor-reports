import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

/**
 * Removes auth users through the service role. Deleting an auth user
 * cascades to the profile, and from there to the tutor's students,
 * sessions, recurrence rules, goal achievements, custom goals and reports.
 * The counts of those rows are gathered first so the caller can say what
 * went.
 */

export type Deleted = {
  email: string;
  role: string;
  students: number;
  sessions: number;
  rules: number;
  goals: number;
  customGoals: number;
  reports: number;
};

const CHILD_TABLES: [keyof Omit<Deleted, "email" | "role">, string][] = [
  ["students", "students"],
  ["sessions", "sessions"],
  ["rules", "recurrence_rules"],
  ["goals", "goal_achievements"],
  ["customGoals", "custom_goals"],
  ["reports", "monthly_reports"],
];

export function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.local).");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Every auth user, across pages. */
export async function listAllUsers(admin: SupabaseClient): Promise<User[]> {
  const users: User[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Could not list users: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

async function countFor(admin: SupabaseClient, table: string, tutorId: string): Promise<number> {
  const { count, error } = await admin.from(table).select("id", { count: "exact", head: true }).eq("tutor_id", tutorId);
  if (error) throw new Error(`Could not count ${table}: ${error.message}`);
  return count ?? 0;
}

/** Deletes every user the predicate picks and reports what went with each. */
export async function deleteUsersWhere(admin: SupabaseClient, pick: (user: User) => boolean): Promise<Deleted[]> {
  const deleted: Deleted[] = [];
  for (const user of await listAllUsers(admin)) {
    if (!pick(user)) continue;
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    const row: Deleted = {
      email: user.email ?? user.id,
      role: (profile as { role?: string } | null)?.role ?? "(no profile)",
      students: 0,
      sessions: 0,
      rules: 0,
      goals: 0,
      customGoals: 0,
      reports: 0,
    };
    for (const [field, table] of CHILD_TABLES) row[field] = await countFor(admin, table, user.id);
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw new Error(`Could not delete ${row.email}: ${error.message}`);
    deleted.push(row);
  }
  return deleted;
}

/** One line per user, then totals. */
export function printDeleted(deleted: Deleted[], nothing: string): void {
  if (deleted.length === 0) {
    console.log(nothing);
    return;
  }
  const total: Deleted = { email: "total", role: "", students: 0, sessions: 0, rules: 0, goals: 0, customGoals: 0, reports: 0 };
  for (const d of deleted) {
    console.log(
      `deleted ${d.email} (${d.role}): ${d.students} students, ${d.sessions} sessions, ${d.rules} rules, ${d.goals} goals, ${d.customGoals} custom goals, ${d.reports} reports`,
    );
    for (const [field] of CHILD_TABLES) total[field] += d[field];
  }
  console.log(
    `${deleted.length} users removed with ${total.students} students, ${total.sessions} sessions, ${total.rules} rules, ${total.goals} goals, ${total.customGoals} custom goals and ${total.reports} reports.`,
  );
}
