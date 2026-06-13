# ANALYTICS (living)

Spec for deck-level analytics and review-mode state.
Unblocks the metrics backend (lib/feedback/ stream) and the Metrics UI.

> This doc describes **contracts**. The code (migration, query helpers) is the
> source of truth for exact schemas and formulas.

---

## 1. What we track (data sources already in the schema)

| Event | Table | Key columns |
|---|---|---|
| Each grade during study | `study_reviews` | card_id, collection_id, grade, mode, reviewed_at |
| Each card edit during generation review | `generation_feedback` | card_id, action ('kept'/'edited'/'rejected'), created_at |
| Deck-level metric cache | `deck_metrics_snapshots` | collection_id, retention_pct, edit_rate_pct, review_mode, sampled_at |

`study_reviews.collection_id` is denormalized (copied from `cards.collection_id`
at insert time) so per-deck retention queries never need a join through `cards`.

---

## 2. Formulas

### Retention % (metric A)

```
retention_pct = (reviews where grade >= 3) / (total reviews)
```

- `grade >= 3` (Good or Easy) = "passed". Grade 1 (Again) and 2 (Hard) = lapse.
- Window: **rolling 30 days** of `study_reviews` in `scheduled` mode only.
  Cram reviews (`mode = 'cram'`) are excluded — they don't reflect true recall.
- Scope: per-collection using `study_reviews.collection_id`.
- Global (across all decks): same formula, no collection filter.
- Target: **90%** (from SCHEDULING.md). The UI shows target vs. actual.
- Sparkline (per-batch): retention bucketed by the card's `generation_job_id`
  (a proxy for creation batch). For each job, compute retention from `study_reviews`
  joined to cards where `cards.generation_job_id = ?`.

### Edit rate % (metric B)

```
edit_rate_pct = (generation_feedback where action IN ('edited','rejected'))
              / (generation_feedback where action IN ('kept','edited','rejected'))
```

- Window: **rolling 30 days** of `generation_feedback` for cards in the collection.
- Scope: per-collection by joining `generation_feedback.card_id → cards.collection_id`.
- Global: same formula, no collection filter.
- The graduation-ladder thresholds (15% → Spot-check, 10% → Trust) live in
  `docs/METRICS.md` and are evaluated client-side from the computed edit_rate_pct.

Assumption: 30-day rolling windows give a stable signal without requiring
full-history scans, and match the "recent quality" framing shown in the UI.
All-time figures are available by dropping the date filter.

---

## 3. Deck metrics snapshot table

`deck_metrics_snapshots` caches the computed rollup so the dashboard loads fast
without running expensive aggregates on every page view.

```
deck_metrics_snapshots
  id              uuid PK
  user_id         uuid → auth.users
  collection_id   uuid → collections (nullable: null = global/all-decks row)
  retention_pct   real          -- 0.0–1.0
  edit_rate_pct   real          -- 0.0–1.0
  cards_due       int           -- cards due today (for the review badge)
  cards_total     int
  sampled_at      timestamptz   -- when this snapshot was computed
```

---

## 4. Refresh cadence

**On-demand with a 15-minute floor.** The client requests a refresh when:
1. The user opens the Metrics view (or the per-deck card in the Library view).
2. A generation job completes (new cards → edit rate changes immediately).
3. A study session ends (retention may have changed).

The server checks `sampled_at`. If the most recent snapshot is < 15 minutes old,
it returns the cached row without recomputing. Otherwise it runs the aggregates
and writes a new snapshot row.

There is no nightly cron in v1 — the personal-scale usage pattern (one active
user, infrequent sessions) makes on-demand refreshes sufficient and simpler than
a scheduled job. A background refresh job is noted in `docs/FUTURE-IDEAS.md`.

---

## 5. Review mode state

### What it is
The graduation ladder from `docs/METRICS.md`:
- `review_all` — every generated card goes through Tinder review (default).
- `spot_check` — random ~20% sample reviewed; entered when edit_rate < 15%.
- `trust` — new cards skip review; entered when edit_rate stays < 10%.

### Storage: per-collection on the `collections` table
```sql
collections.review_mode  review_mode_enum  not null  default 'review_all'
```

Rationale: the appropriate level of trust may differ per deck (a mature
Architecture deck may be in Trust while a new Medicine deck starts at Review-All).
A global override is not needed — the user interacts with one deck at a time.

### How it transitions
Transitions are computed server-side after each generation batch completes:
1. Compute the rolling edit rate for the collection.
2. If current mode is `review_all` and edit_rate < 0.15 → promote to `spot_check`.
3. If current mode is `spot_check` and edit_rate < 0.10 across the last 3 batches
   → promote to `trust`.
4. Never auto-demote (the user may manually reset to `review_all` if quality drops).

The thresholds (0.15 / 0.10) mirror `METRICS.md` and live in a single server-side
constant so they are tuned in one place.

---

## 6. SQL views (helpers for the feedback stream)

Two non-materialised Postgres views live alongside the migration and are the
canonical query used by `lib/feedback/` query functions:

`v_collection_retention_30d` — per-collection rolling-30-day retention from
`study_reviews` (scheduled mode only).

`v_collection_edit_rate_30d` — per-collection rolling-30-day edit rate from
`generation_feedback` joined to `cards`.

These views are thin wrappers; the snapshot table is what the UI reads. The views
exist so the snapshot-refresh function has a single tested formula to call.

---

## 7. API contract (route handlers)

```
GET  /api/metrics                 → global snapshot (all decks combined)
GET  /api/metrics?collection=:id  → per-deck snapshot
POST /api/metrics/refresh         → force recompute (ignores 15-min floor; for tests)
```

All three return the same shape:
```ts
{
  retentionPct: number;     // 0–1
  editRatePct: number;      // 0–1
  reviewMode: ReviewMode;   // 'review_all' | 'spot_check' | 'trust'
  cardsDue: number;
  cardsTotal: number;
  sampledAt: string;        // ISO timestamp
}
```
