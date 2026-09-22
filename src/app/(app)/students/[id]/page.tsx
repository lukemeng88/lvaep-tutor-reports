import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { StudentHeader } from "@/components/student-detail/student-header";
import { StudentTabs } from "@/components/student-detail/student-tabs";
import { GoalsTab } from "@/components/goals/goals-tab";
import { CalendarTab } from "@/components/calendar/calendar-tab";
import { requireTutor } from "@/lib/auth/session";
import { getStudentForTutor } from "@/lib/data/students";
import { getGoalAchievements, getGoalDefinitions } from "@/lib/data/goals";
import { groupGoals, toGoalStates } from "@/lib/goals";
import { getStudentSessions } from "@/lib/data/sessions";
import { todayISO } from "@/lib/fiscal-year";

type Params = { id: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const user = await requireTutor();
  const student = await getStudentForTutor(user.id, id);
  return { title: student?.full_name ?? "Student" };
}

export default async function StudentPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const user = await requireTutor();
  const student = await getStudentForTutor(user.id, id);
  if (!student) notFound();

  const [definitions, achievements, sessions] = await Promise.all([
    getGoalDefinitions(),
    getGoalAchievements(student.id),
    getStudentSessions(student.id),
  ]);

  return (
    <div>
      <Breadcrumbs items={[{ label: "Home", href: "/home" }, { label: student.full_name }]} />
      <StudentHeader student={student} />
      <StudentTabs
        days={<CalendarTab studentId={student.id} sessions={sessions} today={todayISO()} />}
        goals={
          <GoalsTab
            studentId={student.id}
            groups={groupGoals(definitions)}
            initialStates={toGoalStates(definitions, achievements)}
          />
        }
      />
    </div>
  );
}
