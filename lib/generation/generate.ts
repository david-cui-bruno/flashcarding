import Anthropic from "@anthropic-ai/sdk";
import { CARD_GENERATION_SYSTEM, CARD_SCHEMA } from "./prompt";
import type { GeneratedCard } from "@/lib/types/domain";

// Walking-skeleton generation: a single synchronous Sonnet 4.6 call with
// structured output. The production pipeline (async Batch API, chunking,
// deterministic gates, grounding verification, self-fix, feedback loop) is the
// "generation pipeline" fan-out stream — see docs/PIPELINE.md and docs/BUILD-PLAN.md.
const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from env

export async function generateCards(sourceText: string): Promise<GeneratedCard[]> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "high",
      format: { type: "json_schema", schema: CARD_SCHEMA },
    },
    system: CARD_GENERATION_SYSTEM,
    messages: [{ role: "user", content: sourceText }],
  });

  const text = response.content.find((b) => b.type === "text")?.text ?? '{"cards":[]}';
  const parsed = JSON.parse(text) as { cards: GeneratedCard[] };
  return parsed.cards ?? [];
}
