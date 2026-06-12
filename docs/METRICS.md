# METRICS 🔒 (frozen)

What Cardstock optimizes for, how we measure it, and the thresholds that drive the human-review workflow.

## North star
- **Near-term north star — Card Quality (metric B): the edit rate.** Of the cards the user reviews, what fraction does the user keep *without editing*? If the user doesn't trust the cards, nothing else matters, so this is the number we watch first. Higher is better.
- **Long-term goal — Retention (metric A).** Everything is ultimately in service of long-term recall: the fraction of cards recalled correctly at their scheduled review, with a low lapse rate. This is the reason the product exists; B is the lever we pull to get there.

## How each is measured
- **Edit rate (B):** every review action is logged — kept-as-is / edited / rejected (with reason). `edit_rate = (edited + rejected) / reviewed`, computed per generation batch and as a rolling average. Edits and rejection reasons also feed the taste-tuning loop (`PIPELINE.md`).
- **Retention (A):** derived from FSRS review history — the success rate on cards at the moment they come due, versus the configured target retention (`SCHEDULING.md`). Reported as a rolling number and per collection.

## Guardrails (must hold regardless of B/A)
- **Faithfulness / zero hallucination.** Every card must be grounded in the source (hard rule #2 in `CARD-QUALITY.md`). A card that can't be traced to the source is a defect, not a low-quality card — it never ships.
- **Coverage.** A generated deck should not silently miss the important content of its source. Coverage is hard to measure automatically in v1; the user's sense during review is the signal, and the generous inclusion bar (`CARD-QUALITY.md`) biases toward not missing things.

## The human-in-the-loop graduation ladder (driven by metric B)
Review effort should fall automatically as the generator learns the user's taste. The mode is governed by the measured edit rate, not a guess:

1. **Review-all** (start). Every generated card goes through the Tinder review flow. This builds the example set that tunes generation.
2. **Spot-check** — entered once the rolling edit rate drops **below ~15%**. The user reviews a random ~20% sample of each new batch instead of all of it.
3. **Trust** — entered once the sampled edit rate stays **below ~10%** across several batches. New cards go straight into the deck; the user only fixes bad cards encountered *during study* (a "this card is bad" action), which also feeds the loop.

These thresholds (15% / 10% / 20% sample) are **starting points** — they live here so they're tuned in one place, from real data, not scattered in code. There is no published edit-rate number for our model on this task, so measuring our own is the point.

## What we explicitly do not optimize for
- Not raw card count (more cards is not better; the inclusion bar governs quantity).
- Not generation speed beyond "fast enough" (generation is async; `ARCHITECTURE.md`).
- Not cost at personal scale (it's negligible; `ARCHITECTURE.md`).
