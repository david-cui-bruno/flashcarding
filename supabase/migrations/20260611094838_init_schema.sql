-- Carding — initial schema.
-- Entities per docs/ARCHITECTURE.md; card model per docs/CARD-QUALITY.md.
-- Code is the source of truth for the schema (see CLAUDE.md anti-drift rule).
-- gen_random_uuid() is core Postgres (>= 13), no extension needed.

-- Enums -----------------------------------------------------------------------
create type prompt_direction as enum ('definition_to_term', 'term_to_definition');
create type review_status     as enum ('pending', 'accepted', 'edited', 'rejected');
create type fsrs_state        as enum ('new', 'learning', 'review', 'relearning');
create type source_kind       as enum ('paste', 'markdown', 'pdf', 'docx');
create type generation_status as enum ('queued', 'running', 'succeeded', 'failed');
create type feedback_action   as enum ('kept', 'edited', 'rejected');
create type study_mode        as enum ('scheduled', 'cram');

-- updated_at trigger ----------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- profiles --------------------------------------------------------------------
-- Username/password auth: the username→email mapping is handled in the auth layer;
-- this row stores the app-facing username.
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- collections (flat study decks; a card lives in exactly one) ------------------
create table collections (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index collections_user_id_idx on collections(user_id);

-- sources (ingested docs/pastes; content retained for grounding) --------------
create table sources (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       source_kind not null,
  title      text,
  content    text not null,           -- normalized markdown/text: used for generation + grounding
  created_at timestamptz not null default now()
);
create index sources_user_id_idx on sources(user_id);

-- generation_jobs (async Batch runs; client subscribes via Realtime) ----------
create table generation_jobs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  source_id         uuid references sources(id) on delete set null,
  status            generation_status not null default 'queued',
  anthropic_batch_id text,
  cards_generated   int not null default 0,
  error             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index generation_jobs_user_id_idx on generation_jobs(user_id);

-- cards (term + one atomic definition; see docs/CARD-QUALITY.md) ---------------
create table cards (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  collection_id     uuid references collections(id) on delete set null,
  source_id         uuid references sources(id) on delete set null,
  generation_job_id uuid references generation_jobs(id) on delete set null,

  term             text not null,
  definition       text not null,
  front_image_path text,                -- path in the card-images storage bucket
  back_image_path  text,
  source_span      text,                -- supporting passage for grounding / "show source"
  prompt_direction prompt_direction not null default 'definition_to_term',

  review_status    review_status not null default 'pending',

  -- FSRS scheduling state (mirrors ts-fsrs Card)
  due            timestamptz not null default now(),
  stability      real not null default 0,
  difficulty     real not null default 0,
  elapsed_days   int  not null default 0,
  scheduled_days int  not null default 0,
  reps           int  not null default 0,
  lapses         int  not null default 0,
  fsrs_state     fsrs_state not null default 'new',
  last_review    timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cards_user_id_idx        on cards(user_id);
create index cards_collection_id_idx  on cards(collection_id);
create index cards_due_idx            on cards(user_id, due);            -- scheduled review queue
create index cards_review_status_idx  on cards(user_id, review_status);

-- generation_feedback (Tinder keep/edit/reject → metric B + taste-tuning) -----
create table generation_feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  card_id    uuid references cards(id) on delete set null,
  action     feedback_action not null,
  reason     text,                      -- "what was wrong" on reject
  before     jsonb,                     -- card content before an edit
  after      jsonb,                     -- card content after an edit
  created_at timestamptz not null default now()
);
create index generation_feedback_user_id_idx on generation_feedback(user_id);
create index generation_feedback_card_id_idx on generation_feedback(card_id);

-- study_reviews (FSRS grade log → metric A retention) -------------------------
create table study_reviews (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  card_id     uuid not null references cards(id) on delete cascade,
  grade       smallint not null check (grade between 1 and 4),  -- 1 Again .. 4 Easy
  mode        study_mode not null default 'scheduled',
  reviewed_at timestamptz not null default now()
);
create index study_reviews_card_id_idx on study_reviews(card_id);
create index study_reviews_user_id_idx on study_reviews(user_id);

-- updated_at triggers ---------------------------------------------------------
create trigger profiles_set_updated_at        before update on profiles        for each row execute function set_updated_at();
create trigger collections_set_updated_at     before update on collections     for each row execute function set_updated_at();
create trigger generation_jobs_set_updated_at before update on generation_jobs for each row execute function set_updated_at();
create trigger cards_set_updated_at           before update on cards           for each row execute function set_updated_at();

-- Row Level Security: owner-only on every table -------------------------------
alter table profiles            enable row level security;
alter table collections         enable row level security;
alter table sources             enable row level security;
alter table generation_jobs     enable row level security;
alter table cards               enable row level security;
alter table generation_feedback enable row level security;
alter table study_reviews       enable row level security;

create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

create policy "collections_owner"         on collections         for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sources_owner"             on sources             for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "generation_jobs_owner"     on generation_jobs     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "cards_owner"               on cards               for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "generation_feedback_owner" on generation_feedback for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "study_reviews_owner"       on study_reviews       for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Realtime for async job status updates ---------------------------------------
alter publication supabase_realtime add table generation_jobs;

-- Storage: private card-images bucket, owner-scoped by <user_id>/ path prefix --
insert into storage.buckets (id, name, public) values ('card-images', 'card-images', false)
  on conflict (id) do nothing;

create policy "card_images_select_own" on storage.objects for select
  using (bucket_id = 'card-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "card_images_insert_own" on storage.objects for insert
  with check (bucket_id = 'card-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "card_images_update_own" on storage.objects for update
  using (bucket_id = 'card-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "card_images_delete_own" on storage.objects for delete
  using (bucket_id = 'card-images' and (storage.foldername(name))[1] = auth.uid()::text);
