// The feedback-loop selection helper (docs/PIPELINE.md stage 5, docs/METRICS.md).
//
// Taste-tuning, not fine-tuning: when generating new cards, the pipeline injects a handful
// of the user's most relevant past KEPT and EDITED cards as few-shot examples — "how this
// user likes cards written." Edits (before→after deltas) are the strongest signal; kept
// cards confirm the house style. This selects that handful.
//
// ── CONTRACT for the generation-pipeline stream ──────────────────────────────────────
// Call `selectFewShotExamples({ client, userId, sourceText?, collectionId?, limit? })`.
// You pass a server-side Supabase client (admin or user-scoped) so this stays decoupled
// from request context and runs fine from the Batch pipeline. It returns FewShotExample[]
// already ranked best-first — render them straight into the generation prompt.
// Signature is intentionally stable; treat changes here as a contract change.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { SEED_EXAMPLES } from "./seed-examples";

export type CardText = { term: string; definition: string };

export type FewShotExample = CardText & {
  /** Whether the user kept the model's card as-is or rewrote it. */
  kind: "kept" | "edited";
  /** For edits: what the model originally produced. The (before → here) delta is the lesson. */
  before: CardText | null;
};

export type SelectExamplesParams = {
  /** Server-side Supabase client (admin or user-scoped). Required — no hidden client. */
  client: SupabaseClient<Database>;
  userId: string;
  /** The text being generated from. Examples are ranked by relevance to it when provided. */
  sourceText?: string;
  /** Prefer examples from this collection (e.g. same topic) when set. */
  collectionId?: string | null;
  /** How many examples to return. Default 12 — tens of examples meaningfully move the model. */
  limit?: number;
  /** How many recent feedback rows to consider before ranking. Default 200. */
  candidatePool?: number;
};

const DEFAULT_LIMIT = 12;
const DEFAULT_POOL = 200;

type FeedbackRow = {
  action: Database["public"]["Enums"]["feedback_action"];
  before: Database["public"]["Tables"]["generation_feedback"]["Row"]["before"];
  after: Database["public"]["Tables"]["generation_feedback"]["Row"]["after"];
  created_at: string;
  card: { term: string; definition: string; collection_id: string | null } | null;
};

export async function selectFewShotExamples(
  params: SelectExamplesParams,
): Promise<FewShotExample[]> {
  const {
    client,
    userId,
    sourceText,
    collectionId,
    limit = DEFAULT_LIMIT,
    candidatePool = DEFAULT_POOL,
  } = params;

  const { data, error } = await client
    .from("generation_feedback")
    .select("action, before, after, created_at, card:cards(term, definition, collection_id)")
    .eq("user_id", userId)
    .in("action", ["kept", "edited"])
    .order("created_at", { ascending: false })
    .limit(candidatePool);
  if (error || !data) return SEED_EXAMPLES.slice(0, limit); // fall back to house style

  const sourceTokens = tokenize(sourceText ?? "");
  const rows = data as unknown as FeedbackRow[];

  const scored = rows
    .map((row, idx) => toExample(row, idx, rows.length, sourceTokens, collectionId))
    .filter((x): x is Scored => x !== null)
    .sort((a, b) => b.score - a.score);

  // Reserve up to half the slots for the strongest edits — edits are the strongest taste
  // signal (docs/PIPELINE.md), so a topically-irrelevant relevance score shouldn't bury
  // them. Fill the rest by overall relevance, then present best-first.
  const editQuota = Math.min(
    scored.filter((s) => s.example.kind === "edited").length,
    Math.ceil(limit / 2),
  );
  const chosen = new Set<Scored>();
  for (const s of scored) {
    if (chosen.size >= editQuota) break;
    if (s.example.kind === "edited") chosen.add(s);
  }
  for (const s of scored) {
    if (chosen.size >= limit) break;
    chosen.add(s);
  }
  const result = [...chosen].sort((a, b) => b.score - a.score).map((s) => s.example);

  // Backfill with curated house-style seeds (lib/feedback/seed-examples.ts) so the
  // generator has taste from day one. Seeds go last (lowest priority) and only fill
  // slots the user's own kept/edited examples didn't — so real history takes over as
  // it grows past `limit`.
  if (result.length < limit) {
    const have = new Set(result.map((e) => `${e.term}\n${e.definition}`.toLowerCase()));
    for (const seed of SEED_EXAMPLES) {
      if (result.length >= limit) break;
      const key = `${seed.term}\n${seed.definition}`.toLowerCase();
      if (!have.has(key)) {
        result.push(seed);
        have.add(key);
      }
    }
  }
  return result;
}

type Scored = { example: FewShotExample; score: number };

function toExample(
  row: FeedbackRow,
  idx: number,
  total: number,
  sourceTokens: Set<string>,
  preferCollection: string | null | undefined,
): { example: FewShotExample; score: number } | null {
  const kind = row.action === "edited" ? "edited" : "kept";
  // The example text is the user's preferred form: the edited result, else the kept card.
  const after = asCardText(row.after);
  const text = kind === "edited" ? (after ?? asCardText(row.card)) : asCardText(row.card);
  if (!text) return null; // card deleted or malformed feedback — skip

  const before = kind === "edited" ? asCardText(row.before) : null;

  // Score: edits teach most; then topical overlap with the source; then same collection;
  // then recency (rows arrive newest-first, so earlier idx = more recent).
  let score = kind === "edited" ? 1.0 : 0.6;
  score += overlap(sourceTokens, tokenize(`${text.term} ${text.definition}`)) * 1.5;
  if (preferCollection && row.card?.collection_id === preferCollection) score += 0.5;
  score += total > 0 ? (1 - idx / total) * 0.3 : 0;

  return { example: { ...text, kind, before }, score };
}

// Narrow a JSONB before/after column (or a joined card row) to {term, definition}.
function asCardText(v: unknown): CardText | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.term === "string" && typeof o.definition === "string") {
    return { term: o.term, definition: o.definition };
  }
  return null;
}

const STOP = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "are",
  "was", "were", "by", "with", "as", "at", "it", "its", "that", "this", "from",
]);

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

/** Fraction of the example's tokens that also appear in the source (0..1). */
function overlap(source: Set<string>, example: Set<string>): number {
  if (source.size === 0 || example.size === 0) return 0;
  let hits = 0;
  for (const t of example) if (source.has(t)) hits++;
  return hits / example.size;
}
