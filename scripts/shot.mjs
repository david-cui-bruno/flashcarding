// Visual-check helper: log in as the demo user, then screenshot a list of paths
// at desktop + mobile widths. Run: node scripts/shot.mjs /library /new ...
// Dev server must be running on BASE_URL (default http://localhost:3411).
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = process.env.BASE_URL || "http://localhost:3411";
const OUT = "/tmp/carding-shots/ui";
mkdirSync(OUT, { recursive: true });

const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error("usage: node scripts/shot.mjs <path> [path...]");
  process.exit(1);
}

const browser = await chromium.launch();

async function login(ctx) {
  const page = await ctx.newPage();
  // wait for server
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
  await page.waitForURL("**/library", { timeout: 30000 }).catch(() => {});
  await page.close();
}

function slug(p) {
  return p.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "root";
}

for (const [label, width, height, mobile] of [
  ["web", 1280, 900, false],
  ["mobile", 390, 844, true],
]) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    isMobile: mobile,
    deviceScaleFactor: 2,
  });
  await login(ctx);
  for (const p of paths) {
    const page = await ctx.newPage();
    try {
      await page.goto(BASE + p, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(700);
      const file = `${OUT}/${label}-${slug(p)}.png`;
      await page.screenshot({ path: file, fullPage: true });
      console.log("shot", file);
    } catch (e) {
      console.error("FAIL", label, p, e.message);
    }
    await page.close();
  }
  await ctx.close();
}

await browser.close();
console.log("done →", OUT);
