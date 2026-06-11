// Live PWA checks: manifest, service-worker headers + registration, icons, the
// proxy NOT hijacking PWA assets, and cron auth gating. Run against a dev server:
//   pnpm dev --port 3999   (in another shell)
//   BASE_URL=http://localhost:3999 node scripts/walk-pwa.mjs
// HTTP localhost is a secure context, so the service worker registers here.
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3999";
const SECRET = process.env.CRON_SECRET || "local-verification-secret";
const log = (...a) => console.log("[pwa]", ...a);
let failures = 0;
const check = (cond, label, extra = "") => {
  console.log(`${cond ? "✅" : "❌"} ${label}${extra ? "  — " + extra : ""}`);
  if (!cond) failures++;
};

// Wait for the server.
let up = false;
for (let i = 0; i < 120; i++) {
  try {
    const r = await fetch(BASE + "/manifest.webmanifest");
    if (r.status < 500) { up = true; break; }
  } catch {}
  await new Promise((r) => setTimeout(r, 1000));
}
if (!up) { console.error("dev server never came up at " + BASE); process.exit(1); }
log("server up at", BASE);

// 1. Manifest serves (NOT redirected to /login by the proxy) and is valid.
{
  const r = await fetch(BASE + "/manifest.webmanifest", { redirect: "manual" });
  check(r.status === 200, "GET /manifest.webmanifest -> 200 (not redirected to /login)", `status ${r.status}`);
  const m = await r.json().catch(() => null);
  check(!!m?.name && Array.isArray(m?.icons) && m.icons.length >= 2, "manifest has name + icons",
    m ? `${m.icons?.length} icons, name="${m.name}"` : "unparseable");
  check(m?.display === "standalone", "manifest display = standalone");
}

// 2. Service worker serves with no-store + JS content type (NOT redirected).
{
  const r = await fetch(BASE + "/sw.js", { redirect: "manual" });
  check(r.status === 200, "GET /sw.js -> 200 (not redirected to /login)", `status ${r.status}`);
  const ct = r.headers.get("content-type") || "";
  const cc = r.headers.get("cache-control") || "";
  check(ct.includes("javascript"), "/sw.js Content-Type is JS", ct);
  check(cc.includes("no-store") || cc.includes("no-cache"), "/sw.js is non-cacheable", cc);
  const body = await r.text();
  check(body.includes('addEventListener("push"') || body.includes("addEventListener('push'"),
    "/sw.js handles push events");
}

// 3. Icons serve.
for (const f of ["icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-icon.png"]) {
  const r = await fetch(`${BASE}/icons/${f}`, { redirect: "manual" });
  check(r.status === 200 && (r.headers.get("content-type") || "").includes("image"),
    `GET /icons/${f} -> image`, `status ${r.status}`);
}

// 4. Cron auth gating.
{
  const noAuth = await fetch(BASE + "/api/cron/reminders", { redirect: "manual" });
  check(noAuth.status === 401, "cron without secret -> 401", `status ${noAuth.status}`);
  const withAuth = await fetch(BASE + "/api/cron/reminders", {
    headers: { authorization: `Bearer ${SECRET}` }, redirect: "manual",
  });
  // With a real DB this is 200; with the dummy local DB it's 500 (listUsers fails).
  // Either way it must NOT be 401 — that proves the secret was accepted.
  check(withAuth.status !== 401, "cron with secret -> not 401 (auth accepted)", `status ${withAuth.status}`);
}

// 5. The login page renders and the service worker registers (Next injects the
//    manifest <link>, and the root layout registers /sw.js).
{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  try {
    await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
    const hasManifestLink = await page.locator('link[rel="manifest"]').count();
    check(hasManifestLink > 0, "login page injects <link rel=manifest>");
    const hasThemeColor = await page.locator('meta[name="theme-color"]').count();
    check(hasThemeColor > 0, "theme-color meta present");
    const hasAppleCapable = await page.locator('meta[name="apple-mobile-web-app-capable"], meta[name="mobile-web-app-capable"]').count();
    check(hasAppleCapable > 0, "apple/mobile web-app-capable meta present");

    // Service worker should register (secure context on localhost).
    const reg = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return "no-sw-api";
      const r = await navigator.serviceWorker.ready.catch(() => null);
      return r ? "ready" : "not-ready";
    });
    check(reg === "ready", "service worker registers + becomes ready", reg);
  } finally {
    await browser.close();
  }
}

console.log(failures === 0 ? "\nDONE ✅ all PWA checks passed" : `\nDONE ❌ ${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
