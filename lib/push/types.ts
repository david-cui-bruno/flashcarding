// Shapes for Web Push + daily reminders.
//
// Storage: push subscriptions live in the `push_subscriptions` table (one row per device)
// and reminder preferences live as `reminder_*` columns on `profiles` (1:1 with the user) —
// see supabase/migrations/20260611120000_push_subscriptions.sql. (Earlier v1 stored these in
// Auth user_metadata as a frozen-schema stopgap; that's been retired.)

import type { Database } from "@/lib/types/database";

// A browser PushSubscription serialized via `.toJSON()` — the shape web-push wants.
export type StoredPushSubscription = {
  endpoint: string;
  expirationTime: number | null;
  keys: { p256dh: string; auth: string };
};

export type ReminderPrefs = {
  enabled: boolean;
  time: string; // "HH:MM" 24h, in the user's timezone
  tz: string; // IANA zone, e.g. "America/Chicago"
  lastSentOn?: string | null; // "YYYY-MM-DD" in tz — once-per-day dedup guard
};

// Only the username lives in Auth user_metadata now (set at signup, used by the layout).
export type DoryUserMetadata = {
  username?: string;
};

export const DEFAULT_REMINDER: ReminderPrefs = {
  enabled: false,
  time: "08:00",
  tz: "UTC",
};

export type PushSubscriptionRow = Database["public"]["Tables"]["push_subscriptions"]["Row"];

/** Map a push_subscriptions row to the web-push subscription shape. */
export function subscriptionFromRow(
  r: Pick<PushSubscriptionRow, "endpoint" | "p256dh" | "auth_key" | "expiration_time">,
): StoredPushSubscription {
  return {
    endpoint: r.endpoint,
    expirationTime: r.expiration_time,
    keys: { p256dh: r.p256dh, auth: r.auth_key },
  };
}
