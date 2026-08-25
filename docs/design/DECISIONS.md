# Dory Design System — Decisions (locked 2026-08-25)

Owner-approved after two exploration rounds (docs/design/app-mockups/).

## Typography

| Role | Face | Weights |
|---|---|---|
| Body, headlines, UI | **Schibsted Grotesk** (Google Fonts) | 400 body · 500 UI labels · 600–700 headlines |
| Display numbers (due counts, stats, timers) | **Switzer** (Fontshare) | 200 thin display, tabular where counts change |

- The thin Switzer number against solid Schibsted body is the signature contrast.
- No serifs anywhere.
- Letter-spacing: -.02em headlines, -.04em on display numbers ≥48px.

## Layout

- **Home = A2 "airy hero"** (11-home-round2.html): no card containers, hairline
  dividers only, giant thin due-count as the hero, single Study Now button,
  deck rows as quiet list items with thin count numerals.
- **Study = F "flat sheet"** (09-layouts-study.html): text-first question/answer,
  four grade buttons with FSRS interval previews.
- Tab bar: Decks · Stats · + · Review · Profile (center + opens create sheet).
- Whitespace-forward: prefer air over boxes; borders are hairlines (#e8edf2).

## Color

Unchanged from brand: cerulean #0284c7 as the single accent (buttons, counts,
links), slate ink #0f172a, bg #fafbfc. Grade colors: again #ef4444 /
hard #f59e0b / good #22c55e / easy #0ea5e9.

## Applies to

The native app-mode UI (`.native-app`) first; web can follow. Implementation
tracked in DIRECTIVE.md step 0.
