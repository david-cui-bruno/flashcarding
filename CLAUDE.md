# Cardstock

Cardstock turns long documents — PDFs, Word docs, markdown, and pasted text — into high-quality, atomic flashcards using AI, reviewed on an Anki-style spaced-repetition schedule (FSRS). It is a personal tool for someone who learns best through memorization, built so it can become a product later.

## How to use these docs (read this first)

The spec lives in `docs/`. It is split into two layers, and the layers have different rules:

**🔒 Frozen docs — intent & contracts. Do NOT drift through v1.**
- `docs/VISION.md` — what Cardstock is and the v1 scope.
- `docs/CARD-QUALITY.md` — **the keystone.** What a good card is. Everything references it.
- `docs/METRICS.md` — what we optimize for and how we measure it.
- `docs/SCHEDULING.md` — the spaced-repetition behavior.

These describe *what* and *why*, not *how*. They should not need to change while we build v1. **If the code needs to diverge from a frozen doc, stop and flag it in your response — do not silently rewrite the doc.** A divergence is a decision the human makes, not a thing an agent patches away.

**Living docs — contracts at the implementation boundary. May evolve.**
- `docs/PIPELINE.md` — how documents become cards.
- `docs/ARCHITECTURE.md` — stack and system boundaries.
- `docs/BUILD-PLAN.md` — phasing + which files each parallel stream owns (read before fanning out agents).
- `docs/FUTURE-IDEAS.md` — explicitly out of v1 scope; do not build these.

Living docs describe behavior at the contract level. **The code is the source of truth for implementation details** (exact schemas, file layout, library versions). Do not duplicate a schema or type in prose in two places — define it once in code and reference it. Duplicated facts are what drift apart.

## The anti-drift rule, in one line
Docs = intent and contracts. Code = source of truth for implementation. When they conflict, surface it; don't paper over it.

## The single most important principle
`docs/CARD-QUALITY.md` defines "a good card" exactly once, and that definition is reused three ways: as the **generation prompt's instructions**, as the **grounding/quality gate**, and as the **evaluation rubric**. If you change how cards are judged, generated, or evaluated, change it there — not in three places.

## Stack note
Next.js 16 + React 19 + Tailwind v4, TypeScript, Supabase, generation on Claude `claude-sonnet-4-6` (server-side). This is newer than most training data — heed the Next.js guidance below before writing framework code.

@AGENTS.md
