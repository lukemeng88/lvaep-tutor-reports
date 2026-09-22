"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronLeftIcon } from "lucide-react";
import type { StaffStudent, StaffTutor } from "@/lib/data/staff";
import { formatDateTime, formatLongDate } from "@/lib/format";
import { cn } from "@/lib/utils";

// Tutors on the left, the selected tutor's students in the middle. On narrow
// screens this becomes a drill-down: tutor list first, then students.
export function StaffBrowser({ tutors, students }: { tutors: StaffTutor[]; students: StaffStudent[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedTutorId = searchParams.get("tutor");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? tutors.filter((t) => t.fullName.toLowerCase().includes(q)) : tutors;
  }, [tutors, query]);

  const selectedTutor = tutors.find((t) => t.id === selectedTutorId) ?? null;
  const tutorStudents = selectedTutor ? students.filter((s) => s.tutor_id === selectedTutor.id) : [];
  const active = tutorStudents.filter((s) => !s.is_stopped);
  const stopped = tutorStudents.filter((s) => s.is_stopped);

  function selectTutor(id: string | null) {
    router.replace(id ? `${pathname}?tutor=${id}` : pathname, { scroll: false });
  }

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(220px,1fr)_2fr]">
      {/* Tutor list */}
      <section
        aria-labelledby="tutors-heading"
        className={cn("rounded-lg border border-gray-200 bg-white shadow-sm", selectedTutor && "hidden md:block")}
      >
        <div className="border-b border-gray-200 p-3">
          <h2 id="tutors-heading" className="text-sm font-semibold text-gray-900">
            Tutors <span className="font-normal text-gray-500">{tutors.length}</span>
          </h2>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tutors"
            aria-label="Search tutors"
            className="mt-2 h-8 w-full rounded-md border border-gray-300 px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        {filtered.length === 0 ? (
          <p className="p-4 text-sm text-gray-600">{tutors.length === 0 ? "No tutors have signed up yet." : "No tutors match your search."}</p>
        ) : (
          <ul className="max-h-[60vh] overflow-y-auto">
            {filtered.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => selectTutor(t.id)}
                  aria-current={t.id === selectedTutorId ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40",
                    t.id === selectedTutorId && "bg-accent text-accent-foreground",
                  )}
                >
                  <span className="font-medium">{t.fullName}</span>
                  <span className="shrink-0 text-xs text-gray-500">
                    {t.activeCount} active{t.stoppedCount ? `, ${t.stoppedCount} stopped` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Students of the selected tutor */}
      <section aria-labelledby="students-heading" className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-200 p-3">
          {selectedTutor ? (
            <button
              type="button"
              onClick={() => selectTutor(null)}
              className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 md:hidden"
            >
              <ChevronLeftIcon className="size-4" aria-hidden="true" /> Tutors
            </button>
          ) : null}
          <h2 id="students-heading" className="text-sm font-semibold text-gray-900">
            {selectedTutor ? `${selectedTutor.fullName}'s students` : "Students"}
          </h2>
        </div>
        {!selectedTutor ? (
          <p className="p-6 text-center text-sm text-gray-600">Select a tutor to see their students.</p>
        ) : tutorStudents.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-600">This tutor has no students yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            <StudentList students={active} />
            {stopped.length > 0 ? (
              <div className="bg-gray-50/60">
                <p className="px-3 pt-3 text-xs font-medium uppercase tracking-wide text-gray-500">Stopped</p>
                <StudentList students={stopped} />
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

function StudentList({ students }: { students: StaffStudent[] }) {
  if (students.length === 0) return null;
  return (
    <ul>
      {students.map((s) => (
        <li key={s.id}>
          <Link
            href={`/staff/students/${s.id}`}
            className={cn(
              "flex flex-col gap-0.5 px-3 py-2.5 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40",
              s.is_stopped && "opacity-70",
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-900">{s.full_name}</span>
              <span className="text-xs text-gray-500">
                {s.lastSubmittedAt ? `Last report ${formatDateTime(s.lastSubmittedAt)}` : "No reports yet"}
              </span>
            </span>
            <span className="text-xs text-gray-600">
              {s.tutoring_site}
              {s.is_stopped
                ? ` | Stopped${s.stopped_at ? ` ${formatLongDate(s.stopped_at.slice(0, 10))}` : ""}${s.stopped_reason ? `: ${s.stopped_reason}` : ""}`
                : ""}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
