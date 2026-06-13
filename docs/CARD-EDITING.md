# CARD-EDITING (living) — card management UX

Design decisions for editing, flagging, and bulk-managing cards. This is the reference for dev on the card management screens. Read `CARD-QUALITY.md` before this; the card model (term + definition + source_span + images) is defined there, not here.

---

## 1. Card edit dialog

A card is two writable fields: **term** and **definition**. That's the whole model. The edit dialog exposes exactly those two fields, nothing else.

**What is NOT in the dialog:**
- "Examples" field — examples are separate cards (atomicity-by-decomposition). If an example is worth knowing, it becomes its own card.
- "Source" field — `source_span` is plumbing written at generation time. Users cannot edit the source span; if a card is wrong relative to its source, the right action is to fix the term/definition or reject the card. The source excerpt is shown read-only as context so the user knows what grounded the card.
- "Tags" — out of scope for v1. Collections serve the organization role.
- "Notes / extra" — no extra fields. Richness is more cards, not bigger fields.

**Dialog trigger:** a pencil icon on the card in both Review and Study. In Study it appears after the answer is revealed, to avoid obscuring the prompt. Tapping outside the dialog or pressing Escape cancels with no save.

**Fields:**
```
Term         [single-line text input, pre-filled]
Definition   [textarea, pre-filled, ~3 rows]
              Source: "…excerpt from source…"   ← read-only, collapses if null
[Save]  [Cancel]
```

**Save behavior:**
- In Review: same as the existing `editCard` action — marks the card `review_status = edited` and logs before/after for the feedback loop.
- In Study: updates `term` + `definition` in place, logs a `review_event` with `action = edited` (before → after). The FSRS schedule is untouched; editing content does not reset intervals.
- If the user clears both fields and saves, the save is blocked with an inline error ("Term and definition can't both be empty"). Empty cards trip hard rule #1 in `CARD-QUALITY.md`.

**Split a card into two:** an "Add sibling" button at the bottom of the edit dialog (not a top-level affordance — it's contextual to editing). Tapping it saves the current edits and immediately opens a blank draft card pre-filled with the same term and an empty definition, focused on the definition field. The new card goes into the same collection with `review_status = accepted` (user-created cards skip the pending queue). See section 3 for the full creation flow.

---

## 2. Bulk operations (deck management)

Bulk editing lives in a dedicated **manage page** per collection, reachable from the library: `/library/[collectionId]/manage`. It is NOT embedded in the review or study flows — those are one-card-at-a-time by design.

**Operations available on the manage page:**

| Operation | How |
|---|---|
| **Edit** | Inline row editing — tap a row to open the same edit dialog as §1. |
| **Delete** | Checkbox multi-select → "Delete selected" button. Confirmation required (shows count). Deleted cards are hard-deleted. |
| **Reorder** | Cards within a collection have no meaningful sort order for study (FSRS picks what's due). The manage page sorts by term alphabetically for scanning; drag-to-reorder is deferred. |
| **Move to collection** | Checkbox multi-select → "Move to…" dropdown of other collections. One card lives in exactly one collection. |
| **Merge two cards** | Not a bulk op — merge is "edit one card's definition to combine them, then delete the other." There is no automatic merge because deciding which term/definition to keep requires a judgment call. |

**Bulk delete a whole collection:** delete button on the collection row in `/library`, with a confirmation that shows the card count. This hard-deletes the collection and all its cards.

**Bulk generation review (spot-check / trust modes):** when the graduation ladder (`METRICS.md`) kicks in and only a sample needs review, the review page already handles this by serving a filtered subset. No separate bulk-approve affordance is needed in v1; the "Keep all remaining" path is in `FUTURE-IDEAS.md`.

---

## 3. Card creation during review / study

**The `+` button is for creating a sibling card, not a new deck.** New decks come only from document generation or from the library UI. The `+` button in Study creates a single hand-authored card in the same collection as the card currently on screen.

**Trigger locations:**
- **Study screen** — after the answer is revealed, a `+` icon appears next to the edit pencil. Tapping it opens the new-card dialog.
- **Review screen** — not present. Adding cards during the initial Tinder review flow adds noise; the user is in triage mode, not authoring mode.
- **Manage page** — an "Add card" button at the top creates a card directly in the collection.

**New card dialog:**
```
Term         [single-line, pre-filled with the current card's term if triggered via +]
Definition   [textarea, blank]
              (This card will be added to: <collection name>)
[Save]  [Cancel]
```

Pre-filling the term implements the "add sibling fact" pattern from `CARD-QUALITY.md` — the user just types the new fact and saves. Clearing the term and typing a different one creates an unrelated card in the same collection.

**Save behavior:** inserts with `review_status = accepted` and initializes FSRS state to new/unseen. The card is due immediately. No pending queue; user-authored cards are trusted.

---

## 4. Source grounding and citations

**Source excerpt is shown read-only in the edit dialog** (see §1). It is NOT shown during the study loop — the study loop is intentionally source-free (you're testing recall, not reading).

**Source excerpt IS shown in Review** (already implemented in `review-client.tsx` as the quoted blockquote below the card). This is the right place: the user is vetting the card for quality and needs to know whether the AI's claim matches the source.

**No "go to page N of the PDF" link in v1.** Source grounding is a span of text, not a page reference, because the primary ingest path is pasted text/markdown (no page numbers). For PDFs, page numbers could be extracted later — see `FUTURE-IDEAS.md`.

**User-created cards** (via the `+` flow in §3) have `source_span = null`. That's correct: they're not AI-generated and have no source document to cite.

**Design stance:** citations are a trust/quality tool for the Review stage, not a study-time feature. Keeping them out of Study keeps the review loop fast and uncluttered.

---

## 5. Card flagging during study

Cards can be flagged **in-session** via a flag icon that appears when the answer is shown (same row as the edit pencil). Flagging is persistent, not per-session.

**Flag meaning: "this card needs attention."** It is a lightweight signal, not a grade. It does not affect the FSRS schedule.

**What flagging does:**
1. Sets `flagged = true` on the card row (boolean column, defaults false).
2. Logs a `review_event` with `action = flagged`.
3. Shows a persistent "⚑ flagged" badge on the card in the manage page and library view.

**Flag reasons are not captured at flag time.** If the user wants to explain the problem, the edit dialog is the right place (they can fix it right now). Flagging is a "come back to this" marker, not a critique form. The manage page's filter `Show: flagged only` lets users batch-process their flagged cards later.

**Unflagging:** tap the flag icon again (toggle). Or edit the card — save automatically clears the flag (the user fixed the problem).

**Flag vs. "Too hard":** there is no separate "too hard" marker. "Too hard" is expressed through the FSRS grade (Again = 1). If a card is repeatedly graded Again, it becomes a leech (`SCHEDULING.md`). Leech status is surfaced in the manage page and feeds the feedback loop — that's the right channel for structurally hard cards.

**Flag vs. rejection during study:** cards accepted into the deck during Review can be rejected later via the flag → edit → delete path (flag it, open manage page, delete). There is no in-study "reject and delete" shortcut; deleting a card mid-session is a bigger decision and belongs in the manage page with the confirmation flow.

---

## Implementation notes for dev

The following schema additions are needed (add as a migration, do not alter existing columns):

```sql
-- on the cards table
flagged        boolean  NOT NULL DEFAULT false,

-- review_events.action gains new values: 'flagged', 'unflagged', 'edited_in_study', 'user_created'
-- (the action column is text; no enum migration needed — just document the new values here)
```

New server actions needed (add to `study/actions.ts` or a new `cards/actions.ts`):

- `flagCard(cardId: string): Promise<void>` — toggles `flagged`, logs event
- `createCard(collectionId: string, term: string, definition: string): Promise<{ id: string }>` — inserts accepted card
- `editCardInStudy(cardId: string, term: string, definition: string): Promise<void>` — updates fields, logs before→after event, clears flag

New UI components needed:

- `app/(app)/study/card-edit-dialog.tsx` — dialog for §1 (edit + add-sibling trigger)
- `app/(app)/study/card-create-dialog.tsx` — new-card dialog for §3
- `app/(app)/library/[collectionId]/manage/page.tsx` — bulk manage page for §2
- `app/(app)/library/[collectionId]/manage/manage-client.tsx` — client component for inline editing and multi-select

**Ownership:** the study and review flows (`app/(app)/study/`, `app/(app)/review/`) are extended by the Study+Scheduling stream. The manage page (`app/(app)/library/[collectionId]/`) is owned by the Collections stream. The new server actions touch the `cards` table — coordinate with whichever stream owns `lib/generation/` for any shared card-update utility.
