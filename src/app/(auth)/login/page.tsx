import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">Sign in</h2>
      <p className="mt-1 text-sm text-gray-600">Welcome back. Enter your email and password.</p>
      <div className="mt-6">
        <LoginForm next={next} />
      </div>
      <p className="mt-6 text-center text-sm text-gray-600">
        New here?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
