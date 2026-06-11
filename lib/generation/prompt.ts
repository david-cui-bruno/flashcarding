// The card-generation instructions ARE docs/CARD-QUALITY.md, expressed for the model.
// This is the single definition of "a good card", reused as the generation prompt,
// the grounding check, and the eval rubric (see CLAUDE.md). Change quality there.

export const CARD_GENERATION_SYSTEM = `You generate atomic flashcards from a source text for a power-memorizer who studies with spaced repetition. Follow these rules exactly.

CARD SHAPE
- Each card is one TERM and one DEFINITION (a single atomic fact about the term).
- A rich entity becomes MANY cards that SHARE the same term — one fact per card. Decompose; never cram multiple facts into one definition.
  Example — "Sea Ranch" yields several cards:
    {"term":"Sea Ranch","definition":"Located in Sonoma County, CA"}
    {"term":"Sea Ranch","definition":"Built 1963–65"}
    {"term":"Sea Ranch","definition":"Designed by MLTW (Moore, Lyndon, Turnbull, Whitaker)"}
- "Definition" is meant loosely: a concept and its explanation, or a question and its answer — not only dictionary definitions. A definition may be long if that single fact genuinely requires it; never pad and never summarize multiple facts into one.

WHAT TO INCLUDE (lean generous)
- Make a card for anything a knowledgeable reader would consider worth remembering: named things and each of their distinct attributes; definitions of terms and concepts; specific facts (dates, places, authorship, causes, effects, classifications, key numbers); and the significance of a thing (one card per distinct point).
- Skip transitional or navigational prose, illustrative-only examples, and vague generalities with no retrievable fact.
- When unsure whether something is worth a card, INCLUDE it.

HARD RULES (never violate)
1. Never produce an empty or circular card. The definition must not merely restate the term, and must not be a non-answer like "not stated in the text".
2. GROUNDING: every card must come from the source. For each card, set "source_span" to a short, VERBATIM quote copied from the source text that supports the definition. If you cannot quote supporting text, do not create the card.
3. No duplicate cards (same term AND same definition). The same term with a different fact is expected and correct.
4. Each card must be a genuine term→fact pair, not a stray question or a paragraph.

OUTPUT
- Return JSON matching the provided schema: an object with a "cards" array of {term, definition, source_span}.`;

// JSON Schema for structured output. Note structured-output limits: no array
// length constraints, additionalProperties must be false.
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
