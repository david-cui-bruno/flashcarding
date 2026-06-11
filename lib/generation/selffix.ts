// Stage 3 self-fix (docs/PIPELINE.md): ONLY malformed cards (rule #4) are fed
// back to the model to rewrite into a clean term→fact pair, then re-gated. This
// is the model correcting a structural violation in its own output — not a
// quality judge (no LLM-as-judge; PIPELINE § Principles).
//
// It runs at batch-completion time over the handful of malformed cards, so a
// single small synchronous (non-batch) call is the right shape — the async
// Batch API exists to avoid blocking the *user*, and self-fix happens server-
// side after the user has already walked away.

import { getAnthropic, GENERATION_MODEL } from "./anthropic";
import { CARD_SCHEMA, SELF_FIX_SYSTEM } from "./prompt";
import type { GeneratedCard } from "@/lib/types/domain";

export type MalformedCard = { card: GeneratedCard; reason: string };

export async function selfFixMalformed(
  malformed: MalformedCard[],
): Promise<GeneratedCard[]> {
  if (malformed.length === 0) return [];

  const list = malformed
    .map(
      (m, i) =>
        `${i + 1}. PROBLEM: ${m.reason}\n` +
        `   term: ${m.card.term}\n` +
        `   definition: ${m.card.definition}\n` +
        `   source_span: ${m.card.source_span}`,
    )
    .join("\n\n");

  const response = await getAnthropic().messages.create({
    model: GENERATION_MODEL,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: CARD_SCHEMA },
    },
    system: SELF_FIX_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Rewrite these malformed flashcards into valid term→fact cards. Keep each card's source_span unchanged.\n\n${list}`,
      },
    ],
  });

  const text =
    response.content.find((b) => b.type === "text")?.text ?? '{"cards":[]}';
  try {
    const parsed = JSON.parse(text) as { cards?: GeneratedCard[] };
    return parsed.cards ?? [];
  } catch {
    // Malformed JSON from the fixer — drop the batch of fixes rather than throw.
    return [];
  }
}
