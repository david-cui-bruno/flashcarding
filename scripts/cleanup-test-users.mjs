// One-off: delete the walk* e2e test users (cascade-deletes their data). Run:
//   set -a; . ./.env.local; set +a; node scripts/cleanup-test-users.mjs
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

let deleted = 0;
for (let page = 1; page <= 20; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
  if (error) throw error;
  const users = data?.users ?? [];
  if (users.length === 0) break;
  for (const u of users) {
    if ((u.email ?? "").startsWith("walk") && (u.email ?? "").endsWith("@carding.local")) {
      await admin.auth.admin.deleteUser(u.id);
      deleted++;
      console.log("deleted", u.email);
    }
  }
  if (users.length < 100) break;
}
console.log(`done — ${deleted} test user(s) removed`);
