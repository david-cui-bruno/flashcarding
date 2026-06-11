"use server";

import {
  addPushSubscription,
  removePushSubscription,
  saveReminderPrefs,
  sendToCurrentUser,
} from "@/lib/push/store";
import type { StoredPushSubscription } from "@/lib/push/types";

export async function savePushSubscriptionAction(sub: StoredPushSubscription) {
  await addPushSubscription(sub);
  return { ok: true as const };
}

export async function removePushSubscriptionAction(endpoint: string) {
  await removePushSubscription(endpoint);
  return { ok: true as const };
}

export async function saveReminderPrefsAction(input: {
  enabled: boolean;
  time: string;
  tz: string;
}) {
  return saveReminderPrefs(input);
}

export async function sendTestNotificationAction() {
  try {
    const result = await sendToCurrentUser({
      title: "Carding",
      body: "This is a test reminder. Notifications are working 🎉",
      url: "/study",
      tag: "carding-test",
    });
    if (result.total === 0) {
      return { ok: false as const, error: "No device is subscribed yet. Enable notifications first." };
    }
    if (result.sent === 0) {
      return { ok: false as const, error: "Could not deliver to any device. Try re-enabling notifications." };
    }
    return { ok: true as const, sent: result.sent };
  } catch (err) {
    return { ok: false as const, error: (err as Error)?.message ?? "Failed to send test notification." };
  }
}
