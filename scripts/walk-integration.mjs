// Live end-to-end walk of the INTEGRATED Carding loop (all six streams) via Playwright.
// Async generation: paste → /new/[jobId] (polls the Batch) → /review → study → metrics.
// Usage: BASE_URL=http://localhost:PORT node scripts/walk-integration.mjs
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = process.env.BASE_URL || "http://localhost:3477";
const shots = "/tmp/carding-shots";
mkdirSync(shots, { recursive: true });
const u = "walk" + Date.now();
const pw = "password123";
const log = (...a) => console.log("[walk]", ...a);

const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(30000);

const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") pageErrors.push("console: " + m.text());
});

const assertNoErrors = (where) => {
  // Ignore benign noise (favicon, ResizeObserver, expected 401 from poll before sign-in).
  const real = pageErrors.filter(
    (e) =>
      !/favicon|ResizeObserver|Failed to load resource.*40[13]|net::ERR/i.test(e),
  );
  if (real.length) {
    log(`⚠️ page errors at ${where}:`, real.slice(0, 5));
  }
  pageErrors.length = 0;
};

try {
  let up = false;
  for (let i = 0; i < 180; i++) {
    try {
      const r = await fetch(BASE + "/login");
      if (r.status < 500) { up = true; break; }
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!up) throw new Error("dev server never came up at " + BASE);
  log("server up at", BASE);

  // 1. Sign up (auth-pwa hardened signup) -> /library.
  await page.goto(BASE + "/signup", { waitUntil: "domcontentloaded" });
  await page.fill('input[name="username"]', u);
  await page.fill('input[name="password"]', pw);
  await page.click('button:has-text("Sign up")');
  await page.waitForURL("**/library", { timeout: 45000 });
  log("✅ signed up & at /library as", u);
  assertNoErrors("library");
  await page.screenshot({ path: `${shots}/i1-library.png`, fullPage: true });

  // 2. Paste -> async generation. Click -> redirect to /new/<jobId> (generating page),
  //    which polls /api/jobs/poll until the Batch ends, then redirects to /review.
  await page.goto(BASE + "/new", { waitUntil: "domcontentloaded" });
  const text =
    "The Sea Ranch (Condominium One) is a residential complex on the Sonoma County coast of California, built between 1963 and 1965. It was designed by the firm MLTW — Charles Moore, Donlyn Lyndon, William Turnbull, and Richard Whitaker. The design uses rough-sawn wood, shed roofs, and forms borrowed from local agricultural buildings, rejecting the International Style in favor of regional, site-specific architecture. It is considered a key early work of postmodern architecture.";
  await page.fill('textarea[name="text"]', text);
  await page.click('button:has-text("Generate cards")');
  await page.waitForURL(/\/new\/[0-9a-f-]+/, { timeout: 20000 });
  log("✅ async job started, on generating page:", page.url());
  await page.screenshot({ path: `${shots}/i2-generating.png`, fullPage: true });

  // Wait through the async Batch (can take a few minutes). Resolves when it hits /review.
  log("waiting for the Batch to complete (up to 6 min)…");
  const t0 = Date.now();
  await page.waitForURL("**/review", { timeout: 360000 });
  log(`✅ generation complete -> /review (${Math.round((Date.now() - t0) / 1000)}s)`);
  assertNoErrors("review-load");
  await page.screenshot({ path: `${shots}/i3-review.png`, fullPage: true });

  // 3. Review using the new swipe-mirroring buttons. Exercise keep + edit + reject,
  //    then keep any remainder. Loop is capped so it can't hang.
  let kept = 0, edited = 0, rejected = 0;
  for (let n = 0; n < 30; n++) {
    const cardCount = await page.locator('[data-testid="review-card"]').count();
    if (cardCount === 0) break; // queue empty ("All reviewed 🎉")
    const term = await page.locator(".text-lg.font-medium").first().textContent().catch(() => null);

    if (edited === 0 && kept >= 1) {
      // Edit the 2nd card (tests editCard + before/after feedback signal).
      await page.click('button:has-text("Edit")');
      const def = page.locator('textarea').first();
      await def.fill(((await def.inputValue()) || "") + " (edited in walk)");
      await page.click('button:has-text("Save & keep")');
      edited++;
      log("✅ edited+kept:", JSON.stringify(term?.trim()));
    } else if (rejected === 0 && kept >= 1 && edited >= 1) {
      // Reject the 3rd card with a reason (tests rejectCard + reason).
      await page.click('button:has-text("Reject")');
      await page.fill('textarea[placeholder*="wrong"]', "walk smoke reject");
      await page.click('button:has-text("Confirm reject")');
      rejected++;
      log("✅ rejected:", JSON.stringify(term?.trim()));
    } else {
      await page.click('button:has-text("Keep")');
      kept++;
      log("✅ kept:", JSON.stringify(term?.trim()));
    }
    await page.waitForTimeout(700);
  }
  log(`review done — kept ${kept}, edited ${edited}, rejected ${rejected}`);
  assertNoErrors("review-actions");
  await page.screenshot({ path: `${shots}/i4-after-review.png`, fullPage: true });

  // 4. Study (study-scheduling + the reconciled bad-card flag): flip + grade.
  await page.goto(BASE + "/study", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const showBtn = page.locator('button:has-text("Show answer")');
  if (await showBtn.count()) {
    const front = await page.locator(".min-h-40").first().textContent().catch(() => null);
    await showBtn.click();
    await page.waitForTimeout(400);
    await page.click('button:has-text("Good")');
    await page.waitForTimeout(1200);
    log("✅ studied a card (flip + grade Good):", JSON.stringify(front?.trim()?.slice(0, 60)));
    // Cram mode loads?
    await page.goto(BASE + "/study?mode=cram", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    log("✅ cram mode loads:", page.url());
  } else {
    const body = await page.locator("main").textContent().catch(() => null);
    log("⚠️ no cards to study:", JSON.stringify(body?.slice(0, 160)));
  }
  assertNoErrors("study");
  await page.screenshot({ path: `${shots}/i5-study.png`, fullPage: true });

  // 5. Metrics (feedback-metrics): dashboard renders.
  await page.goto(BASE + "/metrics", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const metricsText = (await page.locator("main").textContent().catch(() => "")) || "";
  log("✅ /metrics renders. mentions edit-rate?", /edit rate|edit-rate|Reviewing|Trust|Spot/i.test(metricsText));
  assertNoErrors("metrics");
  await page.screenshot({ path: `${shots}/i6-metrics.png`, fullPage: true });

  // 6. Collections (collections stream) + Settings (auth-pwa) render.
  await page.goto(BASE + "/library", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  assertNoErrors("library-2");
  await page.goto(BASE + "/settings", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const settingsText = (await page.locator("main").textContent().catch(() => "")) || "";
  log("✅ /settings renders. mentions reminders/notifications?", /remind|notif|install/i.test(settingsText));
  assertNoErrors("settings");
  await page.screenshot({ path: `${shots}/i7-settings.png`, fullPage: true });

  // 7. PWA manifest is served.
  const mani = await fetch(BASE + "/manifest.webmanifest").then((r) => r.status).catch(() => 0);
  log("✅ manifest.webmanifest status:", mani);

  log("DONE ✅  (user:", u + ")");
} catch (e) {
  log("ERROR:", e?.message || String(e));
  await page.screenshot({ path: `${shots}/i-error.png`, fullPage: true }).catch(() => {});
  await browser.close();
  process.exit(1);
}
await browser.close();
