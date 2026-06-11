// End-to-end verification of the ingestion → generation handoff, on REAL files.
// Proves: upload a PDF / .docx → clean markdown → a generation Batch is accepted
// (real Anthropic Batch API). Generation is async now, so this verifies the handoff
// and submission — the cards land later via the poll route — not the final cards.
// No DB writes. Run:
//   set -a; . ./.env.local; set +a; pnpm exec tsx scripts/smoke-ingest-generate.ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseToMarkdown } from "../lib/ingestion";
import { submitGenerationBatch } from "../lib/generation/submit";

const FIX = path.join(process.cwd(), "services", "ingestion-py", "fixtures");
const files = ["simple.pdf", "simple.docx"];

(async () => {
  for (const file of files) {
    const bytes = readFileSync(path.join(FIX, file));
    const { markdown, parser } = await parseToMarkdown(bytes, file);
    console.log(`\n========== ${file} (parser=${parser}) ==========`);
    console.log("markdown[:200]:", JSON.stringify(markdown.slice(0, 200)));
    // No few-shot examples in a smoke run (brand-new-user path).
    const submitted = await submitGenerationBatch(markdown, []);
    if (!submitted) throw new Error(`No content to generate from ${file}`);
    console.log(`  → generation batch accepted: ${submitted.batchId}`);
  }
  console.log("\n✓ ingestion → generation handoff verified on real PDF + .docx");
})().catch((e) => {
  console.error("✗ failed:", e);
  process.exit(1);
});
