// Read/write the current user's reminder prefs + push subscriptions, stored in
// Supabase Auth user_metadata (see lib/push/types.ts for why). Session-scoped:
// every call resolves the logged-in user from their cookie session.
import { createClient } from "@/lib/supabase/server";
import { sendPush, type PushPayload } from "./web-push";
import {
  DEFAULT_REMINDER,
  type CardingUserMetadata,
  type ReminderPrefs,
  type StoredPushSubscription,
} from "./types";

async function getSessionMeta() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user, meta: (user.user_metadata ?? {}) as CardingUserMetadata };
}

// Merge a patch into user_metadata without dropping other keys (e.g. username).
async function patchMeta(patch: Partial<CardingUserMetadata>) {
  const ctx = await getSessionMeta();
  if (!ctx) throw new Error("Not authenticated");
  const merged = { ...ctx.meta, ...patch };
  const { error } = await ctx.supabase.auth.updateUser({ data: merged });
  if (error) throw error;
}

export type ReminderState = {
  prefs: ReminderPrefs;
  subscriptionCount: number;
};

export async function getReminderState(): Promise<ReminderState | null> {
  const ctx = await getSessionMeta();
  if (!ctx) return null;
  return {
    prefs: { ...DEFAULT_REMINDER, ...(ctx.meta.reminder ?? {}) },
    subscriptionCount: ctx.meta.pushSubscriptions?.length ?? 0,
  };
}

export async function addPushSubscription(sub: StoredPushSubscription) {
  const ctx = await getSessionMeta();
  if (!ctx) throw new Error("Not authenticated");
  const existing = ctx.meta.pushSubscriptions ?? [];
  // Dedup by endpoint so re-subscribing the same device doesn't pile up.
  const next = [...existing.filter((s) => s.endpoint !== sub.endpoint), sub];
  await patchMeta({ pushSubscriptions: next });
}

export async function removePushSubscription(endpoint: string) {
  const ctx = await getSessionMeta();
  if (!ctx) throw new Error("Not authenticated");
  const next = (ctx.meta.pushSubscriptions ?? []).filter((s) => s.endpoint !== endpoint);
  await patchMeta({ pushSubscriptions: next });
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
  const tz = isValidTz(input.tz) ? input.tz : "UTC";
  // Reset the dedup guard so a freshly-changed reminder can still fire today.
  const prefs: ReminderPrefs = {
    enabled: input.enabled,
    time: input.time,
    tz,
    lastSentOn: null,
  };
  await patchMeta({ reminder: prefs });
  return { ok: true };
}

// Send a notification to all of the current user's devices (the "send test" button).
export async function sendToCurrentUser(
  payload: PushPayload,
): Promise<{ sent: number; expired: number; total: number }> {
  const ctx = await getSessionMeta();
  if (!ctx) throw new Error("Not authenticated");
  const subs = ctx.meta.pushSubscriptions ?? [];
  let sent = 0;
  const expired: string[] = [];
  for (const sub of subs) {
    const result = await sendPush(sub, payload);
    if (result === "sent") sent++;
    else if (result === "expired") expired.push(sub.endpoint);
  }
  if (expired.length) {
    const next = subs.filter((s) => !expired.includes(s.endpoint));
    await patchMeta({ pushSubscriptions: next });
  }
  return { sent, expired: expired.length, total: subs.length };
}
