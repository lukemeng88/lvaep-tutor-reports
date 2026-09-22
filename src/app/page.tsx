import { redirect } from "next/navigation";

// The proxy sends signed-in users to their home page. Anyone who reaches
// this page is signed out, so send them to the login page.
export default function RootPage() {
  redirect("/login");
}
