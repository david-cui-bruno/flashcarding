# FUTURE-IDEAS (living) — explicitly out of v1 scope

Parked deliberately so they're not lost and not built early. **Do not implement these in v1.** Each was discussed and consciously deferred.

- **Deck scouting / discovery.** Auto-find high-quality public Anki/Quizlet decks for a topic and import them, instead of always generating. Real insight (a lot of good cards already exist), but it's a separate product (search + quality-judging + dedup against the user's cards). v2+.
- **Anki / Quizlet import.** Bringing in existing decks to study alongside generated ones (and exporting Carding decks out, for portability / no lock-in). A near-term nice-to-have (just an import/export path) — likely the first thing after v1, but not v1.
- **Web-searched / AI-generated images.** Sourcing card images beyond the document + manual paste. Deferred for hallucination and licensing reasons.
- **Offline review.** Studying without connectivity (local-first cache + sync). v2.
- **A granularity dial.** A per-document concise/balanced/exhaustive control. Dropped in favor of one well-defined "balanced" default; easy to add later if the single default proves too rigid.
- **True "all cards daily" toggle.** A mode that surfaces every card every day regardless of FSRS. Cram mode covers the intent for now (`SCHEDULING.md`); a real toggle is trivial to add if wanted.
- **Bulk / "trust" review mode.** A fast keep-all triage beyond the card-by-card Tinder flow, for when the edit rate is very low (the "trust" rung of the ladder in `METRICS.md`).
- **Prompt-optimizer for the feedback loop.** Once there are hundreds of review examples, auto-select the best example set / instructions (e.g., DSPy) instead of hand-picking few-shot examples.
- **Native desktop shell.** Electron/Tauri wrapper, only if OS-level features are ever needed beyond what the PWA gives.
