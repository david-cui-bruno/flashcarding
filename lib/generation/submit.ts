// Submit side of the async pipeline (docs/PIPELINE.md stages 0–2 + ARCHITECTURE
// "Batch API"). Chunk the source, build one Batch API request per chunk (each
// doing extract→draft via the two-step prompt), and submit. Returns the
// Anthropic batch id; the caller stores it on the generation_jobs row and the
// client subscribes to that row via Realtime.
//
// IMPLEMENTATION NOTE (surfaced per CLAUDE.md anti-drift rule): PIPELINE
// describes extract-knowledge-points (stage 1) and draft-cards (stage 2) as
// distinct stages. The generation_jobs schema carries a SINGLE anthropic_batch_id
// and the Batch API has no inter-request dependencies, so a literal two-batch
// pipeline can't be expressed without a schema change (which the contract
// forbids). We therefore run both steps inside each per-chunk request: the
// prompt (lib/generation/prompt.ts) instructs the model to first identify
// knowledge points, then draft cards, with adaptive thinking making that
// separation real in the model's reasoning. If the edit rate later shows this
// underperforms a true two-pass, that's a human decision to add a stage.

import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, GENERATION_MODEL } from "./anthropic";
import { chunkSource } from "./chunk";
import { CARD_GENERATION_SYSTEM, CARD_SCHEMA, renderFewShotBlock } from "./prompt";
import type { FewShotExample } from "@/lib/feedback/select-examples";

// custom_id prefix so batch results can be traced back to their chunk.
const CHUNK_PREFIX = "chunk-";

function buildRequests(
  chunks: string[],
  examples: FewShotExample[],
): Anthropic.Messages.Batches.BatchCreateParams.Request[] {
  // The instruction block + this user's few-shot taste are identical across
  // every chunk, so they live in `system` with a cache breakpoint — the source
  // is "read once and reused cheaply across passes" (ARCHITECTURE, prompt
  // caching). Only the per-chunk passage varies, in the user turn.
  const systemText = CARD_GENERATION_SYSTEM + renderFewShotBlock(examples);

  return chunks.map((chunk, i) => ({
    custom_id: `${CHUNK_PREFIX}${i}`,
    params: {
      model: GENERATION_MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: { type: "json_schema", schema: CARD_SCHEMA },
      },
      system: [
        { type: "text", text: systemText, cache_control: { type: "ephemeral" } },
      ],
      messages: [
        {
          role: "user",
          content: `Generate atomic flashcards from this passage:\n\n${chunk}`,
        },
      ],
    },
  }));
}

/**
 * Chunk + build + submit the generation batch. Pure of DB concerns — the caller
 * owns the generation_jobs row. Returns the Anthropic batch id, or null if the
 * source produced no chunks (empty source).
 */
export async function submitGenerationBatch(
  sourceText: string,
  examples: FewShotExample[],
): Promise<{ batchId: string; chunkCount: number } | null> {
  const chunks = chunkSource(sourceText);
  if (chunks.length === 0) return null;

  const batch = await getAnthropic().messages.batches.create({
    requests: buildRequests(chunks, examples),
  });

  return { batchId: batch.id, chunkCount: chunks.length };
}
