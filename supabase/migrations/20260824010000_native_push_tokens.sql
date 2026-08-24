create table native_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  environment text not null check (environment in ('development', 'production')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

create index native_push_tokens_user_id_idx on native_push_tokens(user_id);

create trigger native_push_tokens_set_updated_at
  before update on native_push_tokens
  for each row execute function set_updated_at();

alter table native_push_tokens enable row level security;

create policy "native_push_tokens_owner" on native_push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
