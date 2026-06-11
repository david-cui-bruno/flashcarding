# Carding — Project Handoff

_Last updated: 2026-06-11. This is a point-in-time status doc, not a spec. The specs are in `docs/` (and are the source of truth for intent); the code is the source of truth for implementation._

---

## 1. TL;DR
Carding turns documents into atomic, AI-generated flashcards reviewed on an FSRS (modern-Anki) schedule. The **foundation + a verified walking skeleton are merged to `main`** (PR #1). The **six parallel build streams have begun fanning out** in separate Conductor workspaces. Everything compiles, and the full loop (signup → paste → generate → review → study) was walked live in a real browser.

## 2. What it is / who it's for
A personal tool (built to be productizable) for a power-memorizer who learns by flashcards and wants to stop hand-authoring them. Read `docs/VISION.md`. The differentiator is **card quality** (`docs/CARD-QUALITY.md` is the keystone).

## 3. Current state
- **`main` = commit `f7ee10b`** (PR #1 merged). Contains: all spec docs, the Supabase schema + generated types, the Next.js app, the generation core, and the full walking-skeleton loop. `tsc --noEmit` and `next build` are clean.
- **Verified live**: a headless-Chromium walk (`scripts/walk.mjs`) ran signup → paste → live Sonnet generation (9 grounded atomic cards) → keep/edit/reject → FSRS grade. The proxy gates all protected routes (`307 → /login`).
- **Fan-out is in progress.** At least the **feedback+metrics** stream is live on branch `david-cui-bruno/albuquerque-v2` (see §10).

## 4. Repo & branches
- GitHub: `github.com/david-cui-bruno/flashcarding`. Default/base branch: `main`.
- Conductor root repo dir: `/Users/davidcui824/conductor/repos/flashcarding`. Workspaces live under `/Users/davidcui824/conductor/workspaces/flashcarding/<name>`.
- Commit history on `main`: `06d0b20` (initial) → `66f77af` (foundation) → `de8cbe7` (skeleton) → `b0d627b` (e2e harness) → `f7ee10b` (merge).
- This handoff was authored from workspace `shanghai-v1` (branch `david-cui-bruno/superhot-story-flashcard-docs`, now merged).

## 5. Stack & file map
- **Next.js 16 + React 19 + Tailwind v4 (TypeScript)**, pnpm. Installable PWA is the v1 target (no Electron). Newer than most training data — `AGENTS.md` says read `node_modules/next/dist/docs/` before writing framework code.
- **Supabase** (Postgres + Auth + Realtime + Storage) for data, auth, sync.
- **Claude `claude-sonnet-4-6`**, server-side only, for generation.
- **`ts-fsrs`** for scheduling, client-side.

```
docs/                     frozen + living specs (see §9)
CLAUDE.md                 anti-drift rule + doc hierarchy (imports AGENTS.md)
.conductor/settings.toml  Conductor setup/run + file copy
proxy.ts                  Next 16 "proxy" (session refresh + auth gating)
lib/supabase/             client.ts (browser) / server.ts / admin.ts (service role) / proxy.ts (updateSession)
lib/types/                database.ts (generated from schema) + domain.ts (aliases + GeneratedCard)
lib/generation/           prompt.ts (= CARD-QUALITY rubric) + generate.ts (Sonnet structured-output call)
lib/auth/                 username.ts (username→synthetic email), types.ts
lib/scheduling/           fsrs.ts (ts-fsrs wrapper, schedule())
app/(auth)/               login/, signup/, actions.ts
app/(app)/                layout.tsx (nav + auth guard), library/, new/, review/, study/
supabase/migrations/      20260611094838_init_schema.sql
scripts/                  smoke-gen.ts (gen check), walk.mjs (Playwright e2e), cleanup-test-users.mjs
```

## 6. Supabase
- Project **`carding`**, ref **`tmqgknkshpkxojvdhejq`**, region `us-east-1`, org `Framewise Health` (`kzvhxeerxutujfgycfla`). `ACTIVE_HEALTHY`.
- The Supabase **CLI is logged in** on this Mac (`~/.supabase`), so `supabase` commands work for any workspace.
- **Schema** (one migration): tables `profiles, collections, sources, cards, generation_jobs, generation_feedback, study_reviews`. **Owner-only RLS** on every table (`auth.uid() = user_id`). Private **`card-images`** storage bucket (owner-scoped by `<user_id>/` path). Realtime enabled on `generation_jobs`. `cards` carries the FSRS columns.
- **Manage:** edit/add a migration under `supabase/migrations/`, then `supabase db push`. Regenerate types: `supabase gen types typescript --linked > lib/types/database.ts`. **The schema is FROZEN for the fan-out** — any change must be one serialized migration coordinated with the human, never parallel.

## 7. Generation core
- `lib/generation/prompt.ts` is **`docs/CARD-QUALITY.md` expressed for the model** — the single definition of a good card, reused as the generation prompt (and meant to be reused as the grounding gate + eval rubric). Output is structured (`output_config.format` JSON schema): `{ cards: [{ term, definition, source_span }] }`.
- Card model: **one term + one atomic fact**; rich entities decompose into **many same-term cards**; every card carries a verbatim `source_span` (grounding). Default review direction is **fact → recall the term** (so shared terms aren't ambiguous). Generous inclusion bar.
- Skeleton generation is **synchronous** (one Sonnet call in a server action). The real pipeline (async Batch, chunking, deterministic gates, grounding verification, self-fix, feedback loop) is the **generation-pipeline fan-out stream**.

## 8. Auth
Username/password with no email step: the username maps to a synthetic email `<user>@carding.local` (`lib/auth/username.ts`); signup uses the **admin client** to `createUser({ email_confirm: true })`, inserts a `profiles` row, then signs in. `proxy.ts` refreshes the session and gates routes (unauth → `/login`; auth on `/login|/signup|/` → `/library`).

## 9. The docs system (read these)
**🔒 Frozen (do not drift through v1):** `VISION`, `CARD-QUALITY` (keystone), `METRICS`, `SCHEDULING`.
**Living (contract-level; code is truth for details):** `PIPELINE`, `ARCHITECTURE`, `BUILD-PLAN`, `FUTURE-IDEAS`.
**Anti-drift rule (`CLAUDE.md`):** docs = intent/contracts, code = implementation truth; if code must diverge from a frozen doc, **flag it, don't silently rewrite**.

## 10. Metrics & feedback loop
- **North stars:** near-term = **card quality = edit rate** (metric B); long-term = **retention** (metric A). See `docs/METRICS.md`.
- **No LLM-as-judge.** Quality = deterministic gates + grounding + human review + the feedback loop.
- **Feedback loop = dynamic few-shot** (NOT fine-tuning): the user's kept/edited cards are injected into future generation prompts.
- **HITL graduation ladder:** review-all → spot-check at <15% edit rate → trust at <10%.
- **Live cross-stream contract (from the feedback+metrics stream, branch `albuquerque-v2`):**
  - `lib/feedback` exports **`selectFewShotExamples({ client, userId, sourceText?, collectionId?, limit? }) → FewShotExample[]`** where `FewShotExample = { term, definition, kind: 'kept'|'edited', before }`, best-first, ~half the slots reserved for edits. **The generation-pipeline stream must consume this exact signature.**
  - That stream also lives in `lib/metrics/`, `app/(app)/metrics/`, and the review/study surfaces; thresholds in `lib/metrics/config.ts`.
  - Two decisions it **flagged as extensions to frozen METRICS.md** (need human sign-off): (1) the ladder is **symmetric** (effort rises again if quality regresses); (2) a study-time **"this card is bad"** flag logs to `generation_feedback` as `action='rejected'` with reason prefixed `[study]`, so it both trains the loop and counts toward the edit rate.

## 11. Build plan & fan-out
`docs/BUILD-PLAN.md` defines the phasing and per-stream file ownership. Foundation + skeleton are done; now the six streams run in parallel, each in its own Conductor workspace branched from `main`. Kickoff prompts: **`~/Downloads/carding-fanout-prompts/`** (`00-README` + `01`–`06`).
1. **ingestion** — PDF/Word → markdown (Python sidecar: MarkItDown + Docling).
2. **generation-pipeline** — async Batch + gates + grounding + self-fix + the few-shot loop (consumes `selectFewShotExamples`).
3. **study-scheduling** — FSRS scheduled + cram modes, leeches, uncapped new cards.
4. **collections** — CRUD + move cards.
5. **auth-pwa-reminders** — installable PWA + daily reminders.
6. **feedback-metrics** — metrics + graduation ladder + `lib/feedback` + review polish. **(in progress, `albuquerque-v2`)**

**Coordination points:** `app/(app)/new/` (ingestion ↔ generation); the `selectFewShotExamples` signature (generation ↔ feedback-metrics); `app/(app)/review/` and study surfaces (feedback-metrics owns these). Merge PRs **one at a time**; expect small `package.json` conflicts.

## 12. Run / build / verify locally
From a workspace with `.env.local` present:
- Install: `pnpm install`
- Dev: `pnpm dev` (or `pnpm exec next dev -p <port>`)
- Typecheck: `pnpm exec tsc --noEmit` · Build: `pnpm build`
- Generation smoke (no browser): `set -a; . ./.env.local; set +a; pnpm exec tsx scripts/smoke-gen.ts`
- Full e2e walk (browser): start dev server, then `node scripts/walk.mjs` (Playwright + Chromium installed). Screenshots → `/tmp/carding-shots/`.
- Per the verify discipline: prove changes by **running the app**, not by typechecking.

## 13. Conductor operational notes
- Config is **`.conductor/settings.toml`** (TOML; `conductor.json` is legacy — don't use it). `setup = pnpm install`, `run = pnpm dev --port $CONDUCTOR_PORT`, `run_mode = concurrent` (safe — each workspace gets its own port; Supabase is remote).
- **`.env.local` is gitignored** and is copied into new workspaces via `file_include_globs = ".env.local\n.env*.local"`. Conductor copies it **from the root repo dir** (`CONDUCTOR_ROOT_PATH`) — which now has it. If a new workspace is missing it, copy from `/Users/davidcui824/conductor/repos/flashcarding/.env.local`.
- New workspaces fetch `origin` first, so they branch from the **merged** `main` even though the root's local checkout is behind.

## 14. Credentials & access
- `.env.local` (gitignored; in the root + each workspace) holds: `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS — server-only), `SUPABASE_DB_PASSWORD`. Never commit or echo these.
- Supabase CLI logged in (`~/.supabase`). `gh` CLI is authed (used to push + open/merge PR #1).

## 15. Known limitations (what the skeleton intentionally fakes)
- Generation is **synchronous** (blocks ~20s); real one is async Batch (stream 02).
- Input is **paste/markdown only**; PDF/Word is stream 01.
- Review is **buttons**, not swipe; the Tinder swipe + "trust mode" is stream 06.
- No collections management UI beyond a list (stream 04), no PWA/reminders (stream 05), no metrics views yet (stream 06).
- No images yet (front/back image support is planned; bucket + columns exist).

## 16. Gotchas encountered (so you don't re-hit them)
- **zsh `:r`:** `"$var:refs/..."` is parsed as a zsh modifier — use `"${var}:refs/..."`.
- **Next 16 renamed middleware → `proxy.ts`** (function `proxy`); `middleware.ts` only warns.
- **create-next-app clobbers `CLAUDE.md`** with an `@AGENTS.md` stub when scaffolding into an existing dir — restore it.
- **tsx + CJS:** top-level `await` needs `.mjs` or an async IIFE.
- **PR base:** `main` didn't exist on the remote until pushed from the initial commit.

## 17. Open items needing the human
- Sign off (or adjust) the two METRICS extensions in §10 (symmetric ladder; study-flag → reject).
- Provide **3–5 example "good cards"** to seed `selectFewShotExamples` so generation matches the user's taste from day one.
- Decide reverse-card behavior details for multi-fact terms when the study stream deepens.

## 18. Memory & where to look
Auto-memory at `~/.claude/projects/-Users-davidcui824-conductor-repos-flashcarding/memory/`: `carding-project.md` (decisions + build state), `carding-research-2026.md` (tooling research), `carding-feedback-metrics-stream.md` (the live contract above). Start any new session by reading `CLAUDE.md` + `docs/`.
