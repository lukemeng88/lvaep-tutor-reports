import { adminClient, deleteUsersWhere, printDeleted } from "./delete-users.ts";

// Removes every account that is not one of the three demo accounts, along
// with everything it owns. Run it with `npm run cleanup:test-data`; it
// reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from
// .env.local. Follow it with the seed to put the demo data back in shape.

export const SEED_EMAILS = ["staff@lvaep.demo", "tutor1@lvaep.demo", "tutor2@lvaep.demo"];

const admin = adminClient();
const deleted = await deleteUsersWhere(admin, (user) => !SEED_EMAILS.includes((user.email ?? "").toLowerCase()));
printDeleted(deleted, "Nothing to remove: only the demo accounts exist.");
