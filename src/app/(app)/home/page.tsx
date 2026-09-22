import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { AddStudentButton } from "@/components/students/add-student-button";
import { StudentCard } from "@/components/students/student-card";
import { TotalHoursCard } from "@/components/hours/total-hours-card";
import { requireTutor } from "@/lib/auth/session";
import { getTutorHomeData } from "@/lib/data/students";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage() {
  const user = await requireTutor();
  const data = await getTutorHomeData(user.id);

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user.profile.full_name}`}
        description="Record tutoring days for each student and submit a report at the end of every month."
        actions={<AddStudentButton />}
      />

      <TotalHoursCard totals={data.totals} fiscalYear={data.fiscalYear} today={data.today} />

      <section aria-labelledby="active-heading" className="mt-8">
        <h2 id="active-heading" className="text-lg font-semibold text-gray-900">
          Active students
          <span className="ml-2 text-sm font-normal text-gray-500">{data.active.length}</span>
        </h2>
        {data.active.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
            <p className="text-sm font-medium text-gray-900">No students yet</p>
            <p className="mt-1 text-sm text-gray-600">
              Use the Add student button to add the first learner you are tutoring.
            </p>
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {data.active.map((student) => (
              <StudentCard key={student.id} student={student} today={data.today} />
            ))}
          </ul>
        )}
      </section>

      {data.stopped.length > 0 ? (
        <section aria-labelledby="stopped-heading" className="mt-8">
          <h2 id="stopped-heading" className="text-lg font-semibold text-gray-700">
            Stopped students
            <span className="ml-2 text-sm font-normal text-gray-500">{data.stopped.length}</span>
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            These students are no longer being tutored. Their history is kept and they can be reactivated.
          </p>
          <ul className="mt-3 space-y-3">
            {data.stopped.map((student) => (
              <StudentCard key={student.id} student={student} today={data.today} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
