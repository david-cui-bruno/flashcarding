// Verifies the push_subscriptions table + profiles reminder_* columns are live and the
// reminder cron query works against the linked Supabase. No pushes are sent unless a user
// has reminders enabled + cards due (so it's safe to run).
//   set -a; . ./.env.local; set +a; pnpm exec tsx scripts/verify-push.ts
import { createAdminClient } from "../lib/supabase/admin";
import { runReminders } from "../lib/push/reminders";

(async () => {
  const admin = createAdminClient();

  const { error: tblErr, count } = await admin
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true });
  if (tblErr) throw new Error("push_subscriptions query failed: " + tblErr.message);
  console.log("✓ push_subscriptions table live; rows:", count ?? 0);

  const { error: profErr } = await admin
    .from("profiles")
    .select("id, reminder_enabled, reminder_time, reminder_tz, reminder_last_sent_on")
    .limit(1);
  if (profErr) throw new Error("profiles reminder_* query failed: " + profErr.message);
  console.log("✓ profiles reminder_* columns live");

  const summary = await runReminders(new Date());
  console.log("✓ runReminders ran end-to-end:", JSON.stringify(summary));

  console.log("\n✓ push storage verified against the live DB");
})().catch((e) => {
  console.error("✗", e?.message || String(e));
  process.exit(1);
});
