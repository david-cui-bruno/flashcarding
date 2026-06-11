// Server-only wrapper around the `web-push` library. Never import into a client
// component — it uses the VAPID private key.
import webpush from "web-push";
import type { StoredPushSubscription } from "./types";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@carding.local";
  if (!publicKey || !privateKey) {
    throw new Error(
      "VAPID keys not configured. Run `pnpm gen:vapid` and set NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY in .env.local.",
    );
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export function isPushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export type PushResult = "sent" | "expired" | "error";

// Send one notification. "expired" means the subscription is gone (404/410) and
// the caller should prune it.
export async function sendPush(
  sub: StoredPushSubscription,
  payload: PushPayload,
): Promise<PushResult> {
  ensureConfigured();
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload));
    return "sent";
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "expired";
    console.error("[carding] push send failed:", status, (err as Error)?.message);
    return "error";
  }
}
