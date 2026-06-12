"use client";

import { useEffect, useState } from "react";
import { Bell, Clock, Download, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/logo";
import { logout } from "@/app/(auth)/actions";
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

type ClientEnv = {
  supported: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  permission: NotificationPermission | null;
  tz: string;
};

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> };

type Props = {
  initialPrefs: ReminderPrefs;
  initialSubscriptionCount: number;
  vapidPublicKey: string;
  pushConfigured: boolean;
  username: string;
  email: string;
};

export function SettingsClient({
  initialPrefs,
  initialSubscriptionCount,
  vapidPublicKey,
  pushConfigured,
  username,
  email,
}: Props) {
  const [client, setClient] = useState<ClientEnv | null>(null);
  const [subscribed, setSubscribed] = useState(initialSubscriptionCount > 0);
  const [enabled, setEnabled] = useState(initialPrefs.enabled);
  const [time, setTime] = useState(initialPrefs.time);
  const [busy, setBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState<string | null>(null);
  const [prefsMsg, setPrefsMsg] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClient(env);

    if (supported) {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setSubscribed(Boolean(sub)))
        .catch(() => {});
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function persist(nextEnabled: boolean, nextTime: string) {
    setBusy(true);
    setPrefsMsg(null);
    try {
      const tz = client?.tz ?? initialPrefs.tz;
      const res = await saveReminderPrefsAction({ enabled: nextEnabled, time: nextTime, tz });
      setPrefsMsg(res.ok ? "Saved." : res.error);
    } finally {
      setBusy(false);
    }
  }

  function toggleEnabled(v: boolean) {
    setEnabled(v);
    void persist(v, time);
  }

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

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  }

  if (client === null) {
    return <div className="px-4 py-6 md:p-10" />;
  }

  const { supported, isIOS, isStandalone, permission, tz } = client;
  const needsInstallOnIOS = isIOS && !isStandalone;

  return (
    <div className="px-4 py-6 md:p-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-7">
          <h1 className="text-2xl font-semibold md:text-3xl">Settings</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Reminders, install, and your account.</p>
        </div>

        <div className="space-y-8">
          {/* Daily study reminders */}
          <section>
            <h2 className="mb-3 text-sm font-semibold">Daily study reminders</h2>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex items-center gap-3 px-5 py-4">
                <Bell className="size-5 text-primary" />
                <div className="flex-1 leading-tight">
                  <div className="text-sm font-medium">Remind me daily</div>
                  <div className="mt-0.5 text-[0.78rem] text-muted-foreground">
                    A gentle nudge when cards are due. No streaks, no guilt.
                  </div>
                </div>
                <Switch checked={enabled} onCheckedChange={toggleEnabled} disabled={busy} />
              </div>

              <hr className="border-border" />

              <div className="flex flex-wrap items-center gap-3 px-5 py-4">
                <Clock className="size-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Remind me at</span>
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  onBlur={() => persist(enabled, time)}
                  className="w-auto font-semibold tabular-nums"
                />
                <span className="ml-auto text-[0.78rem] text-muted-foreground">{tz}</span>
              </div>

              {/* device subscription + status */}
              {(supported || !pushConfigured) && (
                <>
                  <hr className="border-border" />
                  <div className="space-y-3 px-5 py-4">
                    {!pushConfigured ? (
                      <p className="text-sm text-warning">
                        Push isn&rsquo;t configured on the server yet.
                      </p>
                    ) : needsInstallOnIOS ? (
                      <p className="text-sm text-info">
                        On iPhone/iPad, install Cardstock first (below), then enable notifications from
                        the installed app.
                      </p>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        {subscribed ? (
                          <Button variant="outline" size="sm" onClick={disableNotifications} disabled={busy}>
                            Disable on this device
                          </Button>
                        ) : (
                          <Button size="sm" onClick={enableNotifications} disabled={busy}>
                            Enable notifications
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={sendTest} disabled={busy || !subscribed}>
                          Send a test
                        </Button>
                        {permission === "denied" && (
                          <span className="text-sm text-destructive">Blocked in your browser.</span>
                        )}
                      </div>
                    )}
                    {!supported && pushConfigured && (
                      <p className="text-sm text-muted-foreground">
                        This browser doesn&rsquo;t support push notifications.
                      </p>
                    )}
                    {(pushMsg || prefsMsg) && (
                      <p className="text-[0.8rem] text-muted-foreground" aria-live="polite">
                        {pushMsg ?? prefsMsg}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Install Cardstock (PWA) */}
          {!isStandalone && (
            <section>
              <h2 className="mb-3 text-sm font-semibold">Install Cardstock</h2>
              <div className="rounded-xl border border-border bg-card px-5 py-5">
                <div className="flex items-center gap-4">
                  <span className="flex size-[46px] flex-none items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_8px_18px_-6px_rgba(94,125,110,.55)]">
                    <Logo size={24} className="text-primary-foreground" />
                  </span>
                  <div className="flex-1 leading-snug">
                    <div className="text-sm font-medium">Keep Cardstock one click away</div>
                    <div className="mt-0.5 text-[0.82rem] text-muted-foreground">
                      Install it as an app — opens in its own window and works offline for review.
                    </div>
                  </div>
                  {installPrompt && (
                    <Button onClick={install} className="whitespace-nowrap">
                      <Download className="size-4" />
                      Install app
                    </Button>
                  )}
                </div>
                {isIOS && (
                  <>
                    <hr className="my-4 border-border" />
                    <p className="text-[0.78rem] leading-relaxed text-muted-foreground">
                      On iPhone, open Cardstock in Safari, tap Share, then &ldquo;Add to Home Screen.&rdquo;
                    </p>
                  </>
                )}
              </div>
            </section>
          )}

          {/* Account */}
          <section>
            <h2 className="mb-3 text-sm font-semibold">Account</h2>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex items-center gap-3.5 px-5 py-4">
                <span className="flex size-10 items-center justify-center rounded-full bg-accent text-[0.95rem] font-semibold text-accent-foreground">
                  {username.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="truncate text-sm font-medium">{username}</div>
                  {email && <div className="mt-0.5 truncate text-[0.78rem] text-muted-foreground">{email}</div>}
                </div>
                <Badge className="bg-accent text-accent-foreground">Username login</Badge>
              </div>

              <hr className="border-border" />

              <form action={logout} className="flex items-center justify-between px-5 py-4">
                <div className="leading-tight">
                  <div className="text-sm font-medium">Log out</div>
                  <div className="mt-0.5 text-[0.78rem] text-muted-foreground">Sign out of this device.</div>
                </div>
                <Button
                  type="submit"
                  variant="ghost"
                  className={cn("font-medium text-destructive hover:bg-destructive/10 hover:text-destructive")}
                >
                  <LogOut className="size-4" />
                  Log out
                </Button>
              </form>
            </div>
          </section>

          <p className="pt-1 text-center text-[0.74rem] text-muted-foreground">Cardstock · v1</p>
        </div>
      </div>
    </div>
  );
}
