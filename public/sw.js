/* Dory service worker.
 * v1: installability + Web Push for daily study reminders.
 * v2 (offline study, docs/APP-STORE-PLAN.md guideline 4.2): runtime caching so the
 * app SHELL loads without a connection —
 *   - static assets (/_next/static, icons): cache-first (immutable, hashed URLs)
 *   - page navigations: network-first, falling back to the cached copy of that
 *     page, then to cached /library (which client-side renders the offline
 *     library + inline study sessions from IndexedDB — see lib/offline/).
 * Study DATA lives in IndexedDB (deck cache + review outbox), not here: the SW
 * only guarantees that HTML/JS boot offline.
 */

const VERSION = "dory-v2";
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;

// Activate immediately so updates take effect without a manual reload.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from older SW versions.
      const names = await caches.keys();
      await Promise.all(names.filter((n) => !n.startsWith(VERSION)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Immutable build assets: cache-first (hashed URLs never change content).
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res.ok) {
          const cache = await caches.open(STATIC_CACHE);
          cache.put(req, res.clone());
        }
        return res;
      })(),
    );
    return;
  }

  // Page navigations: network-first (fresh data whenever possible), cache fallback.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          // Cache successful page loads for offline fallback. Skip redirected
          // responses (e.g. the proxy's auth redirect to /login — caching that
          // under /library would poison the fallback) and error pages.
          if (res.ok && res.type === "basic" && !res.redirected) {
            const cache = await caches.open(PAGE_CACHE);
            cache.put(req, res.clone());
          }
          return res;
        } catch {
          // Offline: this exact page if we have it, else the library shell (it
          // client-renders the offline deck list + study from IndexedDB).
          // ignoreVary: Next varies on RSC headers; a plain navigation matches.
          const cached = await caches.match(req, { ignoreVary: true });
          if (cached) return cached;
          const library = await caches.match("/library", { ignoreVary: true });
          if (library) return library;
          return new Response(
            "<!doctype html><meta charset=utf-8><title>Offline</title><body style=\"font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0\"><div style=\"text-align:center\"><h1 style=\"font-weight:500\">You're offline</h1><p>Open Dory once online to enable offline study.</p></div>",
            { status: 503, headers: { "Content-Type": "text/html" } },
          );
        }
      })(),
    );
    return;
  }

  // RSC / data requests for already-cached pages, other same-origin GETs: network
  // with a cache fallback (kept fresh opportunistically). Next.js App Router
  // navigations fetch RSC payloads with a `rsc` header — if that fails offline the
  // client falls back to a full navigation, which the handler above serves.
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

  const title = payload.title || "Dory";
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

// Tap a notification -> focus an open Dory window, or open one at the target URL.
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
