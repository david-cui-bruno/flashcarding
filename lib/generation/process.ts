// Completion side of the async pipeline. Called when a generation_jobs row is
// polled: retrieve the Anthropic batch, and once it has ended, run the drafted
// cards through the deterministic gate + self-fix (docs/PIPELINE.md stage 3),
// then persist the survivors as pending cards in a fresh collection named after
// the source. Updating the job row is what the client's Realtime subscription
// observes.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropic } from "./anthropic";
import { gateCards, cardKey } from "./gates";
import { selfFixMalformed } from "./selffix";
import { generateDeckTitle } from "./title";
import type { GeneratedCard } from "@/lib/types/domain";
import type { Database } from "@/lib/types/database";

type DB = SupabaseClient<Database>;
type Job = Database["public"]["Tables"]["generation_jobs"]["Row"];

export type ProcessOutcome =
  | { status: "running" }
  | { status: "succeeded"; cardsGenerated: number }
  | { status: "failed"; error: string };

// Pull the drafted cards out of a finished batch's results.
async function collectDraftedCards(batchId: string): Promise<{
  cards: GeneratedCard[];
  succeeded: number;
  errored: number;
}> {
  const cards: GeneratedCard[] = [];
  let succeeded = 0;
  let errored = 0;

  for await (const item of await getAnthropic().messages.batches.results(batchId)) {
    if (item.result.type !== "succeeded") {
      errored += 1;
      continue;
    }
    succeeded += 1;
    const text = item.result.message.content.find((b) => b.type === "text")?.text;
    if (!text) continue;
    try {
      const parsed = JSON.parse(text) as { cards?: GeneratedCard[] };
      if (parsed.cards) cards.push(...parsed.cards);
    } catch {
      // A single request returned non-JSON — skip it, keep the rest.
    }
  }
  return { cards, succeeded, errored };
}

// Gate → self-fix malformed → re-gate the fixes → combined accepted set.
async function gateAndFix(
  drafted: GeneratedCard[],
  sourceText: string,
): Promise<GeneratedCard[]> {
  const first = gateCards(drafted, sourceText);
  const accepted = [...first.accepted];

  if (first.malformed.length > 0) {
    const fixed = await selfFixMalformed(first.malformed);
    // Re-gate the fixes against the source AND the already-accepted keys so a
    // fix can't reintroduce a duplicate. Malformed-again fixes are dropped.
    const existingKeys = accepted.map((c) => cardKey(c.term, c.definition));
    const second = gateCards(fixed, sourceText, existingKeys);
    accepted.push(...second.accepted);
  }
  return accepted;
}

async function failJob(supabase: DB, job: Job, error: string): Promise<ProcessOutcome> {
  await supabase
    .from("generation_jobs")
    .update({ status: "failed", error })
    .eq("id", job.id)
    .eq("status", "running");
  return { status: "failed", error };
}

/**
 * Advance one generation job. Idempotent enough for client-driven polling: if
 * the batch isn't finished it returns { running }; if it has already been
 * processed (cards exist for this job) it won't double-insert.
 */
export async function processBatch(supabase: DB, job: Job): Promise<ProcessOutcome> {
  if (job.status !== "running") {
    return job.status === "succeeded"
      ? { status: "succeeded", cardsGenerated: job.cards_generated }
      : job.status === "failed"
        ? { status: "failed", error: job.error ?? "Generation failed." }
        : { status: "running" };
  }
  if (!job.anthropic_batch_id) return { status: "running" };

  const batch = await getAnthropic().messages.batches.retrieve(job.anthropic_batch_id);
  if (batch.processing_status !== "ended") return { status: "running" };

  // Idempotency guard: if a prior poll already inserted cards for this job,
  // don't reprocess — just settle the status.
  const { data: existing } = await supabase
    .from("cards")
    .select("id")
    .eq("generation_job_id", job.id)
    .limit(1);
  if (existing && existing.length > 0) {
    await supabase
      .from("generation_jobs")
      .update({ status: "succeeded" })
      .eq("id", job.id)
      .eq("status", "running");
    return { status: "succeeded", cardsGenerated: job.cards_generated };
  }

  // Need the source text (grounding) and title (collection name).
  if (!job.source_id) return failJob(supabase, job, "Generation job has no source.");
  const { data: source } = await supabase
    .from("sources")
    .select("content, title")
    .eq("id", job.source_id)
    .single();
  if (!source) return failJob(supabase, job, "Source not found.");

  // A throw here (transient network/API error reading results) propagates to
  // the route → 500 → the client polls again. We only fail the job for terminal
  // conditions (below), never for a blip.
  const { cards: drafted, succeeded, errored } = await collectDraftedCards(
    job.anthropic_batch_id,
  );

  if (succeeded === 0) {
    return failJob(supabase, job, `All ${errored} generation request(s) failed.`);
  }

  const accepted = await gateAndFix(drafted, source.content);

  // One collection per run, named after the source (cards reassignable later).
  // Ask the model for a short topical title from the cards; fall back to the
  // source-derived title (first line of paste / filename) if it can't.
  const title = await generateDeckTitle(accepted, source.title ?? "Generated cards");
  const { data: collection, error: colErr } = await supabase
    .from("collections")
    .insert({ user_id: job.user_id, name: title })
    .select("id")
    .single();
  if (colErr || !collection) {
    return failJob(supabase, job, colErr?.message ?? "Could not create collection.");
  }

  if (accepted.length > 0) {
    const rows = accepted.map((c) => ({
      user_id: job.user_id,
      collection_id: collection.id,
      source_id: job.source_id,
      generation_job_id: job.id,
      term: c.term,
      definition: c.definition,
      source_span: c.source_span,
      review_status: "pending" as const,
    }));
    const { error: cardsErr } = await supabase.from("cards").insert(rows);
    if (cardsErr) return failJob(supabase, job, cardsErr.message);
  }

  // Cards are persisted before the status flips, so the Realtime "succeeded"
  // event never races ahead of the rows the review page will query.
  await supabase
    .from("generation_jobs")
    .update({ status: "succeeded", cards_generated: accepted.length })
    .eq("id", job.id)
    .eq("status", "running");

  return { status: "succeeded", cardsGenerated: accepted.length };
}
