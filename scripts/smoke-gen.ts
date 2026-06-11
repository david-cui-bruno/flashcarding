// Throwaway smoke test for the generation core. Run:
//   set -a; . ./.env.local; set +a; pnpm exec tsx scripts/smoke-gen.ts
import { generateCards } from "../lib/generation/generate";

const text = `The Sea Ranch (Condominium One) is a residential complex on the Sonoma County coast of California, built between 1963 and 1965. It was designed by the firm MLTW — Charles Moore, Donlyn Lyndon, William Turnbull, and Richard Whitaker. The design uses rough-sawn wood, shed roofs, and forms borrowed from local agricultural buildings, rejecting the International Style in favor of regional, site-specific architecture. The surrounding development followed strict ecological guidelines, pioneering environmentally sensitive planning. It is considered a key early work of postmodern architecture, demonstrating that modern buildings could be rooted in place and local building traditions rather than universal abstraction.`;

(async () => {
  const cards = await generateCards(text);
  for (const c of cards) {
    console.log(`• [${c.term}] ${c.definition}`);
    console.log(`    ↳ "${c.source_span}"`);
  }
  console.log(`\n${cards.length} cards generated.`);
})();
