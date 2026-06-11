// Shapes for Web Push + daily reminders.
//
// NOTE (flagged divergence — see PR description): the v1 schema has no table for
// push subscriptions or reminder preferences, and the build contract says "don't
// change the schema." So these live in Supabase Auth `user_metadata` (alongside
// the existing `username`) — no migration, and the username→synthetic-email auth
// model is untouched. A dedicated `push_subscriptions` table is the right home if
// Carding productizes (multi-device, querying at scale); that's a future,
// serialized schema PR, not this stream's call.

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

// Everything Carding stores under auth user_metadata.
export type CardingUserMetadata = {
  username?: string;
  reminder?: ReminderPrefs;
  pushSubscriptions?: StoredPushSubscription[];
};

export const DEFAULT_REMINDER: ReminderPrefs = {
  enabled: false,
  time: "08:00",
  tz: "UTC",
};
