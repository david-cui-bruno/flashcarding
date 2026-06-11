"use client";

import { useEffect, useState } from "react";
import {
  savePushSubscriptionAction,
  removePushSubscriptionAction,
  saveReminderPrefsAction,
  sendTestNotificationAction,
} from "./actions";
import type { ReminderPrefs, StoredPushSubscription } from "@/lib/push/types";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function serialize(sub: PushSubscription): StoredPushSubscription {
  const json = sub.toJSON();
  return {
    endpoint: json.endpoint!,
    expirationTime: json.expirationTime ?? null,
    keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
  };
}

// Browser-only facts, detected once after mount (running these during SSR would
// cause a hydration mismatch).
type ClientEnv = {
  supported: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  permission: NotificationPermission | null;
  tz: string;
};

type Props = {
  initialPrefs: ReminderPrefs;
  initialSubscriptionCount: number;
  vapidPublicKey: string;
  pushConfigured: boolean;
};

export function SettingsClient({
  initialPrefs,
  initialSubscriptionCount,
  vapidPublicKey,
  pushConfigured,
}: Props) {
  const [client, setClient] = useState<ClientEnv | null>(null);
  const [subscribed, setSubscribed] = useState(initialSubscriptionCount > 0);

  const [enabled, setEnabled] = useState(initialPrefs.enabled);
  const [time, setTime] = useState(initialPrefs.time);

  const [busy, setBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState<string | null>(null);
  const [prefsMsg, setPrefsMsg] = useState<string | null>(null);

  useEffect(() => {
    const supported =
      "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    const env: ClientEnv = {
      supported,
      isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
      isStandalone:
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true,
      permission: supported ? Notification.permission : null,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || initialPrefs.tz,
    };
    // One synchronous update for client-only feature detection — the intended use.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClient(env);

    if (supported) {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setSubscribed(Boolean(sub)))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enableNotifications() {
    setBusy(true);
    setPushMsg(null);
    try {
      const perm = await Notification.requestPermission();
      setClient((prev) => (prev ? { ...prev, permission: perm } : prev));
      if (perm !== "granted") {
        setPushMsg("Notifications are blocked. Allow them in your browser settings to get reminders.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      await savePushSubscriptionAction(serialize(sub));
      setSubscribed(true);
      setPushMsg("This device will now receive reminders.");
    } catch (err) {
      setPushMsg((err as Error)?.message ?? "Could not enable notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function disableNotifications() {
    setBusy(true);
    setPushMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscriptionAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
      setPushMsg("This device will no longer receive reminders.");
    } catch (err) {
      setPushMsg((err as Error)?.message ?? "Could not disable notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function savePrefs() {
    setBusy(true);
    setPrefsMsg(null);
    try {
      const tz = client?.tz ?? initialPrefs.tz;
      const res = await saveReminderPrefsAction({ enabled, time, tz });
      setPrefsMsg(res.ok ? "Saved." : res.error);
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setPushMsg(null);
    try {
      const res = await sendTestNotificationAction();
      setPushMsg(res.ok ? `Test sent to ${res.sent} device(s).` : res.error);
    } finally {
      setBusy(false);
    }
  }

  // ---- render ----------------------------------------------------------------

  if (client === null) return null; // wait for client-only feature detection

  const { supported, isIOS, isStandalone, permission, tz } = client;
  const needsInstallOnIOS = isIOS && !isStandalone;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-medium">Daily study reminders</h2>
        <p className="text-sm text-neutral-600">
          Get a push notification when you have cards due, at the time you choose.
        </p>

        {!pushConfigured && (
          <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            Push isn&apos;t configured on the server yet. Add VAPID keys
            (<code>pnpm gen:vapid</code> → <code>.env.local</code>) to enable notifications.
          </p>
        )}

        {!supported && (
          <p className="rounded border p-3 text-sm text-neutral-600">
            This browser doesn&apos;t support push notifications.
          </p>
        )}

        {needsInstallOnIOS && (
          <p className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            On iPhone/iPad, first install Carding: tap the Share button{" "}
            <span aria-hidden>⎋</span> then <strong>Add to Home Screen</strong>. Notifications
            work from the installed app (iOS 16.4+).
          </p>
        )}

        {supported && pushConfigured && (
          <div className="flex flex-wrap items-center gap-2">
            {subscribed ? (
              <button
                onClick={disableNotifications}
                disabled={busy}
                className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Disable on this device
              </button>
            ) : (
              <button
                onClick={enableNotifications}
                disabled={busy || needsInstallOnIOS}
                className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                Enable notifications
              </button>
            )}
            <button
              onClick={sendTest}
              disabled={busy || !subscribed}
              className="rounded border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Send a test
            </button>
            {permission === "denied" && (
              <span className="text-sm text-red-600">Notifications are blocked in your browser.</span>
            )}
          </div>
        )}

        {pushMsg && (
          <p className="text-sm text-neutral-700" aria-live="polite">
            {pushMsg}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Reminder schedule</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Remind me daily
        </label>
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="reminder-time">at</label>
          <input
            id="reminder-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="rounded border px-2 py-1"
          />
          <span className="text-neutral-500">{tz}</span>
        </div>
        {enabled && !subscribed && supported && (
          <p className="text-sm text-amber-700">
            Enable notifications above so reminders can reach you.
          </p>
        )}
        <div className="flex items-center gap-3">
          <button
            onClick={savePrefs}
            disabled={busy}
            className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            Save schedule
          </button>
          {prefsMsg && (
            <span className="text-sm text-neutral-700" aria-live="polite">
              {prefsMsg}
            </span>
          )}
        </div>
      </section>
    </div>
  );
}
