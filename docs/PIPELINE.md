# PIPELINE (living)

How a document becomes cards. This describes the **stages and the contract between them** (what each stage takes and produces), not the code. The card-quality rules referenced throughout are defined once in `CARD-QUALITY.md`.

## Principles
- **Generation is asynchronous** (Batch API). The user submits a source and comes back to a finished deck — no real-time wait, no timeouts on big inputs, ~half the cost. See `ARCHITECTURE.md`.
- **No LLM-as-judge.** Quality control is deterministic gates + source-grounding + the user's review + a feedback loop. No second model rates cards on a rubric.
- **Everything is grounded.** Every card traces back to a span of the source text; ungrounded cards are rejected.

## Stages

**0. Ingest → clean text.**
- Pasted text / markdown: used directly (little or no parsing).
- PDF / Word: parsed to clean markdown (see `ARCHITECTURE.md` for the parser choice).
- Output: normalized source text, chunked into semantic sections for long documents (chunk for *quality* — to keep model attention high — not just for capacity).

**1. Extract knowledge points (not cards yet).**
- For each chunk, extract the atomic facts worth knowing as `(term, fact, source_span)` candidates, applying the **inclusion bar** from `CARD-QUALITY.md` (lean generous). Separating "what is worth knowing" from "how to phrase the card" materially improves quality.
- Output: a list of candidate knowledge points, each carrying the source span it came from.

**2. Draft atomic cards.**
- Turn each knowledge point into one atomic `(term, definition)` card per the card model and the **atomicity-by-decomposition** principle in `CARD-QUALITY.md`. Rich entities become many same-term cards.
- Use **structured output** so cards come back as validated data, not prose to parse.
- Attach relevant **images** where the source provides them (the multimodal model associates figures/photos with the concept they illustrate). See `ARCHITECTURE.md`.
- Output: drafted cards, each linked to a source span.

**3. Quality gate (deterministic) + self-fix.**
- Apply the **four hard rules** from `CARD-QUALITY.md`: reject empty/circular, ungrounded, duplicate (term+definition), or malformed cards.
- **Grounding check** is deterministic: confirm the card's content overlaps the source span it claims (span/substring/fuzzy overlap). No model judgment.
- **Self-fix** runs only for malformed cards (rule #4): the failing card plus the reason are fed back to the model to rewrite, then re-gated. (This is the model correcting a rule violation in its own output — not a judge.)
- Output: cards that cleared the gate, ready for review.

**4. Human review (Tinder flow).**
- The user reviews the batch card-by-card: **swipe right = keep, swipe left = reject → "what was wrong?" prompt, tap = edit before keeping.**
- How much gets reviewed (all / sample / none) is governed by the graduation ladder in `METRICS.md`.
- Every action — kept / edited (with the before→after) / rejected (with reason) — is logged.

**5. Feedback loop (taste-tuning, not fine-tuning).**
- The review actions become **in-context examples**: when generating future cards, a handful of the user's most relevant past examples are injected into the generation prompt as "how this user likes cards written." Edits (before→after deltas) are the strongest signal; rejections teach what to avoid.
- We do **not** retrain a model. This is prompt-level / dynamic few-shot learning; tens of examples meaningfully move it.
- Later (out of v1), a prompt-optimizer (e.g., DSPy) could auto-select the best example set from a large history — see `FUTURE-IDEAS.md`.

## Output contract
A generation run produces a set of cards (each with term, definition, optional image(s), source span, FSRS state) dropped into a collection named after the source. The user reassigns cards to collections freely (one collection per card). See `CARD-QUALITY.md` for the card model and `ARCHITECTURE.md` for storage.
