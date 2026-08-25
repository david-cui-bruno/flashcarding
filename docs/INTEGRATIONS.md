# Dory — External Account Integrations (Anki, Quizlet)

_Feasibility + architecture. Created 2026-08-25. Verified against current
sources: AnkiConnect is actively maintained (AnkiWeb #2055492159, compatible
with latest Anki stable); Quizlet's official API is discontinued (confirmed
2026, no legitimate OAuth/link path exists)._

## Summary

| Service | "Link account"? | What we build instead |
|---|---|---|
| Anki | No cloud API (AnkiWeb has none) | ✅ Already: `.apkg` import. Next: **AnkiConnect live sync** (flagship) |
| Quizlet | Official API killed 2020, scraping blocked/ToS-hostile | **Text-export importer** + share-link paste where public pages allow |

## 1. AnkiConnect live sync (flagship "Link your Anki")

AnkiConnect is the de-facto standard local HTTP API plugin (used by Yomichan
etc.), running at `localhost:8765` next to desktop Anki.

Architecture:

```
desktop Anki + AnkiConnect (localhost:8765)
        ▲
        │ JSON-RPC (deckNames, findCards, cardsInfo, updateCards…)
        ▼
Dory sync helper  ──►  Dory API (learndory.com)
```

- **Helper form**: menu-bar companion app (Electron shell already exists in
  `desktop/`) or a CLI. Polls AnkiConnect, diffs against Dory state, pushes
  via authenticated Dory API.
- **Sync scope v1**: one-way Anki → Dory (decks, notes, media, review log).
  v2: two-way review-state merge (FSRS state maps cleanly since both use FSRS;
  conflict rule = latest review wins, mirroring the offline outbox pattern).
- **Why it wins**: nobody does this well; kills the "my life is in Anki"
  objection; fully legitimate (user-installed plugin, user's own machine).
- **Dependencies**: none on Anki's servers. Works offline.

## 2. Quizlet importer (pragmatic)

- Quizlet's own **export** feature emits tab/comma-separated text per set.
  Build `apps: paste Quizlet export` mode in the existing Import tab
  (parser: split on tab or comma, rows = term/definition).
- **Share-link paste**: fetch public set pages server-side where accessible
  and parse embedded JSON; degrade gracefully to "use export" when blocked.
  Treat as best-effort; never require it.
- Marketing copy: "Bring your Quizlet sets" (true via export), not "link
  your Quizlet account" (impossible legitimately).

## Sequencing

1. Quizlet text-export importer — small, ships in a day, rides existing
   import UI.
2. AnkiConnect one-way sync in the desktop helper — flagship, 1–2 weeks.
3. Two-way sync after real-user feedback.

## App Store note

Both are safe for review: no private-API use, no credential harvesting.
AnkiConnect sync is desktop-side; the iOS app just receives synced decks.
