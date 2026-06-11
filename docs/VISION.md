# VISION 🔒 (frozen)

## What Carding is
> Paste in (or upload) a document → an AI turns it into a deck of high-quality, atomic flashcards → you review them on an Anki-style spaced-repetition schedule and retain the material long-term.

## The problem it solves
The user learns extremely well through memorization and flashcards, but currently learns by asking an AI questions and reading the answers — with no spaced repetition and no flashcarding. Manually authoring cards from long material is the bottleneck. Carding removes that bottleneck: it produces cards good enough to trust, in the user's style, so the only manual work is light review.

## Who it's for
Initially one power user who memorizes at high volume (hundreds to thousands of cards) and has strong taste about what a good card is. Designed so it can convert into a product for others later — but **personal-tool quality and fit come first; nothing is compromised for hypothetical future users.**

## What "good" means here (the bet)
The hard, differentiating part is **card quality** — cards that are atomic, faithful to the source, and written the way the user likes. Spaced repetition is a solved problem we copy from modern Anki (FSRS). The whole product lives or dies on whether the generated cards are good. See `CARD-QUALITY.md`.

## v1 scope (the first milestone)
Ingest one or more documents and produce a great, studyable deck, with a great review experience, on both phone and desktop.

In scope:
- Inputs: **pasted text and markdown (first-class), plus PDF and Word.**
- AI generation of atomic term→definition cards in the user's style (`PIPELINE.md`).
- A fast, Tinder-style card review/approval flow that also captures feedback.
- Organizing cards into collections.
- FSRS-based study with an Anki-style review loop (`SCHEDULING.md`).
- Images on cards, including image-on-front (visual recognition).
- Works on desktop and mobile as an installable PWA.
- Daily study reminders.
- Username/password auth and cross-device sync.

Out of scope for v1 (see `FUTURE-IDEAS.md`):
- Offline review (v2).
- Scouting/discovering public decks.
- Web-searched or AI-generated images.
- A separate native desktop shell (Electron/Tauri).
- A granularity dial.

## Non-goals / explicit stances
- **No separate LLM-as-judge** for quality. Quality control is deterministic gates + source-grounding + the user's review + a feedback loop (`PIPELINE.md`, `METRICS.md`).
- We deliberately allow **denser cards and a more generous inclusion bar** than textbook spaced-repetition advice, because this user's memorization capacity is unusually high (`CARD-QUALITY.md`).
- Cost is not a constraint at personal scale; it becomes a design input only if Carding becomes a multi-user product (`ARCHITECTURE.md`).

## Document length
There is no hard technical length cap — the model's context window is not the binding constraint. v1 is designed to handle up to roughly a long chapter or paper in a single run, with chunking + hierarchical extraction so it scales to whole books later. The real limit is the user's review and daily study capacity, not the model.
