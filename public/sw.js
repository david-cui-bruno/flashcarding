/* Carding service worker.
 * v1 scope: installability + Web Push for daily study reminders.
 * Offline review is explicitly v2 (docs/FUTURE-IDEAS.md) — no fetch/caching here. */

const VERSION = "carding-v1";

// Activate immediately so updates take effect without a manual reload.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Incoming push -> show a notification.
self.addEventListener("push", (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { body: event.data.text() };
    }
  }

  const title = payload.title || "Carding";
  const options = {
    body: payload.body || "You have cards due. Time to study.",
    icon: payload.icon || "/icons/icon-192.png",
    badge: payload.badge || "/icons/badge.png",
    tag: payload.tag || "carding-reminder", // collapse repeats into one
    renotify: true,
    data: { url: payload.url || "/study", ts: VERSION },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Tap a notification -> focus an open Carding window, or open one at the target URL.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/study";

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        const url = new URL(client.url);
        if (url.origin === self.location.origin && "focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(target);
            } catch {
              /* navigation can fail mid-unload; focusing is enough */
            }
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(target);
      }
    })(),
  );
});
