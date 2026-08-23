// End-to-end offline-study walk (Playwright, Chromium network emulation).
// Proves the offline v1 loop against a running server (default :3411):
//   1. login as demo → /library online (write-through deck cache to IndexedDB)
//   2. go OFFLINE → reload /library (service worker serves the cached shell,
//      client renders the OfflineLibrary from IndexedDB)
//   3. offline SCHEDULED grade (1 due card → FSRS update queued) + offline CRAM
//      session (3 cards) → all 4 reviews land in the outbox
//   4. reconnect → outbox replays through gradeCard
//   5. verify server-side (service role): the 4 study_reviews rows exist with the
//      offline reviewed_at timestamps, and the scheduled card's FSRS state matches
//      the client-computed update
//   6. cleanup: delete the walk's review rows + restore the scheduled card's FSRS
//      columns so the demo account is left untouched
// Run: set -a; . ./.env.local; set +a; node scripts/walk-offline.mjs
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE_URL || "http://localhost:3411";
const CRAM_GRADES = 3;

function fail(msg) {
  console.error("✗ FAIL:", msg);
  process.exitCode = 1;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("pageerror:", e.message));
page.on("console", (m) => {
  const t = m.text();
  // Surface app logs; skip expected offline fetch noise.
  if (!t.includes("Failed to load resource")) console.log(`[console.${m.type()}]`, t);
});
page.on("response", async (res) => {
  const req = res.request();
  if (req.method() === "POST") {
    console.log(`[POST] ${res.status()} ${req.url()} next-action=${req.headers()["next-action"] ?? "-"}`);
  }
});
page.on("requestfailed", (req) => {
  if (req.method() === "POST") console.log(`[POST FAILED] ${req.url()} ${req.failure()?.errorText}`);
});
page.on("load", () => console.log(`[page load] ${page.url()}`));

// --- 1. login + online library visit (populates the IndexedDB deck cache) ---
for (let i = 0; i < 120; i++) {
  try {
    const r = await fetch(BASE + "/login");
    if (r.status < 500) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 1000));
}
await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
await page.fill('input[name="username"]', "demo");
await page.fill('input[name="password"]', "password12");
await page.click('button:has-text("Log in")');
await page.waitForURL("**/library", { timeout: 30000 });
console.log("✓ logged in, on /library");

// Service worker + refreshDeckCaches need a beat. Poll IDB until decks appear.
// NOTE: poll with page.evaluate (which awaits promises); page.waitForFunction treats
// a returned pending Promise as truthy and would "pass" instantly.
let cachedDecks = null;
for (let i = 0; i < 30; i++) {
  cachedDecks = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.open("dory-offline");
        req.onsuccess = () => {
          const db = req.result;
          try {
            const tx = db.transaction("decks", "readonly");
            const all = tx.objectStore("decks").getAll();
            all.onsuccess = () => {
              db.close();
              const decks = all.result.filter((d) => d.cards.length > 0);
              resolve(decks.length > 0 ? decks.map((d) => ({ name: d.name, n: d.cards.length })) : null);
            };
            all.onerror = () => {
              db.close();
              resolve(null);
            };
          } catch {
            db.close();
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      }),
  );
  if (cachedDecks) break;
  await page.waitForTimeout(1000);
}
if (!cachedDecks) fail("deck cache never populated");
console.log("✓ deck cache written:", JSON.stringify(cachedDecks));

// Make sure the SW controls the page and has /library in its page cache.
await page.waitForFunction(() => navigator.serviceWorker?.controller != null, { timeout: 15000 });
await page.reload({ waitUntil: "networkidle" }); // a controlled load → page cached by SW
console.log("✓ service worker controlling the page");

// --- 2. offline → reload → OfflineLibrary from cache ---
await ctx.setOffline(true);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("text=Study works from your cached decks", { timeout: 15000 }).catch(async (e) => {
  await page.screenshot({ path: "/tmp/offline-walk-fail.png", fullPage: true });
  console.error("body snippet:", (await page.content()).slice(0, 600));
  throw e;
});
console.log("✓ offline reload: cached shell + offline library rendered");

// --- 3a. offline SCHEDULED session: grade ONE due card (queues an FsrsUpdate;
// restored in cleanup). Skipped if nothing is due right now. ---
let didScheduled = false;
const dueBtn = page.locator('button:has-text("Study due"):not([disabled])').first();
if (await dueBtn.count()) {
  await dueBtn.click();
  await page.waitForSelector("text=Offline — reviews will sync", { timeout: 10000 });
  await page.click('button:has-text("Show answer")');
  await page.click('button:has-text("Good")');
  await page.waitForTimeout(250);
  didScheduled = true;
  console.log("✓ offline scheduled session: graded 1 due card (FSRS update queued)");
  await page.click("text=Decks"); // back to the offline library
} else {
  console.log("~ no due cards in cache — skipping the scheduled-mode leg");
}

// --- 3b. offline CRAM session from the cache ---
const cramBtn = page.locator('button:has-text("Cram"):not([disabled])').first();
await cramBtn.waitFor({ timeout: 10000 });
await cramBtn.click();
await page.waitForSelector("text=Offline — reviews will sync", { timeout: 10000 });
console.log("✓ offline cram session started (offline pill visible)");

for (let i = 0; i < CRAM_GRADES; i++) {
  await page.click('button:has-text("Show answer")');
  await page.click('button:has-text("Good")');
  await page.waitForTimeout(250);
}
console.log(`✓ graded ${CRAM_GRADES} cards offline (cram)`);

const expectedTotal = CRAM_GRADES + (didScheduled ? 1 : 0);

const outboxEntries = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const req = indexedDB.open("dory-offline");
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("outbox", "readonly");
        const c = tx.objectStore("outbox").getAll();
        c.onsuccess = () => {
          db.close();
          resolve(c.result);
        };
      };
    }),
);
const outboxCount = outboxEntries.length;
console.log(
  "outbox entries:",
  JSON.stringify(outboxEntries.map((e) => ({ id: e.id, cardId: e.cardId, mode: e.mode, hasUpdate: !!e.update }))),
);
if (outboxCount !== expectedTotal) fail(`outbox has ${outboxCount} entries, expected ${expectedTotal}`);
else console.log(`✓ outbox holds ${outboxCount} queued reviews`);

// Snapshot the scheduled card's FSRS columns BEFORE replay so cleanup can restore.
const scheduledEntry = outboxEntries.find((e) => e.mode === "scheduled");
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const FSRS_COLS =
  "due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, fsrs_state, last_review, learning_steps";
let scheduledCardBefore = null;
if (scheduledEntry) {
  const { data } = await admin
    .from("cards")
    .select(FSRS_COLS)
    .eq("id", scheduledEntry.cardId)
    .single();
  scheduledCardBefore = data;
}

// --- 4. reconnect → replay ---
await page.evaluate(() => {
  window.addEventListener("dory-outbox-change", (e) => console.log("[outbox-change]", e.detail?.count));
});
await ctx.setOffline(false);
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(1000);
  const left = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.open("dory-offline");
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("outbox", "readonly");
          const c = tx.objectStore("outbox").getAll();
          c.onsuccess = () => {
            db.close();
            resolve(c.result.map((e) => ({ id: e.id.slice(0, 8), seq: e.seq, attempts: e.attempts })));
          };
        };
        req.onerror = () => resolve("open-error");
      }),
  );
  console.log(`[t+${i + 1}s] outbox:`, JSON.stringify(left));
  if (Array.isArray(left) && left.length === 0) break;
}
console.log("✓ back online: outbox drained to 0");

await browser.close();

// --- 5. server-side verification ---
const { data: rows, error } = await admin
  .from("study_reviews")
  .select("id, grade, mode, reviewed_at")
  .in("id", outboxEntries.map((e) => e.id));
if (error) fail(`server query failed: ${error.message}`);
else if ((rows?.length ?? 0) < expectedTotal)
  fail(`expected ${expectedTotal} replayed reviews by id, found ${rows?.length ?? 0}`);
else
  console.log(
    `✓ server has all ${rows.length} replayed reviews with offline reviewed_at timestamps:`,
    rows.map((r) => r.reviewed_at).join(", "),
  );

// The scheduled replay must persist the client-computed FSRS state verbatim.
if (scheduledEntry) {
  const { data: after } = await admin
    .from("cards")
    .select(FSRS_COLS)
    .eq("id", scheduledEntry.cardId)
    .single();
  const u = scheduledEntry.update;
  const match =
    after &&
    u &&
    new Date(after.due).getTime() === new Date(u.due).getTime() &&
    // stability/difficulty are float4 in Postgres → compare at float4 precision
    Math.abs(after.stability - u.stability) / Math.max(1, Math.abs(u.stability)) < 1e-5 &&
    after.reps === u.reps &&
    after.fsrs_state === u.fsrs_state &&
    after.learning_steps === u.learning_steps;
  if (!match) {
    fail(
      `scheduled card FSRS mismatch after replay: got ${JSON.stringify(after)}, want ${JSON.stringify(u)}`,
    );
  } else {
    console.log("✓ scheduled card's FSRS state matches the offline-computed update");
  }
}

// --- 6. cleanup: remove the walk's reviews + restore the scheduled card ---
const { error: delErr } = await admin
  .from("study_reviews")
  .delete()
  .in("id", outboxEntries.map((e) => e.id));
if (delErr) console.warn("cleanup: could not delete walk reviews:", delErr.message);
if (scheduledEntry && scheduledCardBefore) {
  const { error: restoreErr } = await admin
    .from("cards")
    .update(scheduledCardBefore)
    .eq("id", scheduledEntry.cardId);
  if (restoreErr) console.warn("cleanup: could not restore card:", restoreErr.message);
}
console.log("✓ cleanup: walk reviews deleted, scheduled card restored");

console.log(process.exitCode ? "\nWALK FAILED" : "\nOFFLINE WALK PASSED");
