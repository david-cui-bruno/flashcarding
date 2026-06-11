// Throwaway smoke test for the DETERMINISTIC generation core — chunking and the
// quality gate (docs/PIPELINE.md stages 0 and 3). Needs no API key. Run:
//   pnpm exec tsx scripts/smoke-gen.ts
//
// The async pipeline (Batch API submit → poll → self-fix → persist) is verified
// live against Supabase + Anthropic; this only checks the pure logic.
import { chunkSource } from "../lib/generation/chunk";
import { gateCards } from "../lib/generation/gates";
import type { GeneratedCard } from "../lib/types/domain";

const source = `The Sea Ranch (Condominium One) is a residential complex on the Sonoma County coast of California, built between 1963 and 1965. It was designed by the firm MLTW — Charles Moore, Donlyn Lyndon, William Turnbull, and Richard Whitaker. The design uses rough-sawn wood, shed roofs, and forms borrowed from local agricultural buildings, rejecting the International Style in favor of regional, site-specific architecture. The surrounding development followed strict ecological guidelines, pioneering environmentally sensitive planning. It is considered a key early work of postmodern architecture.`;

// Drafted cards spanning every gate outcome.
const drafted: GeneratedCard[] = [
  { term: "Sea Ranch (Condominium One)", definition: "Located in Sonoma County, CA", source_span: "Sonoma County coast of California" },
  { term: "Sea Ranch (Condominium One)", definition: "Built between 1963 and 1965", source_span: "built between 1963 and 1965" },
  { term: "Sea Ranch (Condominium One)", definition: "Located in Sonoma County, CA", source_span: "Sonoma County coast of California" }, // duplicate
  { term: "Sea Ranch", definition: "Sea Ranch", source_span: "The Sea Ranch" }, // circular
  { term: "", definition: "Has a roof", source_span: "shed roofs" }, // empty
  { term: "Sea Ranch (Condominium One)", definition: "Won the 1980 Pritzker Prize", source_span: "awarded the Pritzker Prize in 1980" }, // ungrounded (fabricated quote)
  { term: "What materials does the design use?", definition: "rough-sawn wood, shed roofs", source_span: "rough-sawn wood, shed roofs" }, // malformed (term is a question)
];

const chunks = chunkSource(source);
console.log(`Chunks: ${chunks.length}\n`);

const { accepted, rejected, malformed } = gateCards(drafted, source);

console.log(`ACCEPTED (${accepted.length}):`);
for (const c of accepted) console.log(`  • [${c.term}] ${c.definition}`);

console.log(`\nREJECTED (${rejected.length}):`);
for (const r of rejected) console.log(`  • (${r.rule}) [${r.card.term}] ${r.card.definition} — ${r.reason}`);

console.log(`\nMALFORMED → self-fix (${malformed.length}):`);
for (const m of malformed) console.log(`  • [${m.card.term}] ${m.card.definition} — ${m.reason}`);
