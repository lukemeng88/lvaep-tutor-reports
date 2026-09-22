import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { requireTutor } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage() {
  const user = await requireTutor();
  return (
    <div>
      <PageHeader title={`Welcome, ${user.profile.full_name}`} description="Your students and hours." />
      <p className="text-sm text-gray-600">Student list coming in the next phase.</p>
    </div>
  );
}
