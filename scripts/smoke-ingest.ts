// Throwaway smoke test for the ingestion adapter (TS -> Python sidecar boundary).
// Needs no Supabase/Anthropic. Run from the project root:
//   pnpm exec tsx scripts/smoke-ingest.ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseToMarkdown } from "../lib/ingestion";

const FIX = path.join(process.cwd(), "services", "ingestion-py", "fixtures");

const cases: Array<{ file: string; mode?: "auto" | "markitdown" | "docling" }> = [
  { file: "simple.pdf" },
  { file: "simple.docx" },
  { file: "tables.pdf", mode: "docling" },
];

(async () => {
  for (const { file, mode } of cases) {
    const bytes = readFileSync(path.join(FIX, file));
    const res = await parseToMarkdown(bytes, file, { mode });
    console.log(`\n=== ${file} (mode=${mode ?? "auto"}) → parser=${res.parser} ===`);
    if (res.warnings.length) console.log("warnings:", res.warnings);
    console.log(res.markdown.slice(0, 300));
  }
  console.log("\n✓ adapter OK");
})().catch((e) => {
  console.error("✗ adapter failed:", e);
  process.exit(1);
});
