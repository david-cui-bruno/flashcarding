# CARD-QUALITY 🔒 (frozen) — the keystone

This is the single source of truth for what a good Cardstock card is. Its contents are reused three ways: the **generation prompt's instructions**, the **quality gate**, and the **evaluation rubric**. Change card quality here and nowhere else.

## The card model
A card is:
- **Term** — the subject / the thing being learned (the *answer* in the default review direction). e.g. `Sea Ranch (Condominium One)`.
- **Definition** — exactly **one atomic fact** about the term (the *prompt* in the default review direction). e.g. `Located in Sonoma County, CA`.
- **Image(s)** — optional, on the front and/or back. From the source document or pasted by the user.
- Plus plumbing (owned by code, see `ARCHITECTURE.md`): a link to the **source span** it came from, the **collection** it belongs to (exactly one), **review status**, and **FSRS scheduling state**.

There is **no cue field, no "extra facts" field, and no length limit.** Richness is expressed as *more cards*, not bigger fields.

## The core principle: atomicity by decomposition
**One card = one term + one fact.** A rich entity is not one fat card — it is **many atomic cards that share the same term.** Example, the ideal decomposition of a Sea Ranch profile:

| Term | Definition (one fact) |
|---|---|
| Sea Ranch (Condominium One) | Located in Sonoma County, CA |
| Sea Ranch (Condominium One) | Built 1963–65 |
| Sea Ranch (Condominium One) | Designed by MLTW — Moore, Lyndon, Turnbull, Whitaker |
| Sea Ranch (Condominium One) | Vernacular design: rough-sawn wood, shed roofs, agricultural forms |
| Sea Ranch (Condominium One) | A planned community with strict ecological guidelines |
| Sea Ranch (Condominium One) | Early postmodernism: modern architecture rooted in place, not universal abstraction |

The same term recurring across many cards is **expected and correct**, not a duplicate.

## Review direction
Stored as `(term, definition)`, but by default the **prompt shown is the definition/fact (and/or image), and the user recalls the term.** ("Sonoma County, CA… → Sea Ranch.") This matches how the user memorizes and, crucially, is **unambiguous**: each fact is a unique prompt, so many cards sharing one term never collide. The reverse direction (show term → recall fact) is **off by default** because it *is* ambiguous when a term has many facts. A per-card manual flip exists for the occasional single-fact card where term-first feels better. (The best default for single-fact cards is worth validating in real use.)

## The inclusion bar — lean generous
> Make a card for **anything a knowledgeable reader would consider worth remembering** from this material — not every sentence, not transitional prose, not passing mentions.

Calibration for this user specifically: **err toward including.** Their memorization capacity is high, so over-including costs little and missing something costs more. When unsure whether a fact is worth a card, include it.

**Keep** (make cards):
- Named things and their distinct attributes (people, works, buildings, terms, events) — decomposed into one fact each.
- Definitions of terms and concepts (interpret "definition" loosely: a concept and its explanation, or a question and its answer — not only dictionary definitions).
- Specific facts: dates, places, authorship, causes, effects, classifications, key numbers.
- The "so what" / significance of a thing, split into separate cards per distinct point.

**Skip** (no card):
- Transitional or navigational prose ("as discussed earlier", "in this section we will…").
- Illustrative examples that only support a concept rather than being worth knowing themselves.
- Vague generalities with no retrievable fact.
- Content the user would obviously already know (calibrated to the user, generously).

## The hard rules (the only automatic gate — a garbage filter, not an atomicity enforcer)
A generated card is **rejected** only if it trips one of these. None of them is a model judging quality on a rubric.
1. **Empty or circular** — term or definition blank; the definition merely restates the term ("X is X"); or a non-answer ("not stated in the source").
2. **Ungrounded** — the card's content cannot be traced to a passage in the source text. This is the hallucination guard. (Verified by span overlap against the source — see `PIPELINE.md`.)
3. **Duplicate** — the same **term *and* definition** already exist in this batch/collection. Same term with a *different* fact is allowed and expected (see decomposition above).
4. **Malformed** — not a term→fact at all (e.g., a stray question, or a paragraph with no identifiable subject).

Only rule **#4** triggers self-fix (rewrite-and-retry); #1–#3 are outright rejections. **There is no length rule and no "no lists" rule** — a long single-fact definition is fine, and intentional decomposition replaces list-cramming.

## Atomicity as guidance (soft), not law
Beyond the hard rules, atomicity is encouraged in the generation prompt — "prefer many small cards over one composite; one fact per card" — but it is **not auto-enforced** and is overridable. The user's review is the arbiter of the gray area, and the feedback loop teaches the user's taste over time (`PIPELINE.md`, `METRICS.md`).

## Quality is *measured*, not asserted
No public source has benchmarked our model on this exact task, and "how good is good enough" is the user's call. The operational definition of card quality is the **edit rate** — how often the user keeps a generated card without changing it (`METRICS.md`). That number, not this prose, tells us whether the cards are good.
