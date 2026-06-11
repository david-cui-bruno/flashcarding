// The card-generation instructions ARE docs/CARD-QUALITY.md, expressed for the
// model. This is the single definition of "a good card", reused as the
// generation prompt, the grounding check (lib/generation/gates.ts), and the
// eval rubric (see CLAUDE.md). Change card quality there, not here.

import type { FewShotExample } from "@/lib/feedback/select-examples";

export const CARD_GENERATION_SYSTEM = `You generate atomic flashcards from a source text for a power-memorizer who studies with spaced repetition. Follow these rules exactly.

CARD SHAPE
- Each card is one TERM and one DEFINITION (a single atomic fact about the term).
- A rich entity becomes MANY cards that SHARE the same term — one fact per card. Decompose; never cram multiple facts into one definition.
  Example — "Sea Ranch" yields several cards:
    {"term":"Sea Ranch","definition":"Located in Sonoma County, CA"}
    {"term":"Sea Ranch","definition":"Built 1963–65"}
    {"term":"Sea Ranch","definition":"Designed by MLTW (Moore, Lyndon, Turnbull, Whitaker)"}
- "Definition" is meant loosely: a concept and its explanation, or a question and its answer — not only dictionary definitions. A definition may be long if that single fact genuinely requires it; never pad and never summarize multiple facts into one.

PROCESS (two steps — do them in order)
1. First, identify the atomic knowledge points worth knowing in this passage, applying the inclusion bar below. Separate "what is worth knowing" from "how to phrase it" — this materially improves quality.
2. Then turn each knowledge point into exactly one atomic term→fact card, decomposing rich entities into many same-term cards.

WHAT TO INCLUDE (lean generous)
- Make a card for anything a knowledgeable reader would consider worth remembering: named things and each of their distinct attributes; definitions of terms and concepts; specific facts (dates, places, authorship, causes, effects, classifications, key numbers); and the significance of a thing (one card per distinct point).
- Skip transitional or navigational prose, illustrative-only examples, and vague generalities with no retrievable fact.
- When unsure whether something is worth a card, INCLUDE it.

HARD RULES (never violate)
1. Never produce an empty or circular card. The definition must not merely restate the term, and must not be a non-answer like "not stated in the text".
2. GROUNDING: every card must come from the source. For each card, set "source_span" to a short, VERBATIM quote copied from THIS passage that supports the definition. If you cannot quote supporting text, do not create the card.
3. No duplicate cards (same term AND same definition). The same term with a different fact is expected and correct.
4. Each card must be a genuine term→fact pair, not a stray question or a paragraph.

OUTPUT
- Return JSON matching the provided schema: an object with a "cards" array of {term, definition, source_span}.`;

// Self-fix (docs/PIPELINE.md §3): only rule #4 (malformed) triggers a rewrite.
// The model corrects its own rule violation — this is NOT a quality judge.
export const SELF_FIX_SYSTEM = `You are fixing flashcards that failed a structural check. Each input card is malformed: it is not a clean TERM→FACT pair (e.g. the term is a question or a whole paragraph, or there is no identifiable subject).

For each one, rewrite it into a valid card following these rules:
- TERM = the subject being learned; DEFINITION = exactly one atomic fact about it.
- Keep the same underlying fact and the same "source_span" — only restructure into a clean term→fact pair.
- If a card genuinely cannot be expressed as a single term→fact pair, drop it (omit it from the output).
- Decompose into multiple cards only if the malformed card crammed several facts together.

Return JSON matching the provided schema: an object with a "cards" array of {term, definition, source_span}.`;

// JSON Schema for structured output. Structured-output limits: no array-length
// constraints, no string-length constraints, additionalProperties must be false.
export const CARD_SCHEMA = {
  type: "object",
  properties: {
    cards: {
      type: "array",
      items: {
        type: "object",
        properties: {
          term: { type: "string" },
          definition: { type: "string" },
          source_span: { type: "string" },
        },
        required: ["term", "definition", "source_span"],
        additionalProperties: false,
      },
    },
  },
  required: ["cards"],
  additionalProperties: false,
} as const;

// docs/PIPELINE.md §5: the user's past review actions become in-context examples
// of "how this user likes cards written." Rendered as a block appended to the
// stable system prompt so it stays in the cacheable prefix across a job's chunks.
export function renderFewShotBlock(examples: FewShotExample[]): string {
  if (examples.length === 0) return "";

  const kept = examples.filter((e) => e.kind === "kept");
  const edited = examples.filter((e) => e.kind === "edited");
  const rejected = examples.filter((e) => e.kind === "rejected");

  const lines: string[] = [
    "",
    "THIS USER'S TASTE (learn from their past review actions — match this style)",
  ];

  if (kept.length) {
    lines.push("Cards this user kept as-is (good — emulate the phrasing):");
    for (const e of kept) lines.push(`  • ${e.term} → ${e.definition}`);
  }
  if (edited.length) {
    lines.push(
      "Cards this user rewrote (prefer the AFTER style — this is the strongest signal):",
    );
    for (const e of edited) {
      lines.push(
        `  • BEFORE: ${e.before.term} → ${e.before.definition}` +
          `\n    AFTER:  ${e.after.term} → ${e.after.definition}`,
      );
    }
  }
  if (rejected.length) {
    lines.push("Cards this user rejected (avoid making cards like these):");
    for (const e of rejected) {
      lines.push(
        `  • ${e.term} → ${e.definition}${e.reason ? ` (reason: ${e.reason})` : ""}`,
      );
    }
  }
  return lines.join("\n");
}
