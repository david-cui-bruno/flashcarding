import type { Metadata } from "next";
import { getReminderState } from "@/lib/push/store";
import { isPushConfigured } from "@/lib/push/web-push";
import { DEFAULT_REMINDER } from "@/lib/push/types";
import { SettingsClient } from "./settings-client";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const state = await getReminderState();
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>
      <SettingsClient
        initialPrefs={state?.prefs ?? DEFAULT_REMINDER}
        initialSubscriptionCount={state?.subscriptionCount ?? 0}
        vapidPublicKey={vapidPublicKey}
        pushConfigured={isPushConfigured()}
      />
    </div>
  );
}
