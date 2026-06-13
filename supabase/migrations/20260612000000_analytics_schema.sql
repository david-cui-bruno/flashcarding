-- Carding — analytics & review-mode schema.
-- Adds: study_reviews.collection_id (denorm), collections.review_mode,
--       deck_metrics_snapshots table, SQL views for retention + edit-rate.
-- See docs/ANALYTICS.md for the full spec.

-- ── Enums ──────────────────────────────────────────────────────────────────────
create type review_mode as enum ('review_all', 'spot_check', 'trust');

-- ── 1. Denorm collection_id onto study_reviews ─────────────────────────────────
-- Allows fast per-deck retention queries without joining through cards.
alter table study_reviews
  add column collection_id uuid references collections(id) on delete set null;

create index study_reviews_collection_id_idx on study_reviews(collection_id);
create index study_reviews_collection_reviewed_at_idx
  on study_reviews(collection_id, reviewed_at desc);

-- Backfill existing rows (no data in v1 dev, but safe to have).
update study_reviews sr
set    collection_id = c.collection_id
from   cards c
where  c.id = sr.card_id
  and  sr.collection_id is null;

-- ── 2. Review mode on collections ─────────────────────────────────────────────
alter table collections
  add column review_mode review_mode not null default 'review_all';

-- ── 3. Deck metrics snapshots ──────────────────────────────────────────────────
-- Cached rollup: read by the UI, refreshed on-demand (15-min floor per spec).
create table deck_metrics_snapshots (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  collection_id   uuid references collections(id) on delete cascade,
  -- null collection_id = the global (all-decks) row for this user

  retention_pct   real,          -- 0.0–1.0; null if no study reviews yet
  edit_rate_pct   real,          -- 0.0–1.0; null if no generation feedback yet
  cards_due       int not null default 0,
  cards_total     int not null default 0,
  sampled_at      timestamptz not null default now()
);

create index deck_metrics_snapshots_user_collection_idx
  on deck_metrics_snapshots(user_id, collection_id);
create index deck_metrics_snapshots_user_global_idx
  on deck_metrics_snapshots(user_id)
  where collection_id is null;

alter table deck_metrics_snapshots enable row level security;
create policy "deck_metrics_snapshots_owner"
  on deck_metrics_snapshots for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── 4. SQL views — canonical formulas used by lib/feedback/ ───────────────────

-- Retention: scheduled-mode reviews in the last 30 days, grade >= 3 = pass.
create or replace view v_collection_retention_30d as
select
  sr.user_id,
  sr.collection_id,
  count(*)                                         as reviews_total,
  count(*) filter (where sr.grade >= 3)            as reviews_passed,
  round(
    count(*) filter (where sr.grade >= 3)::numeric
    / nullif(count(*), 0),
    4
  )                                                as retention_pct
from study_reviews sr
where sr.mode = 'scheduled'
  and sr.reviewed_at >= now() - interval '30 days'
  and sr.collection_id is not null
group by sr.user_id, sr.collection_id;

-- Edit rate: generation feedback in the last 30 days (cards in the collection).
create or replace view v_collection_edit_rate_30d as
select
  c.user_id,
  c.collection_id,
  count(*) filter (where gf.action in ('edited','rejected'))  as feedback_negative,
  count(*)                                                    as feedback_total,
  round(
    count(*) filter (where gf.action in ('edited','rejected'))::numeric
    / nullif(count(*), 0),
    4
  )                                                           as edit_rate_pct
from generation_feedback gf
join cards c on c.id = gf.card_id
where gf.created_at >= now() - interval '30 days'
  and c.collection_id is not null
group by c.user_id, c.collection_id;
