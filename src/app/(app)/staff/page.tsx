import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { requireStaff } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Staff home" };

export default async function StaffPage() {
  const user = await requireStaff();
  return (
    <div>
      <PageHeader title={`Welcome, ${user.profile.full_name}`} description="Tutors, students and submitted reports." />
      <p className="text-sm text-gray-600">Staff views coming in a later phase.</p>
    </div>
  );
}
