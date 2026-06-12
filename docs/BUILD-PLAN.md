# BUILD-PLAN (living)

How we build Cardstock with parallel Conductor agents without merge collisions. This is the coordination doc: it defines the phases, the serialization points, and **which files each parallel stream owns** so agents don't step on each other.

## The two constraints that govern everything
1. **Shared files → merge conflicts.** Each Conductor workspace is its own worktree+branch, merged via PR. Agents must own **non-overlapping files**.
2. **Shared runtime → Supabase.** All workspaces hit one Supabase project. **The DB schema is a serialization point** — never run migrations from multiple branches at once. Next.js dev servers are fine in parallel (each gets its own `CONDUCTOR_PORT`).

## Shape: narrow → thin skeleton → wide → narrow

### ① Trunk (sequential, ONE workspace → merge to main first)
The synchronization point everything branches from. Do this before any fan-out.
- Next.js (App Router, TS) scaffold + tooling + `.conductor/settings.toml`.
- Supabase schema/migrations (Source, Card, Collection, ReviewEvent, GenerationJob) + auth.
- **Shared contracts**: TS types (generated from the Supabase schema) + API route signatures, with **mock implementations** so everything compiles and the UI can build against fakes.
- Base app shell: layout, routing/nav skeleton, a minimal shared component set.

### ② Walking skeleton (mostly sequential, small → merge to main)
Thinnest end-to-end path: **paste text → generate (real Sonnet 4.6) → Tinder review → save to collection → study with FSRS.** No PDF parsing, no images, no auth polish. Proves the architecture and contracts are right before six things build on them.
- Deliberately **paste/markdown only** — needs no parser and no Python, so the core loop stays pure TypeScript.

### ③ Fan out (max parallelism — up to ~6 workspaces, against the now-frozen contracts)
See ownership table below. Peak useful parallelism is ~6 (the number of non-overlapping slices), not infinite.

### ④ Converge (low parallelism)
Integration, replace mocks with real impls, wire images through, end-to-end polish. Touches shared seams — few agents.

## Stream ownership (phase ③) — each stream owns these paths, depends only on the trunk contracts

| Stream | Owns (files/dirs) | Depends on |
|---|---|---|
| **PDF/Word ingestion** | `services/ingestion-py/` (MarkItDown+Docling sidecar), `lib/ingestion/pdf/` adapter | bytes→markdown contract |
| **Generation pipeline** | `lib/generation/`, `app/api/generate/`, `app/api/jobs/` | Card type, jobs table, ingestion contract |
| **Study + scheduling** | `lib/scheduling/` (ts-fsrs), `app/(study)/` | Card type, FSRS state |
| **Collections** | `app/(library)/`, `app/api/collections/` | Card + Collection types |
| **Auth + PWA + reminders** | auth wiring, PWA manifest/service worker, push, `app/(auth)/` | Supabase auth |
| **Feedback + metrics** | `lib/feedback/`, metrics views/queries | ReviewEvent type |

### Contention zones (manage deliberately, don't parallelize blindly)
- `components/` (shared UI), `app/layout.tsx` + nav, `package.json`: establish a stable base in the **trunk/skeleton** so streams extend rather than rewrite. Minor `package.json` merge conflicts are expected and cheap to resolve.
- `supabase/migrations/` and `lib/types/`: **frozen during fan-out.** A schema change is a small *serialized* PR routed through one workspace — never six in parallel.

## Conductor operations
- Do ① and ② **here, in this workspace, sequentially**, and merge to `main`. Every new Conductor workspace branches fresh from `origin/main`, so it inherits the proven trunk for free.
- Only **after ② is on main**, create ~6 workspaces (one per stream above) and fan out.
- The frozen `docs/` + `CLAUDE.md` are the coordination layer that keeps parallel agents building one product. Each stream reads them.

## Manual prerequisites (only the human can do these)
- Create a **Supabase project**; put URL + anon key + service-role key in `.env.local` (gitignored; copied into each workspace via `.worktreeinclude`).
- Confirm an **Anthropic API key** in `.env.local`.
- Provide **3–5 example "good cards"** to seed generation style (not blocking the trunk; needed before the generation stream produces real output).
