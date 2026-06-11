// Browser verification of the feedback/metrics UI: swipe review, metrics view, and the
// "this card is bad" study action. Seeds cards via the admin client (no live generation),
// then drives the real app. Dev server must be running on BASE_URL.
//   set -a; . ./.env.local; set +a; node scripts/verify-ui.mjs
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "fs";

const BASE = process.env.BASE_URL || "http://localhost:3997";
const shots = "/tmp/carding-feedback-shots";
mkdirSync(shots, { recursive: true });
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const u = "uiverify" + Date.now();
const pw = "password123";
const log = (...a) => console.log("[ui]", ...a);
let fail = 0;
const check = (n, c, d) => {
  console.log(`${c ? "✅" : "❌"} ${n}${c ? "" : "  — " + JSON.stringify(d)}`);
  if (!c) fail++;
};

const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(30000);
let userId = null;

try {
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

  // Sign up via the UI (creates the user + a real session).
  await page.goto(BASE + "/signup", { waitUntil: "domcontentloaded" });
  await page.fill('input[name="username"]', u);
  await page.fill('input[name="password"]', pw);
  await page.click('button:has-text("Sign up")');
  await page.waitForURL("**/library", { timeout: 45000 });
  log("signed up as", u);

  const { data: prof } = await admin.from("profiles").select("id").eq("username", u).single();
  userId = prof.id;

  // Seed 3 PENDING cards (no prior feedback ⇒ review-all mode shows all of them).
  const { data: coll } = await admin
    .from("collections").insert({ user_id: userId, name: "UI verify deck" }).select("id").single();
  const pending = ["Alpha", "Beta", "Gamma"].map((t, i) => ({
    user_id: userId, collection_id: coll.id, term: t,
    definition: `fact ${i} about ${t}`, review_status: "pending",
  }));
  await admin.from("cards").insert(pending);

  // ---- Review: swipe right to keep ----
  await page.goto(BASE + "/review", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="review-card"]');
  check("review starts at 1 / 3", (await page.locator("text=/1 \\/ 3/").count()) > 0);
  const card = page.locator('[data-testid="review-card"]');
  const box = await card.boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 220, cy, { steps: 12 }); // drag right past threshold
  await page.mouse.up();
  const advanced = await page
    .waitForFunction(() => document.body.innerText.includes("2 / 3"), { timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  check("swipe-right kept card → now 2 / 3", advanced);
  await page.screenshot({ path: `${shots}/1-review-after-swipe.png`, fullPage: true });

  // tap = edit
  await page.locator('[data-testid="review-card"]').click();
  await page.waitForTimeout(300);
  check("tap opened the edit panel", (await page.locator('button:has-text("Save & keep")').count()) > 0);
  await page.click('button:has-text("Cancel")');

  // verify a 'kept' feedback row landed
  const { count: keptCount } = await admin
    .from("generation_feedback").select("*", { count: "exact", head: true })
    .eq("user_id", userId).eq("action", "kept");
  check("kept feedback row written", keptCount === 1, keptCount);

  // ---- Metrics view ----
  await page.goto(BASE + "/metrics", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Metrics");
  check("metrics shows review mode", (await page.locator("text=Review mode").count()) > 0);
  check("metrics shows the edit-rate section", (await page.locator("text=/edit rate/i").count()) > 0);
  check("metrics shows retention vs target", (await page.locator("text=/Retention vs 90%/").count()) > 0);
  check("ladder shows Review-all current", (await page.locator("text=Review all").count()) > 0);
  await page.screenshot({ path: `${shots}/2-metrics.png`, fullPage: true });

  // ---- Study: "this card is bad" ----
  const { data: dueCard } = await admin.from("cards").insert({
    user_id: userId, collection_id: coll.id, term: "Leech",
    definition: "a card you keep failing", review_status: "accepted",
    due: new Date(Date.now() - 86400000).toISOString(),
  }).select("id").single();

  await page.goto(BASE + "/study", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('button:has-text("Show answer")');
  await page.click('button:has-text("This card is bad")');
  await page.fill('textarea[placeholder*="wrong"]', "ambiguous prompt");
  await page.click('button:has-text("Remove this card")');
  // The flagged card leaves the study deck (advances to the next due card, or "done").
  const advancedPastLeech = await page
    .waitForFunction(() => !document.body.innerText.includes("a card you keep failing"), {
      timeout: 15000,
    })
    .then(() => true)
    .catch(() => false);
  check("flagged card removed from study deck", advancedPastLeech);
  await page.screenshot({ path: `${shots}/3-study-after-flag.png`, fullPage: true });

  const { data: flagged } = await admin.from("cards").select("review_status").eq("id", dueCard.id).single();
  check("flagged card is now rejected", flagged.review_status === "rejected", flagged);
  const { data: studyReject } = await admin
    .from("generation_feedback").select("reason").eq("card_id", dueCard.id).eq("action", "rejected").single();
  check("study reject logged to the feedback loop", studyReject?.reason?.startsWith("[study]"), studyReject);

  log("DONE");
} catch (e) {
  fail++;
  log("ERROR:", e?.message || String(e));
  await page.screenshot({ path: `${shots}/error.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
  if (userId) {
    await admin.auth.admin.deleteUser(userId);
    log("cleaned up test user");
  }
}
console.log(fail === 0 ? "\nALL UI CHECKS PASSED ✅" : `\n${fail} UI CHECK(S) FAILED ❌`);
process.exit(fail === 0 ? 0 : 1);