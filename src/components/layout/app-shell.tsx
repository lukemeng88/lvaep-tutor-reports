import Link from "next/link";
import type { CurrentUser } from "@/lib/auth/session";
import { signOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { NavLinks } from "./nav-links";

const TUTOR_LINKS = [
  { href: "/home", label: "Home" },
  { href: "/hours", label: "Hours" },
];

const STAFF_LINKS = [{ href: "/staff", label: "Staff home" }];

export function AppShell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  const links = user.profile.role === "staff" ? STAFF_LINKS : TUTOR_LINKS;
  const home = links[0].href;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="print-hidden sticky top-0 z-40 border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href={home} className="flex items-baseline gap-1.5 font-semibold text-gray-900">
            <span className="text-primary">LVAEP</span>
            <span className="hidden sm:inline">Tutor Reports</span>
          </Link>
          <NavLinks links={links} />
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden truncate text-sm text-gray-600 sm:inline" title={user.email}>
              {user.profile.full_name}
              <span className="ml-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                {user.profile.role === "staff" ? "Staff" : "Tutor"}
              </span>
            </span>
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      <footer className="print-hidden border-t border-gray-200 bg-white py-4 text-center text-xs text-gray-500">
        Literacy Volunteers of America, Essex/Passaic County. Bloomfield Public Library, 90 Broad Street,
        Bloomfield, NJ 07003. info@lvaep.org, (973) 566-6200 x216
      </footer>
    </div>
  );
}
