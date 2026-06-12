# Cardstock — Project Handoff

_Last updated: 2026-06-11. Point-in-time status, not a spec. Specs live in `docs/` (source of truth for intent); the code is source of truth for implementation; the **UI/UX design** is captured in `.context/mockups/` + §7 below (designed, not yet built into the real app)._

---

## 1. TL;DR
Cardstock turns documents → atomic, AI-generated flashcards, reviewed on an FSRS schedule. **All six fan-out build streams are integrated, verified, and merged to `main`** (through PR #10). The **document-ingestion service is deployed and live on Railway**, and **push storage is migrated to Postgres** (both against the live Supabase DB). The backend/feature loop works end-to-end (signup → upload/paste → async generation → review → study → metrics), proven by a live headless walk.

**The current frontier is the UI/UX rebuild.** We ran a full design exploration and **converged on a complete visual + interaction design** (sage accent, deck-by-deck study, card-less Anki-style study/review, shadcn). That design exists as **HTML mockups + galleries in `.context/mockups/`** and is **NOT yet built into the real Next.js app** — the app still wears the original walking-skeleton UI. Building the converged design in shadcn is the next major task.

## 2. What it is / who it's for
Personal tool (built to be productizable) for a power-memorizer who learns by flashcards. Differentiator = **card quality** (`docs/CARD-QUALITY.md` is the keystone). Read `docs/VISION.md`.

## 3. Repo, branches, PRs
- **GitHub:** `github.com/david-cui-bruno/flashcarding`. Default branch: `main`.
- **`main` HEAD = `3ae8582`** (Merge PR #10). History: PR #1 (foundation+skeleton) → #2–#7 (the six streams) → **#8 (integration of all six)** → #9 (Railway hardening) → #10 (Docling perf). **All PRs #1–#10 are MERGED. Zero open PRs.**
- **Branches:** `main`, `integration` (where everything was reconciled; still exists), and the six stream branches (`david-cui-bruno/{abu-dhabi, albuquerque-v2, generation-pipeline, havana, ingestion-doc, little-rock-v2}`) — all merged, prunable whenever.
- Conductor workspaces live under `/Users/davidcui824/conductor/workspaces/flashcarding/<name>`. This handoff was authored from `shanghai-v1`.

## 4. Deployed infrastructure
### Supabase — project `carding`, ref `tmqgknkshpkxojvdhejq` (us-east-1, org Framewise Health)
- Two migrations applied to the **live DB**: `20260611094838_init_schema.sql` (original tables) and **`20260611120000_push_subscriptions.sql`** (NEW: `push_subscriptions` table + `reminder_*` columns on `profiles`, retiring the old `user_metadata` stopgap).
- Tables: `profiles` (+ reminder_enabled/time/tz/last_sent_on), `collections`, `sources`, `cards`, `generation_jobs`, `generation_feedback`, `study_reviews`, `push_subscriptions`. Owner-only RLS everywhere; Realtime on `generation_jobs`; private `card-images` bucket.
- Manage: add a migration under `supabase/migrations/`, `supabase db push`; regen types `supabase gen types typescript --linked > lib/types/database.ts`. CLI is logged in on this Mac.

### Railway — ingestion service (LIVE)
- Project **`carding-ingestion`** (id `93c0fe9d-e6b4-4134-835d-14b63ffd04b5`), service `carding-ingestion`, **Hobby plan** (required — Docling OOM'd on the 1 GB free cap).
- **URL: `https://carding-ingestion-production.up.railway.app`** — `GET /health`, `POST /ingest` (multipart: file, mode), bearer-token auth (`INGESTION_SERVICE_TOKEN`).
- Source = `services/ingestion-py/` (FastAPI `server.py` wrapping the same `convert()` as the CLI). Dockerfile bakes Docling weights in; **CPU-only torch** (no CUDA), **OCR disabled**, **converter cached** across requests. Verified live: MarkItDown (pdf/docx) + Docling (tables) all 200.
- **Deploy = `railway up` from `services/ingestion-py/` (local upload), NOT GitHub-connected.** For auto-deploy on push: connect the repo in the dashboard, set Root Directory = `services/ingestion-py`. CLI logged in as `david@framewisehealth.com` (single workspace).

### Env (`.env.local`, gitignored; in the root repo + each workspace)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`, `INGESTION_SERVICE_URL` (→ Railway), `INGESTION_SERVICE_TOKEN`. The app calls Railway when `INGESTION_SERVICE_URL` is set, else spawns the local Python sidecar (`uv sync` in `services/ingestion-py`). Never commit/echo these.

## 5. What's built & merged (the integrated app on `main`)
All six streams, reconciled and verified by a live headless walk:
1. **collections** — collection CRUD, card move/bulk-move, library rewrite. Delete forces move-or-delete (no orphans).
2. **generation-pipeline** — async **Batch** pipeline: chunk → per-chunk extract+draft → deterministic quality gates (the 4 CARD-QUALITY rules, no LLM-judge) → grounding → self-fix → persist; driven by `app/api/jobs/poll` + a realtime job page.
3. **study-scheduling** — scheduled + cram modes, leech detection.
4. **feedback-metrics** — `lib/feedback` (`selectFewShotExamples` few-shot loop), `lib/metrics` (edit-rate, retention, **graduation ladder**), `/metrics` dashboard.
5. **ingestion** — PDF/Word → markdown via the Python sidecar / Railway service.
6. **auth-pwa-reminders** — installable PWA, web-push daily reminders, auth hardening.

**Reconciliations done during integration:** (a) generation consumes the canonical `lib/feedback` contract (stub deleted); (b) one shared `flagBadCard` (deduped study vs review); (c) file upload routes through the async pipeline via a shared `startDeckGeneration()`. Also fixed a real bug: the username `pattern` regex was invalid under Chromium's `v`-flag.

## 6. Post-fan-out decisions — ALL SIGNED OFF (2026-06-11)
Don't re-litigate:
- **Graduation ladder = symmetric + hysteresis.** Review effort drops as the AI earns trust (review-all → spot-check <15% → trust <10%) and climbs back if quality regresses; a ±3-pt deadband prevents flip-flop. (`lib/metrics/config.ts`, `graduation.ts`.)
- **Study "this card is bad"** logs `generation_feedback action='rejected'` (reason `[study]`), counts toward the edit rate — BUT **leeches do NOT auto-reject** (a hard-but-correct card isn't a generation failure); a leech only surfaces a banner; the user decides.
- **Collection-view card edits count toward the edit rate** (tagged `[collection]`, grouped into a separate `collection-maintenance` batch so they don't rewrite generation-batch quality).
- **Generation** = single Batch request per chunk (two-step collapsed; schema has one `anthropic_batch_id`). Keystone `prompt.ts` edited (two-step PROCESS, self-fix, per-chunk grounding) — reviewed, accepted.
- **Ingestion: keep Docling**, deployed as its own Railway service (CPU torch, OCR off).
- **Push storage** moved off Auth `user_metadata` → `push_subscriptions` table + `profiles.reminder_*` (migration applied; `lib/push` rewritten; cron queries only `reminder_enabled` profiles).

## 7. 🎨 THE UI/UX DESIGN (converged — NOT yet built into the app)
Major output of the latest sessions. The real app still has skeleton UI; **these mockups are the target to build.**

### Where it lives — `.context/mockups/` (gitignored, local only)
- **`index-web.html`** — desktop gallery (open in a browser).
- **`index-mobile.html`** — mobile gallery with **pill navigation** (one screen at a time).
- **`theme.css`** + **`tw-config.js`** — shared design tokens (source of truth for color/spacing/components); both accents wired via `data-accent` (**sage chosen**).
- **`POLISH.md`** — researched visual-polish checklist (Refactoring UI, NN/g, WCAG AA, Material motion, Apple HIG, Linear/Vercel/Stripe). Apply during the real build.
- `render-web.mjs` / `render-mobile.mjs` — Playwright renderers → PNGs in `/tmp/carding-shots/mockups/`.
- **Chosen web screens:** `web-home-b`, `web-study-gate`, `web-study-a`, `web-review-a`, `web-new-a`, `web-deck-a`, `web-metrics-a`, `web-settings-a`. **Chosen mobile:** `mobile-{home,gate,study,review,new,generating,deck,metrics,settings}`. (Other `web-home-a/c`, `web-review-b`, `home/study/review/etc-*` alternatives = explored-and-discarded; ignore.)

### Design language
- **Accent: sage** (`--primary:#5e7d6e`). Warm-neutral base (`#faf9f7` / `#1c1917`), **Inter**. **shadcn/ui** is the chosen component base (NOT yet installed in the app). Minimal, frictionless, restrained accent; one radius token; subtle depth; tabular nums for counts.
- **Terminology:** user-facing **"Decks"** (code stays `collections`).
- **Count triplet** (Anki-style): `new + learning + due` = **blue `#2563eb` + red `#e11d48` + green `#16a34a`**.

### Information architecture (a real shift from the current app)
- **Decks home is the hub. Study is deck-by-deck** — NO global "study everything today." Tap a deck → quick **gate** (Study due N / Cram all) → study.
- **Manage/edit a deck via a ⋯ menu**, not the primary tap (editing is de-prioritized — the AI should make good cards).
- **Review** (triage of freshly-generated cards) appears contextually ("To triage"), not as a permanent nav item.
- **Nav:** web = fixed full-height **left sidebar** (Decks · ＋New · To-triage Review · profile→Metrics/Settings); mobile = **bottom tab bar = Decks · New · Profile** (even thirds, no raised FAB; Metrics/Settings + Review behind Profile/contextual).

### Per-screen decisions
- **Decks home:** web = deck **grid** (`web-home-b`), tap = study, ⋯ = manage, due via accent ring + count. Mobile = clean **list** — **no due numbers, no "caught up"/"new" pills** (numbers are web-only); due-ness shown subtly (accent ring + filled play).
- **New / capture:** drop-zone + paste, **NO "complex layout" switch** (parser auto-detects). Makes a **new deck** named from the doc.
- **Generating:** async progress + live "N cards so far" + skeletons.
- **Study gate:** after tapping a deck — "Study due N" (primary) vs "Cram all" (secondary).
- **Study:** **card-less, Anki-style, text anchored at the TOP**, prompt & answer **same size**, **NO source shown**, **NO deck/Due-Cram header** (mode set at the gate). Compact grade buttons (Again/Hard/Good/Easy + intervals + keys 1–4); the colored `new+learning+due` triplet; quiet "this card is bad".
- **Review:** **card-less, top-anchored**, term + definition **same size**, **NO source**, small **Reject / Edit / Keep chips** (+ arrow keys on web). NOTE: card-less = **no Tinder swipe** — chose keyboard/chips + minimalism (a minimal swipe card is the fallback if reconsidered).
- **Deck detail (manage/edit):** cards **table** — Term / Definition / Status, **NO source column**; search; multi-select + bulk Move/Delete. Reached via ⋯.
- **Metrics:** dashboard — graduation ladder, edit rate (lower=better), retention vs 90% target, per-deck.
- **Settings:** daily reminders (toggle + time + tz) · PWA install · account.
- **Grounding/source is still captured under the hood** (a quality signal) — just not shown in study/review/deck UI.

### Polish (apply during the build — see `POLISH.md`)
4px spacing scale; ≤~66ch measure; near-black/tinted neutrals; AA contrast; one-radius + nested-radius; 150–200ms ease-out motion + `prefers-reduced-motion`; `:focus-visible` rings; ≥44px hit targets; tabular nums; **fixed full-height sidebar, content-only scroll** (already in the web mockups).

## 8. What's NOT done / next steps (priority order)
1. **Build the converged UI in the real app** (the big one): install **shadcn/ui** + the sage theme tokens, then implement screen-by-screen per the mockups. Suggested order: nav shell + Decks home → study gate → study → review → new/generating → deck detail → metrics → settings. This realizes the **IA shift** (deck-by-deck study, the gate, card-less study/review, "Decks" terminology) — the current app's study is global/scheduled and review is the old button UI.
2. **Seed 3–5 example "good cards"** so `selectFewShotExamples` matches the user's taste from day one (loop works; no taste examples yet).
3. **Reminder cron:** nothing calls `/api/cron/reminders` yet. Set up **Supabase `pg_cron` + `pg_net`** (small serialized migration) to hit it with `CRON_SECRET`.
4. **Deploy the Next app** (e.g. Vercel): set all env vars there incl. `INGESTION_SERVICE_URL` + token; optionally GitHub-connect the Railway service.
5. Optional: write `docs/DESIGN.md` (design principles + picks; currently captured here + `.context/mockups/`); prune merged branches.

## 9. File map (key paths)
```
docs/                      frozen (VISION, CARD-QUALITY, METRICS, SCHEDULING) + living (PIPELINE, ARCHITECTURE, BUILD-PLAN, FUTURE-IDEAS)
app/(app)/                 library, collections/[id], new + new/[jobId], review, study, metrics, settings  (+ layout.tsx nav)
app/(auth)/                login, signup, actions.ts
app/api/                   jobs/poll (generation), cron/reminders (web-push)
lib/generation/            anthropic, chunk, gates, process, selffix, submit, prompt (= CARD-QUALITY for the model)
lib/feedback/              examples.ts (selectFewShotExamples) + index.ts   ← cross-stream contract
lib/metrics/               config, edit-rate, retention, graduation, server
lib/scheduling/            fsrs.ts, leech.ts
lib/push/                  store.ts, reminders.ts, web-push.ts, types.ts   (now on Postgres tables)
lib/ingestion/             index.ts (TS adapter: Railway HTTP when INGESTION_SERVICE_URL set, else spawn the CLI)
services/ingestion-py/     ingest.py (CLI), server.py (FastAPI), Dockerfile, railway.json, prefetch_docling.py
supabase/migrations/       20260611094838_init_schema.sql, 20260611120000_push_subscriptions.sql
.context/mockups/          ← THE UI/UX DESIGN: theme.css, tw-config.js, index-web.html, index-mobile.html, web-*.html, mobile-*.html, POLISH.md
scripts/                   smoke-gen, smoke-ingest, walk*.mjs, verify-*, cleanup-test-users
```

## 10. Run / build / verify
- `pnpm install`; dev `pnpm dev`; typecheck `pnpm exec tsc --noEmit`; build `pnpm build` (both clean on `main`).
- Generation smoke: `set -a; . ./.env.local; set +a; pnpm exec tsx scripts/smoke-gen.ts`.
- Ingestion (local sidecar): `uv sync` in `services/ingestion-py`, then `pnpm exec tsx scripts/smoke-ingest.ts`. Or Railway: `curl https://carding-ingestion-production.up.railway.app/health`.
- Push storage: `pnpm exec tsx scripts/verify-push.ts`. Full loop: `node scripts/walk.mjs` (Playwright; shots → `/tmp/carding-shots/`).
- View the design: open `.context/mockups/index-web.html` and `index-mobile.html` in a browser.
- **Discipline: prove changes by running the app, not just typechecking.**

## 11. Gotchas
- Next 16 renamed middleware → **`proxy.ts`** (function `proxy`). · `create-next-app` clobbers `CLAUDE.md` — restore it. · tsx + CJS needs `.mjs`/async IIFE.
- **Railway:** free-tier 1 GB cap OOMs Docling → Hobby required. CUDA torch bloated the image (~6 GB) → CPU-only torch. `railway.json` must NOT set a `$PORT` startCommand without shell expansion (the Dockerfile `CMD` owns it). Image bakes models → warm cold-start.
- **Mockups** use the Tailwind Play CDN + `theme.css`; accent flips via `?accent=sage|crimson` (sage chosen). Galleries cache iframes — hard-refresh (Cmd+Shift+R) after edits.
- `lib/feedback` is the contract both feedback-metrics and generation depend on — change its signature deliberately.

## 12. Credentials & access
`.env.local` holds all secrets (§4). Supabase CLI logged in (`~/.supabase`); `gh` authed; Railway CLI logged in (`david@framewisehealth.com`). Never commit/echo any of these.

## 13. Memory
Auto-memory at `~/.claude/projects/-Users-davidcui824-conductor-repos-flashcarding/memory/`: `carding-project.md`, `carding-research-2026.md`, `carding-feedback-metrics-stream.md` (the last now records the signed-off post-fan-out decisions). Start a new session by reading `CLAUDE.md` + `docs/` + this handoff + `.context/mockups/` (for the design).
