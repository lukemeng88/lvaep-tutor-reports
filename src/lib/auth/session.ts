import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Role } from "@/lib/supabase/database.types";

export type CurrentUser = {
  id: string;
  email: string;
  profile: Profile;
};

// Cached per request so layouts and pages share one lookup.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return null;

  return { id: user.id, email: user.email ?? "", profile };
});

export function homePathFor(role: Role): string {
  return role === "staff" ? "/staff" : "/home";
}

// The proxy already redirects, but pages and actions check again so data
// access never depends on middleware alone.
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(role: Role): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.profile.role !== role) redirect(homePathFor(user.profile.role));
  return user;
}

export const requireTutor = () => requireRole("tutor");
export const requireStaff = () => requireRole("staff");
