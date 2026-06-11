// The daily-reminder job. Called by app/api/cron/reminders on a schedule.
// For each user who has enabled reminders and registered a device, if their local
// clock has reached their reminder time, they haven't been reminded yet today, and
// they actually have cards due, send a push to all their devices.
//
// Design: "fire on or after the set time, once per local day" (not "exactly at").
// This is robust to cron cadence and missed ticks — run it every 5–15 min.
//
// Storage: reminder prefs are columns on `profiles`, subscriptions rows in
// `push_subscriptions`. We query only profiles with reminders enabled (not every auth
// user). The service-role admin client bypasses RLS so it can read across users.
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "./web-push";
import { subscriptionFromRow } from "./types";

// Local "YYYY-MM-DD" and "HH:MM" for an instant in a given IANA timezone.
function localParts(now: Date, tz: string): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const hour = parts.hour === "24" ? "00" : parts.hour; // some engines emit 24 at midnight
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${hour}:${parts.minute}`,
  };
}

// Mirrors the study queue (docs/SCHEDULING.md, app/(app)/study/page.tsx):
// accepted/edited cards whose FSRS due time has passed.
async function dueCount(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  nowIso: string,
): Promise<number> {
  const { count, error } = await admin
    .from("cards")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("review_status", ["accepted", "edited"])
    .lte("due", nowIso);
  if (error) {
    console.error("[carding] dueCount failed for", userId, error.message);
    return 0;
  }
  return count ?? 0;
}

export type ReminderRunSummary = {
  scanned: number;
  notified: number;
  pushesSent: number;
  pruned: number;
  skipped: number;
};

export async function runReminders(now: Date): Promise<ReminderRunSummary> {
  const admin = createAdminClient();
  const nowIso = now.toISOString();
  const summary: ReminderRunSummary = {
    scanned: 0,
    notified: 0,
    pushesSent: 0,
    pruned: 0,
    skipped: 0,
  };

  // Only users who have actually enabled reminders.
  const { data: profs, error } = await admin
    .from("profiles")
    .select("id, reminder_time, reminder_tz, reminder_last_sent_on")
    .eq("reminder_enabled", true);
  if (error) throw error;

  for (const prof of profs ?? []) {
    summary.scanned++;

    let local: { date: string; time: string };
    try {
      local = localParts(now, prof.reminder_tz || "UTC");
    } catch {
      summary.skipped++;
      continue; // bad tz — don't crash the whole run
    }

    // Not yet reminder time today, or already reminded today.
    if (local.time < prof.reminder_time || prof.reminder_last_sent_on === local.date) {
      summary.skipped++;
      continue;
    }

    const { data: subRows } = await admin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth_key, expiration_time")
      .eq("user_id", prof.id);
    const subs = subRows ?? [];
    if (subs.length === 0) {
      summary.skipped++;
      continue;
    }

    const due = await dueCount(admin, prof.id, nowIso);
    if (due === 0) {
      // Nothing due — don't mark today as done, so it can fire later if cards come due.
      summary.skipped++;
      continue;
    }

    const payload = {
      title: "Carding",
      body: due === 1 ? "1 card is due. Time to study." : `${due} cards are due. Time to study.`,
      url: "/study",
      tag: "carding-reminder",
    };

    const expired: string[] = [];
    for (const row of subs) {
      const result = await sendPush(subscriptionFromRow(row), payload);
      if (result === "sent") summary.pushesSent++;
      else if (result === "expired") expired.push(row.endpoint);
    }

    if (expired.length) {
      await admin
        .from("push_subscriptions")
        .delete()
        .eq("user_id", prof.id)
        .in("endpoint", expired);
      summary.pruned += expired.length;
    }

    // Mark reminded-today so it doesn't fire again until tomorrow.
    const { error: updateErr } = await admin
      .from("profiles")
      .update({ reminder_last_sent_on: local.date })
      .eq("id", prof.id);
    if (updateErr) {
      console.error("[carding] failed to mark reminder sent for", prof.id, updateErr.message);
    }

    summary.notified++;
  }

  return summary;
}
