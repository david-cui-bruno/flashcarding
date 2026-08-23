-- Subscription entitlement scaffolding for Dory Pro.
-- Client sessions may read their entitlement, but only service-role/server-side code
-- should change plan columns. Column privileges below keep owner RLS from becoming
-- client-writable for plan state.

alter table profiles
  add column plan text not null default 'free' check (plan in ('free', 'pro')),
  add column plan_expires_at timestamptz,
  add column plan_source text check (plan_source in ('revenuecat', 'comp'));

revoke update (plan, plan_expires_at, plan_source) on profiles from anon, authenticated;

-- Keep existing demo and owner accounts working until real StoreKit/RevenueCat wiring.
-- The owner match covers the seeded/local username conventions used in this project.
update profiles
set plan = 'pro',
    plan_expires_at = null,
    plan_source = 'comp'
where username in ('demo', 'david', 'davidcui824', 'bruno');
