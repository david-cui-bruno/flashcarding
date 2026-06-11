// Read/write the current user's reminder prefs + push subscriptions. Session-scoped:
// every call resolves the logged-in user from their cookie session, and RLS scopes the
// tables to that user. Prefs are columns on `profiles`; subscriptions rows in
// `push_subscriptions` (see lib/push/types.ts).
import { createClient } from "@/lib/supabase/server";
import { sendPush, type PushPayload } from "./web-push";
import {
  DEFAULT_REMINDER,
  subscriptionFromRow,
  type ReminderPrefs,
  type StoredPushSubscription,
} from "./types";

async function getSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user };
}

export type ReminderState = {
  prefs: ReminderPrefs;
  subscriptionCount: number;
};

export async function getReminderState(): Promise<ReminderState | null> {
  const ctx = await getSession();
  if (!ctx) return null;
  const { supabase, user } = ctx;

  const [{ data: prof }, { count }] = await Promise.all([
    supabase
      .from("profiles")
      .select("reminder_enabled, reminder_time, reminder_tz, reminder_last_sent_on")
      .eq("id", user.id)
      .single(),
    supabase
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  return {
    prefs: {
      enabled: prof?.reminder_enabled ?? DEFAULT_REMINDER.enabled,
      time: prof?.reminder_time ?? DEFAULT_REMINDER.time,
      tz: prof?.reminder_tz ?? DEFAULT_REMINDER.tz,
      lastSentOn: prof?.reminder_last_sent_on ?? null,
    },
    subscriptionCount: count ?? 0,
  };
}

export async function addPushSubscription(sub: StoredPushSubscription) {
  const ctx = await getSession();
  if (!ctx) throw new Error("Not authenticated");
  // Upsert on (user_id, endpoint) so re-subscribing the same device doesn't pile up.
  const { error } = await ctx.supabase.from("push_subscriptions").upsert(
    {
      user_id: ctx.user.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth_key: sub.keys.auth,
      expiration_time: sub.expirationTime,
    },
    { onConflict: "user_id,endpoint" },
  );
  if (error) throw error;
}

export async function removePushSubscription(endpoint: string) {
  const ctx = await getSession();
  if (!ctx) throw new Error("Not authenticated");
  const { error } = await ctx.supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", ctx.user.id)
    .eq("endpoint", endpoint);
  if (error) throw error;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function isValidTz(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function saveReminderPrefs(input: {
  enabled: boolean;
  time: string;
  tz: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!TIME_RE.test(input.time)) return { ok: false, error: "Pick a valid time." };
  const ctx = await getSession();
  if (!ctx) return { ok: false, error: "Not signed in." };
  const tz = isValidTz(input.tz) ? input.tz : "UTC";
  // Reset the dedup guard so a freshly-changed reminder can still fire today.
  const { error } = await ctx.supabase
    .from("profiles")
    .update({
      reminder_enabled: input.enabled,
      reminder_time: input.time,
      reminder_tz: tz,
      reminder_last_sent_on: null,
    })
    .eq("id", ctx.user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Send a notification to all of the current user's devices (the "send test" button).
export async function sendToCurrentUser(
  payload: PushPayload,
): Promise<{ sent: number; expired: number; total: number }> {
  const ctx = await getSession();
  if (!ctx) throw new Error("Not authenticated");
  const { data: rows } = await ctx.supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth_key, expiration_time")
    .eq("user_id", ctx.user.id);
  const subs = rows ?? [];

  let sent = 0;
  const expired: string[] = [];
  for (const row of subs) {
    const result = await sendPush(subscriptionFromRow(row), payload);
    if (result === "sent") sent++;
    else if (result === "expired") expired.push(row.endpoint);
  }
  if (expired.length) {
    await ctx.supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", ctx.user.id)
      .in("endpoint", expired);
  }
  return { sent, expired: expired.length, total: subs.length };
}
