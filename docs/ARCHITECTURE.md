# ARCHITECTURE (living)

Stack and system boundaries. This is the most drift-prone doc — it is kept at the **boundary/contract level**; the code owns exact schemas, file layout, and versions.

## Stack
- **App: Next.js (App Router, TypeScript, React)**, shipped as a web app and an **installable PWA** — one codebase covering desktop and mobile. No Electron/Tauri in v1 (`FUTURE-IDEAS.md`).
- **Data/back end: Supabase** — Postgres (data), Auth (username/password), Realtime (cross-device sync), Storage (images/uploads).
- **AI generation: Claude `claude-sonnet-4-6`**, called **server-side only** (Next.js route handlers / a server function). The Anthropic API key never reaches the client. Opus 4.8 is a measured fallback only if quality on Sonnet proves insufficient — decided from the edit rate, not assumed.
- **Scheduling: `ts-fsrs`, client-side** (`SCHEDULING.md`).

## The client/server boundary
- **Client** (Next.js/PWA): review UI (Tinder flow), study loop, FSRS scheduling, local cache, sync. Daily study reminders via push notifications (works on installed PWAs incl. iOS 16.4+).
- **Server**: the generation pipeline (`PIPELINE.md`), card persistence, and anything holding a secret. Long generation runs go through the **Batch API** (async) with a job record the client subscribes to — sidestepping serverless time limits.
- **Offline review is v2** (`FUTURE-IDEAS.md`); v1 assumes connectivity.

## Document ingestion
- **Pasted text / markdown** need essentially no parsing — handled directly. This is the primary, fastest path.
- **PDF / Word**: parse to clean markdown with **MarkItDown** (Microsoft, MIT) as the fast default, falling back to **Docling** (IBM, MIT) for structurally complex documents (tables, multi-column). Both are MIT-licensed — chosen over the faster but AGPL `PyMuPDF4LLM` to keep the productization path clean, and over paid APIs (Reducto, LlamaParse) which are overkill for mostly-digital PDFs.

## Images
- Sourced from the **document** (figures/photos extracted with their captions; the multimodal model associates each with the right concept) or **pasted** by the user. Web-searched / AI-generated images are deferred (`FUTURE-IDEAS.md`) — AI-generating a photo of a specific real thing hallucinates a fake one.
- Stored in **Supabase Storage**; cards reference them. Supported on the front (visual-recognition cards) and back.

## Claude API usage (see the `claude-api` skill for exact syntax)
- **Structured outputs** (`output_config.format`) so cards return as validated JSON.
- **Prompt caching** so a source document is read once and reused cheaply across pipeline passes.
- **Batch API** for the async generation runs (50% cost reduction; async fits the parsing latency anyway).
- **Grounding** is done against our own ingested/chunked source text (span overlap), not a separate service.

## Data model (entities only — code owns the exact schema)
- **Source** — an ingested document/paste; its normalized text and chunks; provenance.
- **Card** — term, definition, optional image refs, source-span link, review status, FSRS state; belongs to exactly one Collection.
- **Collection** — a flat, user-curated study deck (no nesting in v1); a card lives in exactly one.
- **Review event** — kept / edited (before→after) / rejected (reason); feeds metrics and the feedback loop.
- **Generation job** — async batch status the client subscribes to.

## Cost (informational — not a v1 constraint)
Sonnet 4.6 is $3 / 1M input tokens, $15 / 1M output. Generating ~100 cards from a ~10–15 page source is roughly **$0.35** (about half a cent per card), ~halved with the Batch API. Negligible at personal scale; only relevant if Carding becomes a multi-user product.

## Auth
Username/password via Supabase Auth — deliberately simple. Needed even for a personal tool because cross-device sync requires an account.
