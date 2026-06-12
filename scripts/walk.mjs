// Live end-to-end walk of the Cardstock loop via a real browser (Playwright).
// Usage: node scripts/walk.mjs   (dev server must be running on BASE_URL)
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = process.env.BASE_URL || "http://localhost:3411";
const shots = "/tmp/carding-shots";
mkdirSync(shots, { recursive: true });
const u = "walk" + Date.now();
const pw = "password123";
const log = (...a) => console.log("[walk]", ...a);

const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(30000);

try {
  // Wait for the dev server (first compile can be slow).
  let up = false;
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(BASE + "/login");
      if (r.status < 500) { up = true; break; }
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!up) throw new Error("dev server never came up at " + BASE);
  log("server up at", BASE);

  // 1. Sign up (username/password) -> should land on /library.
  await page.goto(BASE + "/signup", { waitUntil: "domcontentloaded" });
  await page.fill('input[name="username"]', u);
  await page.fill('input[name="password"]', pw);
  await page.click('button:has-text("Sign up")');
  await page.waitForURL("**/library", { timeout: 45000 });
  log("✅ signed up & redirected to /library as", u);
  await page.screenshot({ path: `${shots}/1-library.png`, fullPage: true });

  // 2. Paste -> generate (live Sonnet) -> redirect to /review.
  await page.goto(BASE + "/new", { waitUntil: "domcontentloaded" });
  const text =
    "The Sea Ranch (Condominium One) is a residential complex on the Sonoma County coast of California, built between 1963 and 1965. It was designed by the firm MLTW — Charles Moore, Donlyn Lyndon, William Turnbull, and Richard Whitaker. The design uses rough-sawn wood, shed roofs, and forms borrowed from local agricultural buildings, rejecting the International Style in favor of regional, site-specific architecture. It is considered a key early work of postmodern architecture.";
  await page.fill('textarea[name="text"]', text);
  log("generating (up to 120s)…");
  await page.click('button:has-text("Generate cards")');
  await page.waitForURL("**/review", { timeout: 120000 });
  log("✅ generation complete, at /review");
  await page.waitForSelector(".text-lg.font-medium", { timeout: 10000 });
  const term1 = await page.locator(".text-lg.font-medium").first().textContent().catch(() => null);
  log("first card term:", JSON.stringify(term1?.trim()));
  await page.screenshot({ path: `${shots}/2-review.png`, fullPage: true });

  // 3. Keep.
  await page.click('button:has-text("Keep")');
  await page.waitForTimeout(1500);
  log("✅ kept card 1");

  // 4. Edit (changes definition -> tests editCard + before/after feedback).
  await page.click('button:has-text("Edit")');
  const defArea = page.locator("textarea").first();
  await defArea.fill(((await defArea.inputValue()) || "") + " (edited)");
  await page.click('button:has-text("Save & keep")');
  await page.waitForTimeout(1500);
  log("✅ edited & kept card 2");

  // 5. Reject with reason.
  await page.click('button:has-text("Reject")');
  await page.fill('textarea[placeholder*="What was wrong"]', "smoke-test reject");
  await page.click('button:has-text("Confirm reject")');
  await page.waitForTimeout(1500);
  log("✅ rejected card 3");
  await page.screenshot({ path: `${shots}/3-after-review.png`, fullPage: true });

  // 6. Study: front is the fact; flip reveals the term; grade Good (FSRS).
  await page.goto(BASE + "/study", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const showBtn = page.locator('button:has-text("Show answer")');
  if (await showBtn.count()) {
    const front = await page.locator(".min-h-40").first().textContent().catch(() => null);
    log("study front (fact):", JSON.stringify(front?.trim()));
    await showBtn.click();
    await page.waitForTimeout(500);
    const back = await page.locator(".min-h-40").first().textContent().catch(() => null);
    log("after flip (fact + term):", JSON.stringify(back?.trim()));
    await page.screenshot({ path: `${shots}/4-study-flipped.png`, fullPage: true });
    await page.click('button:has-text("Good")');
    await page.waitForTimeout(2000);
    log("✅ graded a card 'Good' (FSRS scheduling update)");
  } else {
    const body = await page.locator("main").textContent().catch(() => null);
    log("⚠️ no 'Show answer' button — study main text:", JSON.stringify(body?.slice(0, 200)));
  }
  await page.screenshot({ path: `${shots}/5-study-after.png`, fullPage: true });

  log("DONE ✅  (user:", u + ")");
} catch (e) {
  log("ERROR:", e?.message || String(e));
  await page.screenshot({ path: `${shots}/error.png`, fullPage: true }).catch(() => {});
  await browser.close();
  process.exit(1);
}
await browser.close();
