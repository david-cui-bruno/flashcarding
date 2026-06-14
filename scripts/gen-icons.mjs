// Generate Dory's PWA / favicon / Apple-touch icons from the brand logo
// (assets/logo-source.png — a white mark on a full-bleed cerulean square).
// Renders via headless Chromium canvas (Playwright is already a dev dependency).
// Usage: pnpm gen:icons   — writes to public/icons/, app/icon.png, desktop/icon.png.
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "icons");
mkdirSync(OUT, { recursive: true });

const src = readFileSync(join(ROOT, "assets", "logo-source.png")).toString("base64");
const dataUrl = `data:image/png;base64,${src}`;

// The source is a finished full-bleed square (cerulean bg, centered white mark), so
// every target is just a clean downscale — full-bleed works for "any" and "maskable"
// alike (the mark is centered; the cerulean bleeds to the edges / safe zone).
const TARGETS = [
  { path: join(OUT, "icon-192.png"), size: 192 },
  { path: join(OUT, "icon-512.png"), size: 512 },
  { path: join(OUT, "icon-maskable-192.png"), size: 192 },
  { path: join(OUT, "icon-maskable-512.png"), size: 512 },
  { path: join(OUT, "apple-icon.png"), size: 180 },
  { path: join(ROOT, "app", "icon.png"), size: 256 }, // Next favicon
  { path: join(ROOT, "desktop", "icon.png"), size: 1024 }, // Electron .app
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent(`<canvas id="c"></canvas><img id="img" src="${dataUrl}">`);
  await page.evaluate(() => document.getElementById("img").decode());

  for (const { path, size } of TARGETS) {
    const b64 = await page.evaluate((s) => {
      const c = document.getElementById("c");
      c.width = s;
      c.height = s;
      const ctx = c.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(document.getElementById("img"), 0, 0, s, s);
      return c.toDataURL("image/png").split(",")[1];
    }, size);
    writeFileSync(path, Buffer.from(b64, "base64"));
    console.log("wrote", path.replace(ROOT + "/", ""), `(${size}px)`);
  }
} finally {
  await browser.close();
}
