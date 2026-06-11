// The daily-reminder job. Called by app/api/cron/reminders on a schedule.
// For each user who has enabled reminders and registered a device, if their local
// clock has reached their reminder time, they haven't been reminded yet today, and
// they actually have cards due, send a push to all their devices.
//
// Design: "fire on or after the set time, once per local day" (not "exactly at").
// This is robust to cron cadence and missed ticks — run it every 5–15 min.
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "./web-push";
import type { CardingUserMetadata, StoredPushSubscription } from "./types";

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

  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const users = data?.users ?? [];
    if (users.length === 0) break;

    for (const user of users) {
      summary.scanned++;
      const meta = (user.user_metadata ?? {}) as CardingUserMetadata;
      const reminder = meta.reminder;
      const subs: StoredPushSubscription[] = meta.pushSubscriptions ?? [];

      if (!reminder?.enabled || subs.length === 0) {
        summary.skipped++;
        continue;
      }

      let local: { date: string; time: string };
      try {
        local = localParts(now, reminder.tz || "UTC");
      } catch {
        summary.skipped++;
        continue; // bad tz — don't crash the whole run
      }

      // Not yet reminder time today, or already reminded today.
      if (local.time < reminder.time || reminder.lastSentOn === local.date) {
        summary.skipped++;
        continue;
      }

      const due = await dueCount(admin, user.id, nowIso);
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
      for (const sub of subs) {
        const result = await sendPush(sub, payload);
        if (result === "sent") summary.pushesSent++;
        else if (result === "expired") expired.push(sub.endpoint);
      }

      const remainingSubs = expired.length
        ? subs.filter((s) => !expired.includes(s.endpoint))
        : subs;
      summary.pruned += expired.length;

      // Merge back: mark reminded-today and persist any subscription pruning.
      const nextMeta: CardingUserMetadata = {
        ...meta,
        reminder: { ...reminder, lastSentOn: local.date },
        pushSubscriptions: remainingSubs,
      };
      const { error: updateErr } = await admin.auth.admin.updateUserById(user.id, {
        user_metadata: nextMeta,
      });
      if (updateErr) console.error("[carding] failed to update meta for", user.id, updateErr.message);

      summary.notified++;
    }

    if (users.length < 100) break;
  }

  return summary;
}
