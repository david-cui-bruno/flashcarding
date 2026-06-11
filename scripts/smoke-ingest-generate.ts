// End-to-end verification of the ingestion → generation handoff, on REAL files.
// Proves: upload a PDF / .docx → clean markdown → cards generate (real Sonnet).
// No DB writes (skips persistence; just the parse+generate path). Run:
//   set -a; . ./.env.local; set +a; pnpm exec tsx scripts/smoke-ingest-generate.ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseToMarkdown } from "../lib/ingestion";
import { generateCards } from "../lib/generation/generate";

const FIX = path.join(process.cwd(), "services", "ingestion-py", "fixtures");
const files = ["simple.pdf", "simple.docx"];

(async () => {
  for (const file of files) {
    const bytes = readFileSync(path.join(FIX, file));
    const { markdown, parser } = await parseToMarkdown(bytes, file);
    console.log(`\n========== ${file} (parser=${parser}) ==========`);
    console.log("markdown[:200]:", JSON.stringify(markdown.slice(0, 200)));
    const cards = await generateCards(markdown);
    for (const c of cards) {
      console.log(`  • [${c.term}] ${c.definition}`);
      console.log(`      ↳ "${c.source_span}"`);
    }
    console.log(`  → ${cards.length} cards generated from ${file}`);
    if (cards.length === 0) throw new Error(`No cards generated from ${file}`);
  }
  console.log("\n✓ ingestion → generation verified on real PDF + .docx");
})().catch((e) => {
  console.error("✗ failed:", e);
  process.exit(1);
});
