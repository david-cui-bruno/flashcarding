import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getReminderState } from "@/lib/push/store";
import { isPushConfigured } from "@/lib/push/web-push";
import { DEFAULT_REMINDER } from "@/lib/push/types";
import { SettingsClient } from "./settings-client";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const [state, { data: { user } }] = await Promise.all([
    getReminderState(),
    supabase.auth.getUser(),
  ]);
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  return (
    <SettingsClient
      initialPrefs={state?.prefs ?? DEFAULT_REMINDER}
      initialSubscriptionCount={state?.subscriptionCount ?? 0}
      vapidPublicKey={vapidPublicKey}
      pushConfigured={isPushConfigured()}
      username={(user?.user_metadata?.username as string | undefined) ?? "you"}
      email={user?.email ?? ""}
    />
  );
}
