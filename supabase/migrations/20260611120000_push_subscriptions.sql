-- Push subscriptions + reminder preferences.
-- Retires the v1 stopgap that stored these in Supabase Auth user_metadata (see
-- lib/push/types.ts). First post-fan-out serialized schema change. Owner-only RLS,
-- matching every other table. Reminder prefs are 1:1 with the user, so they live as
-- columns on `profiles`; subscriptions are per-device, so they get their own table.

-- Per-device Web Push subscription (one row per browser/device a user registers) ----
create table push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  endpoint        text not null,                 -- the push service URL (unique per user)
  p256dh          text not null,                 -- subscription.keys.p256dh
  auth_key        text not null,                 -- subscription.keys.auth
  expiration_time bigint,                         -- PushSubscription.expirationTime (epoch ms), nullable
  created_at      timestamptz not null default now(),
  unique (user_id, endpoint)                      -- re-subscribing the same device upserts
);
create index push_subscriptions_user_id_idx on push_subscriptions(user_id);

-- Reminder preferences (1:1 with the user) ----------------------------------------
alter table profiles
  add column reminder_enabled      boolean not null default false,
  add column reminder_time         text    not null default '08:00',  -- "HH:MM" 24h, in reminder_tz
  add column reminder_tz           text    not null default 'UTC',    -- IANA zone
  add column reminder_last_sent_on date;                              -- once-per-local-day dedup guard

-- RLS: owner-only, like the rest of the schema -------------------------------------
alter table push_subscriptions enable row level security;
create policy "push_subscriptions_owner" on push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- NOTE: the reminder cron (lib/push/reminders.ts) runs with the service-role admin
-- client, which bypasses RLS — so it can read every user's prefs + subscriptions to
-- decide who to notify, and no extra policy is needed for it.
