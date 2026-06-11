// Generate Carding PWA icons as PNGs by rendering an SVG with headless Chromium
// (Playwright is already a dev dependency — no extra image library needed).
// Usage: pnpm gen:icons   — writes to public/icons/.
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(OUT, { recursive: true });

// The Carding mark: two stacked flashcards (a muted card behind, a white card in
// front with hint "text" lines) on a near-black tile. `scale` shrinks the glyph
// for maskable icons so it stays inside the safe zone; `bg=null` => transparent.
function svg({ scale = 0.82, bg = "#111111", rounded = 22, glyph = "cards" }) {
  const open = bg
    ? `<rect x="0" y="0" width="100" height="100" rx="${rounded}" fill="${bg}"/>`
    : "";
  const mark =
    glyph === "badge"
      ? `<g transform="rotate(4 50 50)">
           <rect x="30" y="20" width="40" height="60" rx="7" fill="#ffffff"/>
         </g>`
      : `<g transform="translate(50 50) scale(${scale}) translate(-50 -50)">
           <g transform="rotate(-11 47 51)">
             <rect x="22" y="22" width="46" height="58" rx="7" fill="#64748b"/>
           </g>
           <g transform="rotate(6 53 49)">
             <rect x="30" y="20" width="46" height="58" rx="7" fill="#ffffff"/>
             <rect x="37" y="28" width="18" height="5" rx="2.5" fill="#111827"/>
             <rect x="37" y="40" width="32" height="4.5" rx="2.2" fill="#cbd5e1"/>
             <rect x="37" y="49" width="28" height="4.5" rx="2.2" fill="#cbd5e1"/>
             <rect x="37" y="58" width="22" height="4.5" rx="2.2" fill="#cbd5e1"/>
           </g>
         </g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">${open}${mark}</svg>`;
}

const TARGETS = [
  { file: "icon-192.png", size: 192, opts: { scale: 0.82, bg: "#111111", rounded: 18 } },
  { file: "icon-512.png", size: 512, opts: { scale: 0.82, bg: "#111111", rounded: 22 } },
  // Maskable: full-bleed bg, glyph pulled into the safe zone.
  { file: "icon-maskable-192.png", size: 192, opts: { scale: 0.62, bg: "#111111", rounded: 0 } },
  { file: "icon-maskable-512.png", size: 512, opts: { scale: 0.62, bg: "#111111", rounded: 0 } },
  // Apple touch icon: iOS rounds it itself and dislikes transparency.
  { file: "apple-icon.png", size: 180, opts: { scale: 0.78, bg: "#111111", rounded: 0 } },
  // Android status-bar badge: monochrome silhouette on transparent.
  { file: "badge.png", size: 96, opts: { scale: 1, bg: null, rounded: 0, glyph: "badge" } },
];

const browser = await chromium.launch();
try {
  for (const t of TARGETS) {
    const page = await browser.newPage({
      viewport: { width: t.size, height: t.size, deviceScaleFactor: 1 },
    });
    const markup = svg(t.opts);
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8"><style>
         html,body{margin:0;padding:0}
         svg{display:block;width:${t.size}px;height:${t.size}px}
       </style></head><body>${markup}</body></html>`,
      { waitUntil: "load" },
    );
    await page.locator("svg").screenshot({
      path: join(OUT, t.file),
      omitBackground: t.opts.bg === null,
    });
    await page.close();
    console.log("wrote", t.file, `(${t.size}x${t.size})`);
  }
} finally {
  await browser.close();
}
