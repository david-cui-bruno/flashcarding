# Cardstock — Design (UI/UX)

_Living doc. Describes the **intent** of the interface — the design language, the
information architecture, and the per-screen decisions. The **code is the source of
truth for implementation**: exact tokens live in `app/globals.css`, the chrome in
`components/app-shell.tsx`, and the visual mockups in `.context/mockups/`. Don't
duplicate hex values or class lists here — point to the code._

See also: `docs/VISION.md` (what Cardstock is), `docs/CARD-QUALITY.md` (the keystone —
what a good card is), and `.context/mockups/POLISH.md` (the researched polish checklist).

## Design language
- **Accent: sage** (`--primary`), on a **warm-neutral** base, **Inter** typeface,
  **shadcn/ui** components. Exact tokens: `app/globals.css` (`:root`). Restrained — the
  accent appears only on the primary CTA, active nav, focus ring, and selection; never
  decorative.
- **One radius token**, subtle depth (border _or_ shadow, not both), **tabular numerals**
  on every count. Full rules: `.context/mockups/POLISH.md`.
- Light-mode only (no theme toggle); `.dark` tokens exist but are dormant.

## Terminology
- User-facing **"Decks"** = `collections` in the code/DB. The product is **Cardstock**.

## Information architecture (the shift from the walking skeleton)
- **Decks home is the hub.** Study is **deck-by-deck** — there is no global "study
  everything today." Tap a deck → a quick **gate** (Study due _N_ / Cram all) → study.
- **Managing/editing a deck is de-prioritized** (the AI should make good cards): reached
  via a **⋯ menu**, not the primary tap.
- **Review** (triage of freshly-generated cards) is **contextual** ("To triage"), not a
  permanent nav item — it appears only when there are pending cards.
- **Two chrome modes** (`components/app-shell.tsx`, keyed off the route):
  - **Hub** — Decks · ＋New · contextual Review · profile→(Metrics/Settings). Web = fixed
    full-height left sidebar; mobile = bottom tab bar (Decks · New · Profile).
  - **Focus** — study (incl. the gate) and review run distraction-free: a minimal rail +
    close, no sidebar/tab bar.
- **Count triplet** (Anki-style) = `new + learning + due`, colored blue + red + green
  (`--new` / `--learning` / `--due` in `app/globals.css`).

## Per-screen intent
- **Decks home** — web = deck **grid** with counts (a due deck shows the accent ring + a
  due/new count; a clear deck shows "caught up"); mobile = clean **list**, no numbers
  (due-ness shown only via the ring + a filled play). Tap = study gate; ⋯ = manage.
- **New / capture** — drop-zone + paste in one view, **no "complex layout" switch** (the
  parser auto-detects). Generation makes a **new deck** named from the document.
- **Generating** — async progress + live "N cards so far" + skeletons.
- **Study gate** — "Study due _N_" (primary) vs "Cram all" (secondary). Mode is chosen
  here so the study screen itself stays chromeless.
- **Study** — **card-less, top-anchored** text; prompt & answer the same size; **no
  source shown**; no deck/mode header. Compact Anki grade buttons (Again/Hard/Good/Easy +
  predicted intervals + keys 1–4) and the live triplet. Quiet "this card is bad".
- **Review** — **card-less, top-anchored**; term + definition the same size; **no source**;
  small **Reject / Edit / Keep** chips (+ arrow keys on web). Not a Tinder swipe.
- **Deck detail (manage)** — cards **table** (Term / Definition / Status; **no source
  column**), search, multi-select + bulk Move/Delete. Reached via ⋯.
- **Metrics** — graduation ladder, edit rate (lower = better), retention vs the 90% target,
  per-deck. **Settings** — daily reminders (toggle + time + tz), PWA install, account.

## Interaction principles
- **Optimistic mutations.** Grading a card and triaging in review advance **instantly**;
  the write persists in the background (toast on failure). Study/review must never block on
  a server round trip. See `app/(app)/study/[collectionId]/study-deck-client.tsx` and
  `app/(app)/review/review-client.tsx`.
- **Instant navigation.** The focus routes have `loading.tsx` skeletons so a click shows an
  immediate skeleton (and lets `<Link>` prefetch the shell) rather than a frozen page.
- **Keyboard-first** in the focus tasks: study = space to reveal, 1–4 to grade; review =
  ←/↑/→ for reject/edit/keep.
- **Local auth on the hot path.** Session checks use `getClaims()` (local JWT verification),
  not a per-request network `getUser()`. See `lib/supabase/auth.ts`.

## Deliberately hidden
- **Grounding / source spans are still captured** for every card (a quality signal — see
  `docs/CARD-QUALITY.md`), but are **not shown** in study, review, or the deck table. They
  exist under the hood, not in the studying surface.
