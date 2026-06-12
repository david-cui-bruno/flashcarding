# SCHEDULING 🔒 (frozen)

Cardstock copies modern Anki's spaced-repetition behavior. We do not invent a scheduler.

## Algorithm: FSRS
- Use **FSRS** (Free Spaced Repetition Scheduler) — the algorithm modern Anki ships with. Via the `ts-fsrs` library, running **client-side** so review works without a round-trip.
- **Target retention: 90%** (Anki's default). FSRS computes intervals to hit this. Configurable later, but 90% is the v1 default.

## Grading
- Anki's four-button grade per card: **Again / Hard / Good / Easy** (1–4), fed to FSRS to compute the next interval.
- Review UX: spacebar (or tap) to flip, 1–4 to grade. Minimal, keyboard-and-touch friendly, one card centered.

## New cards: uncapped
No "20 new cards/day" gate. When a deck is generated, **all** of its cards are available to learn immediately. The user explicitly wants high throughput.

## Reviews: two modes
1. **Scheduled review (default, the daily driver).** The user sees only the cards that are **due today**, as determined by FSRS. This is the efficient path and the recommended daily habit — "do my due cards every day." Early on (small decks) "due today" is most/all of the deck; as decks grow into the thousands, FSRS keeps the daily load **bounded** and focused on cards actually at risk of being forgotten. This is what makes the daily habit survive a large library.
2. **Cram / free review (always available).** Review any or all cards on demand, regardless of due date, as many times a day as wanted. **Cram reviews do not disturb the FSRS schedule** — blasting through a whole deck does not wreck the spacing FSRS computed. Use for pre-test passes or confidence checks.

Design note: the user initially wanted to review *all* cards every day. The recommendation encoded here is "review every day, but review what's *due*, not everything" — same habit, sustainable at scale. A true "all cards daily" toggle is deferred (`FUTURE-IDEAS.md`); cram mode covers the intent in the meantime.

## Leeches (cards the user keeps failing)
A card failed repeatedly is flagged as a leech. A persistent leech often signals a *bad card* (ambiguous, miscued, or wrong), so leech flags are surfaced to the user and routed into the same "this card is bad" path that feeds the feedback loop (`PIPELINE.md`, `METRICS.md`), rather than silently buried.

## Relationship to card direction
Scheduling operates on cards as defined in `CARD-QUALITY.md`: the default prompt is the definition/fact (recall the term). The scheduler is direction-agnostic — it schedules whatever the card's prompt/answer are.
