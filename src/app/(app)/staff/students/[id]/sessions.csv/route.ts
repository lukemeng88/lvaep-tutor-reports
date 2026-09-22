import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getStaffStudentRecord } from "@/lib/data/staff";
import { assembleYearGrid, gridToCsv, pickSubmittedMonths } from "@/lib/record";

// Downloads every recorded day of the fiscal year as CSV. Same source as the
// record page: submitted snapshots by default, or live sessions with ?live=1.
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (user.profile.role !== "staff") return NextResponse.json({ error: "Staff only." }, { status: 403 });

  const { id } = await context.params;
  const fy = request.nextUrl.searchParams.get("fy");
  const live = request.nextUrl.searchParams.get("live") === "1";
  const version = request.nextUrl.searchParams.get("version");
  const record = await getStaffStudentRecord(id, fy && /^\d{4}$/.test(fy) ? Number(fy) : undefined);
  if (!record) return NextResponse.json({ error: "Student not found." }, { status: 404 });

  const pinnedId = version && record.reports.some((r) => r.id === version) ? version : null;
  const grid = assembleYearGrid({
    fiscalYear: record.fiscalYear,
    mode: live ? "live" : "submitted",
    submittedByMonth: pickSubmittedMonths(record.reports, pinnedId),
    liveSessions: record.liveSessions,
  });
  const csv = gridToCsv(grid, { studentName: record.student.full_name, tutorName: record.tutor.full_name });
  const safeName = record.student.full_name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "student";
  const filename = `${safeName}-sessions-${record.fiscalYear}-${record.fiscalYear + 1}${live ? "-live" : ""}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
