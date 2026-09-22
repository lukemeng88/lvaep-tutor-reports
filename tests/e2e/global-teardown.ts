import { adminClient, deleteUsersWhere, printDeleted } from "../../scripts/delete-users";

// Every account the end to end pass signs up has an @test.local address, so
// this removes all of them (and everything they own) once the run is over,
// whether it passed or not. Without the service role key there is nothing
// it can do, and it says so.

export default async function globalTeardown(): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY is not set: the @test.local accounts were left in place.");
    return;
  }
  const deleted = await deleteUsersWhere(adminClient(), (user) => (user.email ?? "").toLowerCase().endsWith("@test.local"));
  printDeleted(deleted, "No @test.local accounts to remove.");
}
