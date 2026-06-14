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
// Web/PWA/Apple icons stay FULL-BLEED — iOS masks them into a squircle and Android
// uses the maskable variants, so a pre-rounded icon would double-round. macOS, by
// contrast, does NOT auto-round app icons, so the Electron icon must bake in the
// rounded squircle + a transparent margin itself (`rounded: true`).
const TARGETS = [
  { path: join(OUT, "icon-192.png"), size: 192 },
  { path: join(OUT, "icon-512.png"), size: 512 },
  { path: join(OUT, "icon-maskable-192.png"), size: 192 },
  { path: join(OUT, "icon-maskable-512.png"), size: 512 },
  { path: join(OUT, "apple-icon.png"), size: 180 },
  { path: join(ROOT, "app", "icon.png"), size: 256 }, // Next favicon
  { path: join(ROOT, "desktop", "icon.png"), size: 1024, rounded: true }, // Electron .app (macOS)
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent(`<canvas id="c"></canvas><img id="img" src="${dataUrl}">`);
  await page.evaluate(() => document.getElementById("img").decode());

  for (const { path, size, rounded } of TARGETS) {
    const b64 = await page.evaluate(({ s, rounded }) => {
      const c = document.getElementById("c");
      c.width = s;
      c.height = s;
      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, s, s);
      ctx.imageSmoothingQuality = "high";
      const img = document.getElementById("img");
      if (rounded) {
        // macOS squircle: ~10% transparent margin, Apple-ish continuous corner radius.
        const m = Math.round(s * 0.0977);
        const side = s - m * 2;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(m, m, side, side, Math.round(side * 0.2237));
        ctx.clip();
        ctx.drawImage(img, m, m, side, side);
        ctx.restore();
      } else {
        ctx.drawImage(img, 0, 0, s, s);
      }
      return c.toDataURL("image/png").split(",")[1];
    }, { s: size, rounded: !!rounded });
    writeFileSync(path, Buffer.from(b64, "base64"));
    console.log("wrote", path.replace(ROOT + "/", ""), `(${size}px${rounded ? ", rounded" : ""})`);
  }
} finally {
  await browser.close();
}
