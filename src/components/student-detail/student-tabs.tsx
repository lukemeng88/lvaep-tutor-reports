"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type StudentTab = "days" | "goals";

// Tab state lives in the URL (?tab=goals) so links can open a specific tab.
export function StudentTabs({
  days,
  goals,
}: {
  days: React.ReactNode;
  goals: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current: StudentTab = searchParams.get("tab") === "goals" ? "goals" : "days";

  function setTab(value: string | number | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "goals") params.set("tab", "goals");
    else params.delete("tab");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <Tabs value={current} onValueChange={setTab} className="mt-6">
      <TabsList aria-label="Student record sections">
        <TabsTrigger value="days">Tutoring days</TabsTrigger>
        <TabsTrigger value="goals">Goals</TabsTrigger>
      </TabsList>
      <TabsContent value="days" className="mt-4">
        {days}
      </TabsContent>
      <TabsContent value="goals" className="mt-4">
        {goals}
      </TabsContent>
    </Tabs>
  );
}
