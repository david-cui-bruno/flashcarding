// Live e2e walk of the PDF/Word UPLOAD path via a real browser (Playwright).
// Signs up a throwaway walk* user, uploads a real fixture, and confirms cards
// generate and land on /review. Clean up after with scripts/cleanup-test-users.mjs.
// Usage (dev server must be running on BASE_URL):
//   set -a; . ./.env.local; set +a; node scripts/walk-upload.mjs
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import path from "path";

const BASE = process.env.BASE_URL || "http://localhost:3411";
const shots = "/tmp/carding-upload-shots";
mkdirSync(shots, { recursive: true });
const u = "walk" + Date.now();
const pw = "password123";
const log = (...a) => console.log("[walk-upload]", ...a);

const fixture = (f) => path.join(process.cwd(), "services", "ingestion-py", "fixtures", f);

const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(30000);

async function uploadAndGenerate(file) {
  await page.goto(BASE + "/new", { waitUntil: "domcontentloaded" });
  await page.click('button:has-text("Upload file")'); // switch to upload tab
  await page.setInputFiles('input[type="file"]', fixture(file));
  log(`uploading ${file} → generating (up to 150s)…`);
  await page.click('button:has-text("Upload & generate cards")');
  await page.waitForURL("**/review", { timeout: 150000 });
  await page.waitForSelector(".text-lg.font-medium", { timeout: 15000 });
  const term = await page.locator(".text-lg.font-medium").first().textContent().catch(() => null);
  log(`✅ ${file}: cards generated, at /review — first card term:`, JSON.stringify(term?.trim()));
  await page.screenshot({ path: `${shots}/${file}.png`, fullPage: true });
}

try {
  // wait for dev server
  let up = false;
  for (let i = 0; i < 180; i++) {
    try { const r = await fetch(BASE + "/login"); if (r.status < 500) { up = true; break; } } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!up) throw new Error("dev server never came up at " + BASE);
  log("server up at", BASE);

  // sign up
  await page.goto(BASE + "/signup", { waitUntil: "domcontentloaded" });
  await page.fill('input[name="username"]', u);
  await page.fill('input[name="password"]', pw);
  await page.click('button:has-text("Sign up")');
  await page.waitForURL("**/library", { timeout: 45000 });
  log("✅ signed up as", u);

  // upload a real PDF, then a real .docx
  await uploadAndGenerate("simple.pdf");
  await uploadAndGenerate("simple.docx");

  log("DONE ✅  (user:", u + ") — run scripts/cleanup-test-users.mjs to remove");
} catch (e) {
  log("ERROR:", e?.message || String(e));
  await page.screenshot({ path: `${shots}/error.png`, fullPage: true }).catch(() => {});
  await browser.close();
  process.exit(1);
}
await browser.close();
