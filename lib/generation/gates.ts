// Stage 3 of docs/PIPELINE.md — the DETERMINISTIC quality gate. These are the
// four hard rules from docs/CARD-QUALITY.md, the "only automatic gate". None of
// them is a model judging quality on a rubric (no LLM-as-judge — PIPELINE §
// Principles). Rules #1–#3 are outright rejections; rule #4 (malformed) is the
// only one that triggers self-fix (lib/generation/selffix.ts).

import type { GeneratedCard } from "@/lib/types/domain";

export type RejectionRule = "empty_or_circular" | "ungrounded" | "duplicate";

export type GateResult = {
  /** Cleared the gate — ready to persist as pending. */
  accepted: GeneratedCard[];
  /** Outright rejected (rules #1–#3). */
  rejected: { card: GeneratedCard; rule: RejectionRule; reason: string }[];
  /** Rule #4 — sent to self-fix, then re-gated. */
  malformed: { card: GeneratedCard; reason: string }[];
};

// --- normalization ----------------------------------------------------------

// Fold unicode punctuation the model may emit (curly quotes, en/em dashes) to
// ASCII so a verbatim source quote still matches the stored source text.
function foldPunct(s: string): string {
  return s
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[‐-―]/g, "-")
    .replace(/ /g, " ");
}

// For exact comparison (circular check, dedupe): lowercase, fold, collapse ws.
function normalize(s: string): string {
  return foldPunct(s).toLowerCase().replace(/\s+/g, " ").trim();
}

// For substring grounding: keep it char-level but ws/case/punct-insensitive.
function normalizeForOverlap(s: string): string {
  return foldPunct(s).toLowerCase().replace(/\s+/g, " ").trim();
}

const STOPWORDS = new Set([
  "the", "and", "for", "are", "was", "were", "with", "that", "this", "from",
  "its", "his", "her", "their", "which", "into", "than", "then", "they",
  "has", "have", "had", "not", "but", "one", "all", "any", "can", "out",
]);

// Significant tokens: alphanumeric runs, minus short stopwords. Numbers (dates,
// quantities) are always kept regardless of length.
function tokens(s: string): string[] {
  const matches = foldPunct(s).toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return matches.filter(
    (t) => /\d/.test(t) || (t.length >= 3 && !STOPWORDS.has(t)),
  );
}

function tokenOverlapRatio(needleTokens: string[], haystack: Set<string>): number {
  if (needleTokens.length === 0) return 0;
  let hit = 0;
  for (const t of needleTokens) if (haystack.has(t)) hit += 1;
  return hit / needleTokens.length;
}

/** Stable dedupe key: same term AND same definition (docs/CARD-QUALITY.md #3). */
export function cardKey(term: string, definition: string): string {
  return `${normalize(term)}\u0000${normalize(definition)}`;
}

// --- rule #1: empty or circular ---------------------------------------------

const NON_ANSWER =
  /^(n\/?a|none|unknown|unclear|not\s+(stated|mentioned|specified|given|provided|listed|available|determined|applicable|in\s+(the\s+)?(source|text|passage)))\b/i;

function isEmptyOrCircular(term: string, definition: string): string | null {
  if (!term.trim() || !definition.trim()) return "term or definition is blank";
  const nt = normalize(term);
  const nd = normalize(definition);
  if (nt === nd) return "definition merely restates the term";
  if (NON_ANSWER.test(definition.trim())) return "definition is a non-answer";
  // "X is X" / "X refers to X": strip the term and connective filler from the
  // definition; if nothing substantive remains, it's circular.
  const stripped = nd
    .replace(nt, " ")
    .replace(/\b(is|are|was|were|refers? to|means|defined as|the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped.length === 0) return "definition is circular";
  return null;
}

// --- rule #2: grounding (the hallucination guard) ---------------------------

function groundingFailure(
  card: GeneratedCard,
  normalizedSource: string,
  sourceTokenSet: Set<string>,
): string | null {
  const span = card.source_span?.trim() ?? "";
  if (!span) return "no source_span quote provided";

  // (a) The cited quote must be traceable to the source — a fabricated quote is
  // the hallucination we reject. Exact (normalized) substring, else high token
  // overlap to tolerate minor punctuation/whitespace drift in the quote.
  const traceable =
    normalizedSource.includes(normalizeForOverlap(span)) ||
    tokenOverlapRatio(tokens(span), sourceTokenSet) >= 0.6;
  if (!traceable) return "source_span is not found in the source text";

  // (b) Backstop: the fact itself must draw on the source vocabulary. A real
  // quote paired with an entirely foreign definition is still ungrounded.
  // Lenient (≥1 shared significant token) so valid paraphrases pass.
  const defTokens = tokens(card.definition);
  if (defTokens.length > 0 && tokenOverlapRatio(defTokens, sourceTokenSet) === 0) {
    return "definition shares no content with the source";
  }
  return null;
}

// --- rule #4: malformed (→ self-fix) ----------------------------------------

function malformedReason(term: string, definition: string): string | null {
  const t = term.trim();
  if (t.endsWith("?")) return "term is a question, not a subject";
  // A term that is really a paragraph: many words or multiple sentences.
  if (t.split(/\s+/).length > 14) return "term is a paragraph, not a subject";
  if (/[.!?]\s+\S/.test(t)) return "term spans multiple sentences";
  if (definition.trim().endsWith("?")) return "definition is a question, not a fact";
  return null;
}

/**
 * Run the deterministic gate over a batch of drafted cards.
 *
 * @param cards drafted cards to gate
 * @param sourceText the full normalized source (for grounding)
 * @param existingKeys cardKey()s already in the batch/collection (for dedupe)
 */
export function gateCards(
  cards: GeneratedCard[],
  sourceText: string,
  existingKeys: Iterable<string> = [],
): GateResult {
  const normalizedSource = normalizeForOverlap(sourceText);
  const sourceTokenSet = new Set(tokens(sourceText));
  const seen = new Set(existingKeys);

  const result: GateResult = { accepted: [], rejected: [], malformed: [] };

  for (const raw of cards) {
    const card: GeneratedCard = {
      term: raw.term?.trim() ?? "",
      definition: raw.definition?.trim() ?? "",
      source_span: raw.source_span?.trim() ?? "",
    };

    const emptyReason = isEmptyOrCircular(card.term, card.definition);
    if (emptyReason) {
      result.rejected.push({ card, rule: "empty_or_circular", reason: emptyReason });
      continue;
    }

    const groundReason = groundingFailure(card, normalizedSource, sourceTokenSet);
    if (groundReason) {
      result.rejected.push({ card, rule: "ungrounded", reason: groundReason });
      continue;
    }

    const key = cardKey(card.term, card.definition);
    if (seen.has(key)) {
      result.rejected.push({
        card,
        rule: "duplicate",
        reason: "same term and definition already in this batch/collection",
      });
      continue;
    }

    const malformed = malformedReason(card.term, card.definition);
    if (malformed) {
      // Don't reserve the dedupe key — the fixed card is re-gated separately.
      result.malformed.push({ card, reason: malformed });
      continue;
    }

    seen.add(key);
    result.accepted.push(card);
  }

  return result;
}
