import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageHeader } from "@/components/layout/page-header";
import { requireTutor } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Hours" };

export default async function HoursPage() {
  await requireTutor();
  return (
    <div>
      <Breadcrumbs items={[{ label: "Home", href: "/home" }, { label: "Hours" }]} />
      <PageHeader title="Hours" description="Hours per month for the current fiscal year." />
      <p className="text-sm text-gray-600">Chart coming in a later phase.</p>
    </div>
  );
}
