// End-to-end walk of the REBUILT UI (live Sonnet generation). New selectors.
// Dev server must be on BASE_URL. Run: node scripts/walk-ui.mjs
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = process.env.BASE_URL || "http://localhost:3411";
const shots = "/tmp/carding-shots/ui";
mkdirSync(shots, { recursive: true });
const u = "walk" + Date.now();
const pw = "password12";
const log = (...a) => console.log("[walk-ui]", ...a);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(30000);

try {
  for (let i = 0; i < 120; i++) {
    try { const r = await fetch(BASE + "/login"); if (r.status < 500) break; } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  log("server up");

  // 1. Sign up → /library
  await page.goto(BASE + "/signup", { waitUntil: "domcontentloaded" });
  await page.fill('input[name="username"]', u);
  await page.fill('input[name="password"]', pw);
  await page.click('button:has-text("Sign up")');
  await page.waitForURL("**/library", { timeout: 45000 });
  log("✅ signed up:", u);

  // 2. New → paste → Make cards
  await page.goto(BASE + "/new", { waitUntil: "domcontentloaded" });
  const text =
    "The Sea Ranch (Condominium One) is a residential complex on the Sonoma County coast of California, built between 1963 and 1965. It was designed by the firm MLTW — Charles Moore, Donlyn Lyndon, William Turnbull, and Richard Whitaker. The design uses rough-sawn wood, shed roofs, and forms borrowed from local agricultural buildings, rejecting the International Style in favor of regional, site-specific architecture. It is considered a key early work of postmodern architecture.";
  await page.fill("textarea", text);
  await page.click('button:has-text("Make cards")');
  log("generating (up to 150s)…");

  // 3. Generating screen (capture while it's up, before redirect)
  await page.waitForURL("**/new/**", { timeout: 20000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${shots}/walk-generating.png`, fullPage: true });
  log("✅ captured generating screen");

  // 4. Redirect to review
  await page.waitForURL("**/review", { timeout: 150000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${shots}/walk-review.png`, fullPage: true });
  const term = await page.locator("p.text-2xl.font-semibold").first().textContent().catch(() => null);
  log("✅ at /review, first term:", JSON.stringify(term?.trim()));

  // 5. Keep one (chip)
  await page.click('button:has-text("Keep")');
  await page.waitForTimeout(1200);
  log("✅ kept a card");

  // 6. Edit one
  await page.click('button:has-text("Edit")');
  const def = page.locator("#r-def");
  await def.fill(((await def.inputValue()) || "") + " (edited)");
  await page.click('button:has-text("Save & keep")');
  await page.waitForTimeout(1200);
  log("✅ edited a card");

  // 7. Reject one with reason
  await page.click('button:has-text("Reject")');
  await page.fill('textarea[placeholder*="What was wrong"]', "walk-ui reject");
  await page.click('button:has-text("Confirm reject")');
  await page.waitForTimeout(1200);
  log("✅ rejected a card");

  // 8. Back to decks — the new deck should appear with cards
  await page.goto(BASE + "/library", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${shots}/walk-library.png`, fullPage: true });

  // 9. Open the deck's study gate, then study one card
  const tile = page.locator('a[aria-label^="Study"]').first();
  await tile.click();
  await page.waitForURL("**/study/**", { timeout: 15000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${shots}/walk-gate.png`, fullPage: true });
  const studyDue = page.locator('a:has-text("Study due")');
  if (await studyDue.count()) {
    await studyDue.first().click();
    await page.waitForTimeout(800);
    await page.keyboard.press("Space");
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${shots}/walk-study.png`, fullPage: true });
    await page.keyboard.press("3"); // Good
    await page.waitForTimeout(800);
    log("✅ studied a card (graded Good)");
  } else {
    log("ℹ️ nothing due to study (all kept cards may not be due yet)");
  }

  log("🎉 walk complete");
} catch (e) {
  console.error("[walk-ui] FAILED:", e.message);
  await page.screenshot({ path: `${shots}/walk-FAIL.png`, fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
