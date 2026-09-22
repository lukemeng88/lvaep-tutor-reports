"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { homePathFor } from "@/lib/auth/session";
import type { Role } from "@/lib/supabase/database.types";

export type AuthFormState = {
  error: string | null;
};

const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
  next: z.string().optional(),
});

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name."),
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Use a password with at least 8 characters."),
  role: z.enum(["tutor", "staff"], { message: "Choose whether you are a tutor or staff." }),
});

function safeNextPath(next: string | undefined, role: Role): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    const staffPath = next === "/staff" || next.startsWith("/staff/");
    if (role === "staff" && staffPath) return next;
    if (role === "tutor" && !staffPath) return next;
  }
  return homePathFor(role);
}

async function roleFor(userId: string): Promise<Role> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  return data?.role ?? "tutor";
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error || !data.user) {
    return { error: "That email and password did not match. Please try again." };
  }

  const role = await roleFor(data.user.id);
  redirect(safeNextPath(parsed.data.next, role));
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName, role: parsed.data.role },
    },
  });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("already") || message.includes("registered")) {
      return { error: "An account with that email already exists. Try signing in instead." };
    }
    return { error: "We could not create your account. Please try again." };
  }
  if (!data.session) {
    // Email confirmation is off for the demo. If it is on, the user has to confirm first.
    return {
      error: "Check your email to confirm your account, then sign in.",
    };
  }

  redirect(homePathFor(parsed.data.role));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
