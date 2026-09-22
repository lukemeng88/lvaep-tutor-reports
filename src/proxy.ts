import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16 calls this file "proxy". It is the request middleware:
// it refreshes the Supabase session cookie and enforces sign-in and role routing.

const PUBLIC_PATHS = new Set(["/login", "/signup"]);
const STAFF_PREFIX = "/staff";
const TUTOR_PREFIXES = ["/home", "/students", "/hours"];

function homeFor(role: "tutor" | "staff" | null): string {
  return role === "staff" ? "/staff" : "/home";
}

export async function proxy(request: NextRequest) {
  const { response, userId, role } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.has(pathname);
  const isStaffRoute = pathname === STAFF_PREFIX || pathname.startsWith(`${STAFF_PREFIX}/`);
  const isTutorRoute = TUTOR_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!userId) {
    if (isPublic) return response;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Signed in. Keep users on the pages that match their role.
  if (isPublic || pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = homeFor(role);
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (isStaffRoute && role !== "staff") {
    const url = request.nextUrl.clone();
    url.pathname = homeFor(role);
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (isTutorRoute && role !== "tutor") {
    const url = request.nextUrl.clone();
    url.pathname = homeFor(role);
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Run on every route except static assets and images.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
