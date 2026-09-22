import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create an account" };

export default function SignupPage() {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">Create an account</h2>
      <p className="mt-1 text-sm text-gray-600">
        Tutors use this app to record sessions. Staff use it to review reports.
      </p>
      <div className="mt-6">
        <SignupForm />
      </div>
      <p className="mt-6 text-center text-sm text-gray-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
