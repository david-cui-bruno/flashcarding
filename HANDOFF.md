# Dory — Project Handoff

_Last updated: 2026-06-13. Point-in-time status, not a spec. **Specs live in `docs/`** (source of truth for intent), the **code is source of truth for implementation**, and **`docs/CARD-QUALITY.md` is the keystone** (what "a good card" is, reused 3 ways). When code and a frozen doc conflict, surface it — don't silently rewrite the doc._

---

## 0. The 60-second version
**Dory turns any document (PDF / Word / markdown / pasted text) into high-quality, atomic flashcards with AI, and schedules them with FSRS (the algorithm modern Anki uses).** Personal tool for a power-memorizer, built to be productizable. The whole bet is **card quality** — automating card *creation* without sacrificing card *goodness* is the wedge (scheduling is already solved by FSRS; making good cards by hand is the thing nobody does).

**Status: v1 is built, deployed, and live.** The full loop works on prod (signup → paste/upload → async AI generation → triage/review → FSRS study with Anki learning steps → metrics + a taste-feedback loop). Recently completed a **full rebrand to "Dory"** (cerulean + slate + system font + flip tiles), **Anki-style learning steps**, an **Electron desktop app**, **long-lived sessions**, and the **real logo**.

- **Live:** https://cardstock-framewise-health.vercel.app (the Vercel project is still named `cardstock`; see §4 on the name mismatch).
- **Login for the seeded demo:** `demo` / `password12`.

---

## 1. The name situation (read this first — it WILL confuse you)
The product has been renamed twice: **Carding → Cardstock → Dory.** The **user-facing brand is "Dory"** (wordmark, page titles, manifest, app icon). But the **infrastructure names were deliberately NOT changed** to avoid breakage:
- **Vercel project:** `cardstock` → prod URL is `cardstock-framewise-health.vercel.app`.
- **Supabase project:** `carding` (ref `tmqgknkshpkxojvdhejq`).
- **Synthetic auth email domain:** `@carding.local` (changing it would orphan every existing login, incl. `demo`).
- **GitHub repo:** `david-cui-bruno/flashcarding`.
- **Railway service:** `carding-ingestion`.

**Do not "fix" this mismatch.** Brand = Dory; infra = legacy names. The intended real domain is **learndory.com** (NOT registered/wired yet).

---

## 2. What it is / the thesis (don't drift from this)
- **Who:** a single power-memorizer (the owner), who learns by flashcards. Built so it can become a product later.
- **Differentiator = card quality.** `docs/CARD-QUALITY.md` defines "a good card" exactly once (atomic, one fact, well-formed, **grounded in the source** — no hallucinated facts). That one definition is reused 3 ways: the **generation prompt**, the **deterministic quality gate**, and the **evaluation rubric**. Change it there, not in three places.
- **No LLM-as-judge.** Quality is enforced by **deterministic gates** + grounding + self-fix, then **tuned to the user's taste** via a few-shot feedback loop (kept/edited cards become examples). It learns your style without retraining.
- **The trust ladder:** as your edit rate drops, the app makes you review less (review-all → spot-check <15% → trust <10%, with hysteresis). The human is the taste oracle, not the card factory.
- The **"Dory" name is the joke**: a memory app named after the fish who can't remember anything — you use it *because* you forget.

Read `docs/VISION.md`, `docs/CARD-QUALITY.md` (keystone), `docs/METRICS.md`, `docs/SCHEDULING.md` (frozen); `docs/PIPELINE.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN.md`, `docs/BUILD-PLAN.md`, `docs/FUTURE-IDEAS.md` (living / out-of-scope).

---

## 3. Repo, branches, PRs, deploy
- **GitHub:** `github.com/david-cui-bruno/flashcarding`.
- **`main`** is the integration branch where everything is merged. **`main` is checked out in a SEPARATE git worktree** at `/Users/davidcui824/conductor/repos/flashcarding` — so you CANNOT `git checkout main` in this workspace (worktree conflict). Branch off `origin/main` instead.
- **⚠️ The GitHub *default* branch is `david-cui-bruno/superhot-story-flashcard-docs`** — an ANCIENT scaffold state. `git checkout`-ing it reverts the whole working tree to a pre-everything scaffold (looks alarming; nothing is lost — the work is on `main`). **Don't check it out.** This is why `origin/HEAD → superhot-...`.
- **Current working branch:** `david-cui-bruno/dory` (off `origin/main`, fully merged/even). Conductor workspace target is `origin/main`; PRs go `--base main`.
- **PRs are squ- merged via `gh pr merge <n> --merge`.** Recent: #11 (UI rebuild), #12 (Vercel cron), #13 (long cookies), #15 (getClaims), #16 (DESIGN.md), #17 (deck titles), #18 (edit-nudge + distill), #19 (Dory rebrand), #20 (logo), #21 (.vercelignore), #22 (rounded mac icon). **Zero open PRs.**
- **`ara/bg/...` branches** = background-agent worktrees (not yours); ignore. `reject-feedback` is merged (prunable).
- **Deploy = `vercel --prod --yes --scope framewise-health`** from the repo root (CLI uploads the working dir; **NOT git-connected**). This is why `.vercelignore` matters (see §11 gotcha).

---

## 4. Deployed infrastructure
### Vercel — project `cardstock`, team `framewise-health` (**Pro plan**)
- **Prod URL: https://cardstock-framewise-health.vercel.app** (title/manifest say "Dory").
- All env vars (see §13) set on Production. **Vercel Authentication (ssoProtection) is DISABLED** (team projects gate behind SSO by default → would 401; the app has its own Supabase auth).
- **Vercel Cron** runs `/api/cron/reminders` hourly (`0 * * * *`, in `vercel.json`) with auto-injected `Authorization: Bearer $CRON_SECRET`. Pro plan supports hourly (Hobby would cap at daily). Job is idempotent per local day → ≤1 push/user/day.
- CLI logged in as `david-2561`; token at `~/Library/Application Support/com.vercel.cli/auth.json`.

### Supabase — project `carding`, ref `tmqgknkshpkxojvdhejq` (us-east-1)
- Tables: `profiles` (+ `reminder_*` cols), `collections`, `sources`, `cards`, `generation_jobs`, `generation_feedback`, `study_reviews`, `push_subscriptions`. Owner-only RLS everywhere; Realtime on `generation_jobs`; private `card-images` bucket.
- **3 migrations applied to the live DB:** `..._init_schema`, `..._push_subscriptions`, and **`20260613120000_card_learning_steps`** (adds `cards.learning_steps int default 0` — needed for Anki learning steps, see §7).
- **Asymmetric JWT signing keys (ES256) are enabled** — this is what makes `getClaims()` verify locally without a network call (§8).
- Manage: add a migration under `supabase/migrations/`, `supabase db push`; regen types `supabase gen types typescript --linked > lib/types/database.ts`. CLI logged in.

### Railway — ingestion service (LIVE)
- Project `carding-ingestion`, **Hobby plan** (Docling OOMs on free). **URL: `https://carding-ingestion-production.up.railway.app`** — `GET /health`, `POST /ingest` (multipart, bearer `INGESTION_SERVICE_TOKEN`). Source = `services/ingestion-py/` (FastAPI wrapping Docling/MarkItDown, CPU torch, OCR off). Deploy = `railway up` from that dir (NOT GitHub-connected). The app calls Railway when `INGESTION_SERVICE_URL` is set (it is, on prod), else spawns the local Python sidecar.

---

## 5. The app — IA, routes, screens
Next.js 16 (App Router, **Turbopack**), React 19, Tailwind v4, TypeScript, **shadcn/ui (new-york)**. Middleware is `proxy.ts` (Next 16 renamed middleware → `proxy`).

**IA shift from the original skeleton:** Decks are the hub. **Study is deck-by-deck** (no global "study everything"). Two chrome modes, chosen in `components/app-shell.tsx` by `usePathname()`:
- **Hub chrome** (Decks / Deck-detail / New / Metrics / Settings): fixed left **sidebar** (web) + bottom **tab bar** (mobile). Content-only scroll.
- **Focus chrome** (`/study/*`, `/review`): minimal 60px rail + close button, distraction-free.

| Route | File(s) | What it is |
|---|---|---|
| `/library` | `library/page.tsx` + `decks-home-client.tsx` | **Decks home.** Web = deck grid (tiles **flip** to choose Study-due/Cram); mobile = clean list. Tiles show due/new counts + accent ring; ⋯ menu = Manage cards / Rename / Delete (dialogs). Aggregates per-deck counts server-side. |
| `/study/[collectionId]` | `study/[collectionId]/page.tsx`, `study-gate.tsx`, `study-deck-client.tsx` | No `?mode` = **gate** (Study due N / Cram all). `?mode=due` or `?mode=cram` = **card-less study session** (top-anchored text, grade buttons w/ live FSRS interval previews, new+learning+due triplet, "this card is bad"). |
| `/study` | `study/page.tsx` | Legacy global route → **redirects to `/library`**. |
| `/review` | `review/page.tsx` + `review-client.tsx` | **Triage** of pending (freshly-generated) cards. Card-less, keyboard-first chips (← reject · ↑ edit · → keep). Mode set by the graduation ladder. |
| `/new`, `/new/[jobId]` | `new/page.tsx`, `new/actions.ts`, `[jobId]/...` | Capture (drop-zone + paste, auto-detect, no complex-layout switch) → **async Batch generation** → live "generating" page (Realtime + poll) → redirects to `/review`. |
| `/collections/[id]` | `collections/[id]/...` | **Deck detail** (manage): cards table (Term/Definition/Status, no source col), search, multi-select bulk Move/Delete. Reached via ⋯. |
| `/metrics` | `metrics/page.tsx` | Graduation ladder, edit rate (lower=better), retention vs 90% target, per-deck. |
| `/settings` | `settings/page.tsx` + `settings-client.tsx` | Daily reminders (toggle/time/tz), PWA install, account. |
| `/api/jobs/poll` | | Drives async generation (chunk → Batch → gate → grounding/self-fix → persist). |
| `/api/cron/reminders` | | Web-push daily reminders (`runReminders`), `CRON_SECRET`-gated. |

**Optimistic study/review:** grades/keeps advance the card instantly and persist in the background (no await) — Anki-snappy. Failures toast (sonner). `/study/*` and `/review` have `loading.tsx` skeletons.

---

## 6. Design system (Dory)
Captured in `docs/DESIGN.md`; tokens in `app/globals.css` (`:root` + `@theme inline`, light-only; `.dark` exists but is dormant — no theme toggle).
- **Accent: cerulean `#0e7ec2`** (the blue-tang's blue). On a **cool slate** neutral base (bg `#f8fafc`, fg `#0f172a`, muted-fg `#64748b`, border `#e2e8f0`) — the greys share the accent's temperature (color-theory: cool accent → cool neutrals).
- **Font: `system-ui`** (native SF/Segoe/Roboto; no web-font load). Headings at medium/regular weight for an airy feel.
- **Count triplet** (Anki): **new = violet `#7c3aed`** (deliberately moved OFF blue so it doesn't collide with the cerulean accent), **learning = red `#e11d48`**, **due = green `#16a34a`**.
- **Deck tiles:** soft cool elevation + **stacked-paper edges** (peeking layers = "a deck") + **3D flip** to reveal Study/Cram. Reduced-motion → instant face swap. `/study/[id]` gate kept as the fallback (deep links, mobile).
- Restraint: accent only on CTA / active nav / focus ring / selection. One radius token. `tabular-nums` on all counts. Full rules: `.context/mockups/POLISH.md`.
- **History (so you don't re-litigate):** explored sage → teal → Dartmouth → ocean blue, and Inter/Fraunces/Space-Grotesk/8 sans options, before landing on **cerulean + slate + system**. Mockup explorations + galleries live in `.context/mockups/` (gitignored).

---

## 7. Scheduling — FSRS + Anki learning steps
`docs/SCHEDULING.md` is **frozen**: "copies modern Anki; FSRS at 90% retention; **new cards uncapped** (no daily cap — explicit user choice); two review modes (scheduled vs cram, cram never reschedules); leeches surfaced not auto-rejected."
- **Engine:** `ts-fsrs@5.4.1` (FSRS-6), `request_retention: 0.9`. `lib/scheduling/fsrs.ts` — `schedule()`, `previewIntervals()`, `SchedulableCard`, `FsrsUpdate`. Runs **client-side** in the study session (matches the doc) + server-side in `gradeCard`.
- **Anki learning steps (NEW):** `enable_short_term: true`, `learning_steps: ["1m","10m"]`, `relearning_steps: ["10m"]`. The study session is a **dynamic due-ordered queue**: grading a card that lands in a learning/relearning step **re-inserts it later in the same session** (so "Again" brings it back; new cards step through before graduating). The new/learning/due triplet now breathes like Anki. **The `cards.learning_steps` column persists which step a card is on** (without it, cards never graduate across sessions). `gradeCard(cardId, grade, mode, update?)` accepts the client-computed `FsrsUpdate` and persists it (race-free).
- **NO daily caps** (frozen doc). The three study-screen counts are *remaining-in-queue* New/Learning/Due — NOT a "cards learned" score (verified vs Anki via research).
- Leeches: `lib/scheduling/leech.ts`, threshold 4 lapses (Anki default is 8 — tunable). A leech only surfaces a banner; the user decides.

---

## 8. Auth — "never sign in again" + fast nav
- **Long-lived cookies:** `lib/supabase/cookies.ts` forces a **400-day max-age** (the browser cap) on the Supabase auth cookies, re-applied every request (sliding window) in `proxy.ts`, `server.ts`, and `client.ts`. Never extends a cookie being *cleared* (so sign-out still works — verified). Result: effectively permanent sessions in browser, PWA, and Electron.
- **Local JWT verification:** `lib/supabase/auth.ts` `getSessionClaims()` uses `supabase.auth.getClaims()` — verifies the ES256 token locally via cached JWKS (no network), used in `proxy.ts` + `app/(app)/layout.tsx` instead of the network `getUser()`. Cuts redundant per-request auth round-trips → faster nav. Falls back to a network check if it ever can't verify (never trusts a forged token).
- Username→email: `lib/auth/username.ts` (`username@carding.local`, case-insensitive). Signup creates a pre-confirmed user via the admin client + a `profiles` row.

---

## 9. Generation pipeline + the feedback loop (the core)
- **Async Batch pipeline** (`lib/generation/`): `submit.ts` (chunk → per-chunk extract+draft via Anthropic **Batch API**, model `claude-sonnet-4-6`), `process.ts` (poll completion → deterministic `gates.ts` (the 4 CARD-QUALITY rules, no LLM-judge) → grounding/`selffix.ts` → persist as `pending` cards in a new collection). `prompt.ts` = CARD-QUALITY for the model. `title.ts` = a fast **Haiku** call that names the deck from the generated cards (replaces ugly "first 80 chars of paste" titles; runs on the async completion path = no added latency).
- **Feedback loop (`lib/feedback/`):** every Keep/Edit/Reject writes a `generation_feedback` row. `selectFewShotExamples()` injects your most relevant past **kept + edited** cards into the next generation prompt as few-shot examples (edits are the strongest signal — includes the before→after delta). Backfills with `seed-examples.ts` (7 of the owner's own good art/lit cards) until you have enough history. **Rejects currently only count toward the edit rate** — they are NOT yet fed back as negative examples (deliberate; raw negatives prime the model). Mitigations shipped: a **review UX nudge toward editing over rejecting**, and a **distill-reject-patterns** path (turns reject reasons into human-approved CARD-QUALITY additions). See PR #18.
- **Metrics/graduation (`lib/metrics/`):** edit-rate + retention + the symmetric graduation ladder with hysteresis drive how much you review.

---

## 10. Desktop app (Electron) — and the gap vs the "notes app" plan
- **`desktop/`** = isolated npm project (NOT in the pnpm workspace; `pnpm-workspace.yaml` has no `packages:` field, so it's not swept in). A **thin Electron shell** (`main.js`) that loads the deployed URL in a native macOS window — same web app, single source. Auth persists across launches. External links open in the real browser. `cd desktop && npm start` to run; `npm run build` → unsigned `Dory.app` (`dir` target).
- **`APP_URL` in `desktop/main.js`** points at the Vercel URL — swap to `https://learndory.com` once wired (or `DORY_URL=… npm start`).
- **Icon:** `desktop/icon.png` is a **rounded squircle** (macOS doesn't auto-round app icons, so it's baked in — see §11 gotcha).
- **⚠️ What the user's design notes describe but is NOT built:** signed + **notarized** `.dmg`, **electron-updater** auto-update, a GitHub Release, and a **Capacitor iOS app** (`mobile/` — does not exist). All of that is for *distributing to other people* and needs an **Apple Developer account** ($99/yr). **Recommendation on record: don't build it for a solo tool — use the PWA** (installable on Mac via Chrome and iOS via Safari, web push works on installed iOS PWAs). Build the native pipeline only when shipping to others.

---

## 11. Icons / brand assets
- **Source of truth:** `assets/logo-source.png` (1254², white blue-tang mark on a full-bleed cerulean square; ChatGPT-generated).
- **`scripts/gen-icons.mjs`** (`pnpm gen:icons`) downscales it via headless-Chromium canvas → `public/icons/` (icon-192/512, maskable-192/512, apple-icon-180), `app/icon.png` (Next favicon — replaced the scaffold `favicon.ico`), and `desktop/icon.png` (1024, **`rounded: true`**).
- **Full-bleed vs rounded:** web/PWA/Apple icons stay full-bleed (iOS masks them; Android uses maskable — a pre-rounded web icon would double-round). **Only the macOS/Electron icon is pre-rounded** (squircle + ~10% transparent margin + 22.37% corner radius) because macOS does NOT auto-round app icons.
- The in-app **sidebar Logo** (`components/logo.tsx`) renders `icon-512.png` as a small CSS-rounded tile next to the "Dory" wordmark.

---

## 12. What's NOT done / next steps (priority order)
1. **Register + wire `learndory.com`** — then update `desktop/main.js` `APP_URL` + add the domain in Vercel. (The brand says Dory but the URL is still the cardstock vercel.app.)
2. **On-device push test** — install the PWA on the iPhone, enable reminders, confirm a notification actually arrives. The job + delivery machinery is verified server-side; only real-device receipt is unconfirmed. (`/api/cron/reminders` runs hourly and returns `{ok:true}`; with no reminder-enabled users it sends 0.)
3. **Use it for real** — load actual study material; the loop is proven on prod.
4. **Seed examples evolve** — as you review, run the distill-reject path occasionally to fold your taste into `CARD-QUALITY.md`.
5. **Branch cleanup** — prune `reject-feedback` (merged) and the `ara/bg/*` background-agent branches.
6. **Optional product-grade desktop/iOS** (signing/notarize/auto-update/Capacitor) — only if distributing to others; needs an Apple Developer account.
7. **Nav latency** — entering study/gate is serverless-bound (~0.3–1.5s); skeletons mask it. Could trim the per-nav layout queries / keep functions warm if it ever annoys.

---

## 13. Run / build / verify
- Install: `pnpm install`. Dev: `PORT=3411 pnpm dev` (the verify scripts default to `:3411`). Typecheck: `pnpm exec tsc --noEmit`. Build: `pnpm build`.
- **Discipline: prove changes by running the app, not just typechecking.**
- **Seed + visual tooling** (`scripts/`): `seed-demo.ts` (loginable `demo`/`password12` with decks across every state — run `set -a; . ./.env.local; set +a; pnpm exec tsx scripts/seed-demo.ts`), `shot.mjs <paths…>` (logs in as demo, screenshots web+mobile → `/tmp/carding-shots/ui/`), `gen-icons.mjs`, smoke/walk scripts.
- **Deploy:** `vercel --prod --yes --scope framewise-health`. Desktop: `cd desktop && npm run build`. Railway: `railway up` from `services/ingestion-py/`.

---

## 14. Gotchas (hard-won — read before you waste an hour)
- **Stale `.next`:** running `next build` then `next dev` (or vice versa) makes Turbopack serve a **stale `.next`** — symptom: CSS custom props empty / theme renders black/colorless. Fix: `lsof -ti:3411 | xargs kill -9; rm -rf .next` then restart dev.
- **`.vercelignore` is load-bearing:** `vercel --prod` uploads the working dir, and `desktop/node_modules` (Electron, **~393MB**) blew past the 250MB serverless-function limit → deploy failed. `.vercelignore` excludes `desktop/`, `assets/`, `.context/`, `services/`. Don't remove it.
- **zsh doesn't word-split unquoted vars:** `for x in $LIST` treats `$LIST` as one arg. Use `for x in a b c` or `... | while read -r x`.
- **macOS icons aren't auto-rounded** (unlike iOS) — the Electron icon must bake in the squircle (done; §11).
- **`git checkout superhot-story-flashcard-docs`** reverts the tree to an ancient scaffold (it's the GitHub default branch). Don't; branch off `origin/main`.
- **`main` is in another worktree** — can't `git checkout main` here.
- **Image-read limit:** after many image reads in one session, the API rejects further image reads ("max allowed size for many-image requests") regardless of size — verify image output **programmatically** (sample pixels) instead.
- **Next 16:** middleware is `proxy.ts`; `cookies()` is async; `create-next-app` clobbers `CLAUDE.md` — restore it. **AGENTS.md:** read `node_modules/next/dist/docs/` before writing framework code (this Next is newer than training data).
- **`tsx` + project imports:** verify scripts that need `playwright`/`pngjs` run from the project dir (not `/tmp`) so deps resolve; `pngjs` is installed in `/tmp/node_modules` for ad-hoc pixel checks.

---

## 15. Credentials & access
`.env.local` (gitignored; in repo root + each workspace) holds all secrets: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`, `INGESTION_SERVICE_URL`, `INGESTION_SERVICE_TOKEN`. **Never commit/echo these.** CLIs logged in: Supabase, `gh`, Railway (`david@framewisehealth.com`), Vercel (`david-2561`).

---

## 16. Memory
Auto-memory at `~/.claude/projects/-Users-davidcui824-conductor-repos-flashcarding/memory/`: `carding-project.md`, `carding-research-2026.md`, `carding-feedback-metrics-stream.md`, `carding-ui-rebuild.md` (the last now records the full Dory rebrand + learning steps + desktop + the infra-name mismatch). Start a new session by reading `CLAUDE.md` + `docs/` + this handoff.
