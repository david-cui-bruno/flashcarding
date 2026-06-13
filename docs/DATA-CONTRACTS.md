# Data & Server-Action Contracts per Screen

Read-only research document. Describes the server data shapes, server-action signatures, client
interactions, and shared-lib imports for each route under `app/(app)/`. Produced from a static
read of the codebase; no files were modified.

---

## Routes that exist vs. routes that do not

Exists and documented below: `/library`, `/new`, `/review`, `/study`, plus `app/(auth)/` and
`app/(app)/layout.tsx`.

**Not yet implemented** (no files in repo): `collections/[id]/`, `new/[jobId]/`, `metrics/`,
`settings/`. The `library/library-client.tsx` and `library/actions.ts` files also do not exist —
the library page is fully server-rendered with no mutations.

---

## /library

### page.tsx (server component, no client delegation)

Supabase query:
```
supabase
  .from("collections")
  .select("id, name, cards(count)")
  .order("created_at", { ascending: false })
```
Tables: `collections` (columns `id`, `name`, `created_at`), nested aggregate on `cards` (count).

No client component. The page renders entirely server-side as a static `<ul>` list. Each item
shows `name` and the extracted count (`(c.cards as { count: number }[] | null)?.[0]?.count ?? 0`).
A "New cards" link goes to `/new`.

### actions.ts
Does not exist. No mutations on this screen.

### lib imports
- `@/lib/supabase/server` → `createClient`

---

## /new

### page.tsx (CLIENT component — `"use client"`)

No Supabase queries. The page is a form shell.

State via `useActionState<GenState, FormData>(generateFromText, null)`:
- `state: GenState` — `{ error: string } | null`, shows error below the textarea
- `action` — the form action bound to `generateFromText`
- `pending: boolean` — disables the submit button and shows "Generating… (~20s)"

Single `<textarea name="text">`. Submit button disabled while `pending`.

Props passed to client: none (it IS the client component).

### actions.ts

**`generateFromText(_prev: GenState, formData: FormData): Promise<GenState>`**

Steps:
1. `formData.get("text")`, trim — rejects with `{ error }` if < 20 chars.
2. `supabase.auth.getUser()` — rejects if no session.
3. Derives `title` from first line, truncated to 80 chars.
4. INSERT into `sources`: `{ user_id, kind: "paste", title, content: text }` → reads back `id`.
5. Calls `generateCards(text)` (Anthropic call) → `GeneratedCard[]`.
6. INSERT into `collections`: `{ user_id, name: title }` → reads back `id`.
7. Bulk INSERT into `cards`: for each card `{ user_id, collection_id, source_id, term, definition, source_span, review_status: "pending" }`.
8. `redirect("/review")` on success; returns `{ error: string }` on any failure.

Return type: `GenState = { error: string } | null` (or redirects).

Tables written: `sources` (insert), `collections` (insert), `cards` (insert).

### lib imports
- `@/lib/supabase/server` → `createClient`
- `@/lib/generation/generate` → `generateCards`

---

## /new/[jobId]

**Does not exist.** No async job-polling subdirectory or `generating-client.tsx` in the repo.

---

## /review

### page.tsx (server component)

Supabase query:
```
supabase
  .from("cards")
  .select("id, term, definition, source_span")
  .eq("review_status", "pending")
  .order("created_at", { ascending: true })
```
Tables: `cards` (columns `id`, `term`, `definition`, `source_span`, `created_at`, `review_status`).

If empty, renders a static message with links to `/new` and `/study`.

Props passed to `<ReviewClient>`:
```ts
cards: PendingCard[]
// PendingCard = { id: string; term: string; definition: string; source_span: string | null }
```

### review-client.tsx (client component)

State:
- `i: number` — index of current card, starts 0
- `busy: boolean` — true while any action is awaiting
- `mode: "view" | "edit" | "reject"` — active panel
- `term: string` — editable copy of card.term (edit mode)
- `definition: string` — editable copy of card.definition (edit mode)
- `reason: string` — rejection reason (reject mode)

When `i >= cards.length` renders "All reviewed 🎉" + link to `/study`.

Interactions:
- Keep button (`view` mode): `keepCard(card.id)` → `advance()` (resets mode, increments `i`)
- Edit button (`view` mode): copies term/definition into state, sets `mode = "edit"`
- Reject button (`view` mode): sets `mode = "reject"`
- "Save & keep" button (`edit` mode): `editCard(card.id, term, definition)` → `advance()`
- Cancel button (`edit` mode): sets `mode = "view"`
- "Confirm reject" button (`reject` mode): `rejectCard(card.id, reason)` → `advance()`
- Cancel button (`reject` mode): sets `mode = "view"`

No keyboard shortcuts. No optimistic updates — `busy = true` → await → `busy = false` → advance.

### actions.ts

**`keepCard(cardId: string): Promise<void>`**
- UPDATE `cards` SET `review_status = "accepted"` WHERE `id = cardId`
- INSERT into `generation_feedback`: `{ user_id, card_id: cardId, action: "kept" }`

**`rejectCard(cardId: string, reason: string): Promise<void>`**
- UPDATE `cards` SET `review_status = "rejected"` WHERE `id = cardId`
- INSERT into `generation_feedback`: `{ user_id, card_id: cardId, action: "rejected", reason: reason || null }`

**`editCard(cardId: string, term: string, definition: string): Promise<void>`**
- SELECT `term, definition` from `cards` WHERE `id = cardId` (stored as `before`)
- UPDATE `cards` SET `term, definition, review_status = "edited"` WHERE `id = cardId`
- INSERT into `generation_feedback`: `{ user_id, card_id: cardId, action: "edited", before: before ?? null, after: { term, definition } }`

Tables read: `cards` (select `term, definition` in `editCard`).
Tables written: `cards` (update), `generation_feedback` (insert).

### lib imports
- `@/lib/supabase/server` → `createClient`

---

## /study

### page.tsx (server component)

Supabase query:
```
supabase
  .from("cards")
  .select("id, term, definition, source_span")
  .in("review_status", ["accepted", "edited"])
  .lte("due", new Date().toISOString())
  .order("due", { ascending: true })
  .limit(100)
```
Tables: `cards` (columns `id`, `term`, `definition`, `source_span`, `review_status`, `due`).

If empty, renders static message with links to `/review` and `/new`.

Props passed to `<StudyClient>`:
```ts
cards: DueCard[]
// DueCard = { id: string; term: string; definition: string; source_span: string | null }
```

### study-client.tsx (client component)

State:
- `i: number` — index of current card, starts 0
- `shown: boolean` — whether the answer is revealed
- `busy: boolean` — true while `gradeCard` is in-flight

Card direction: definition shown as prompt; term revealed as answer (`definition_to_term`).
Grade labels: index 1–4 → `["", "Again", "Hard", "Good", "Easy"]`.

Interactions:
- "Show answer (space)" button: sets `shown = true`
- Grade buttons 1–4 (only when `shown`): call `grade(g)` → await `gradeCard(card.id, g)` → `shown = false`, `i++`

Keyboard shortcuts (`useEffect` on `keydown`):
- `Space`: toggles `shown` (calls `e.preventDefault()`)
- `1` / `2` / `3` / `4` (only when `shown`): calls `grade(Number(e.key) as 1|2|3|4)`

No optimistic updates. Buttons disabled while `busy`.

When `i >= cards.length` renders "Done for now 🎉" + link to `/library`.

### actions.ts

**`gradeCard(cardId: string, grade: 1 | 2 | 3 | 4): Promise<void>`**
1. SELECT `*` from `cards` WHERE `id = cardId`
2. `schedule(card, grade)` from `@/lib/scheduling/fsrs` → `FsrsUpdate`:
   ```ts
   {
     due: string;
     stability: number;
     difficulty: number;
     elapsed_days: number;
     scheduled_days: number;
     reps: number;
     lapses: number;
     fsrs_state: "new" | "learning" | "review" | "relearning";
     last_review: string;
   }
   ```
3. UPDATE `cards` SET all `FsrsUpdate` fields WHERE `id = cardId`
4. INSERT into `study_reviews`: `{ user_id, card_id: cardId, grade, mode: "scheduled" }`

Tables read: `cards` (select `*`).
Tables written: `cards` (update with FSRS fields), `study_reviews` (insert).

### lib imports
- `@/lib/supabase/server` → `createClient`
- `@/lib/scheduling/fsrs` → `schedule`

---

## /metrics

**Does not exist.** No `metrics/` directory or `page.tsx` in the repo.

---

## /settings

**Does not exist.** No `settings/` directory, `settings-client.tsx`, or `actions.ts` in the repo.

---

## /collections/[id]

**Does not exist.** No `collections/` directory under `app/(app)/`.

---

## Bonus: app/(auth)/ — auth actions

**`login(_prev: AuthState, formData: FormData): Promise<AuthState>`**
- Reads `username`, `password` from formData
- `supabase.auth.signInWithPassword({ email: usernameToEmail(username), password })`
- Success: `redirect("/library")`. Failure: `{ error: "Invalid username or password." }`

**`signup(_prev: AuthState, formData: FormData): Promise<AuthState>`**
- Reads `username`, `password`
- Admin client creates user with `email_confirm: true`, `user_metadata: { username }`
- INSERT into `profiles`: `{ id: user.id, username }`
- Signs in via regular client, `redirect("/library")`

**`logout(): Promise<void>`**
- `supabase.auth.signOut()`, `redirect("/login")`

Tables written: `profiles` (insert in signup).

Lib imports: `@/lib/supabase/server` → `createClient`, `@/lib/supabase/admin` → `createAdminClient`,
`@/lib/auth/username` → `usernameToEmail`, `@/lib/auth/types` → `AuthState`.

---

## app/(app)/layout.tsx

Server component. `supabase.auth.getUser()` — if no user, `redirect("/login")`. Reads
`user.user_metadata?.username`. Nav links: Library, New, Review, Study. Logout button wires to
`logout` from `app/(auth)/actions`.

---

## Shared lib modules — exported symbols

| Module | Exported symbols |
|---|---|
| `lib/supabase/server` | `createClient()` — async, cookie-backed server client |
| `lib/supabase/client` | `createClient()` — synchronous browser client |
| `lib/supabase/admin` | `createAdminClient()` — service-role client (bypasses RLS) |
| `lib/supabase/proxy` | `updateSession(req: NextRequest)` — middleware session refresh + route guard |
| `lib/scheduling/fsrs` | `schedule(card: Card, grade: 1\|2\|3\|4, now?: Date): FsrsUpdate`, type `FsrsUpdate` |
| `lib/generation/generate` | `generateCards(sourceText: string): Promise<GeneratedCard[]>` |
| `lib/generation/prompt` | `CARD_GENERATION_SYSTEM: string`, `CARD_SCHEMA: object` |
| `lib/types/domain` | `Card`, `CardInsert`, `Collection`, `Source`, `GenerationJob`, `StudyReview`, `GeneratedCard` |
| `lib/types/database` | `Database`, `Tables<>`, `TablesInsert<>`, `TablesUpdate<>`, `Enums<>`, `CompositeTypes<>`, `Constants` |
| `lib/auth/types` | `AuthState = { error: string } \| null` |
| `lib/auth/username` | `usernameToEmail(username: string): string` |

---

## Supabase tables (full list from generated schema)

`cards`, `collections`, `generation_feedback`, `generation_jobs`, `profiles`, `sources`, `study_reviews`

Enums: `feedback_action` ("kept"|"edited"|"rejected"), `fsrs_state` ("new"|"learning"|"review"|"relearning"),
`generation_status` ("queued"|"running"|"succeeded"|"failed"), `prompt_direction` ("definition_to_term"|"term_to_definition"),
`review_status` ("pending"|"accepted"|"edited"|"rejected"), `source_kind` ("paste"|"markdown"|"pdf"|"docx"),
`study_mode` ("scheduled"|"cram").
