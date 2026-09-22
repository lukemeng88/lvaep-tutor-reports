"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUp, type AuthFormState } from "../actions";

const initialState: AuthFormState = { error: null };

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signUp, initialState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" name="fullName" autoComplete="name" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        <p className="text-xs text-gray-500">At least 8 characters.</p>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-900">Your role</legend>
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm has-checked:border-primary has-checked:bg-accent">
          <input type="radio" name="role" value="tutor" defaultChecked className="accent-primary" />
          I am a tutor
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm has-checked:border-primary has-checked:bg-accent">
          <input type="radio" name="role" value="staff" className="accent-primary" />
          I am staff
        </label>
      </fieldset>
      {state.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating account" : "Create account"}
      </Button>
    </form>
  );
}
