-- Gift recommendation engine: cached taste profiles + recommendation cache.
--
-- APPLIED to prod 2026-07-24 via Supabase MCP.
--
-- Both are server-managed key stores (RLS on, no policies → service-role only,
-- like affiliate_clicks). The LLM only runs to (re)fill these, so steady-state
-- cost per active user is ~zero.

-- One inferred taste profile per user; re-inferred only when signals_hash changes.
create table if not exists public.user_taste_profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  profile      jsonb not null,     -- {summary,interests[],categories[],brands[],price_min,price_max,gender,life_context[]}
  signals_hash text not null,      -- sha256 of the inputs; skip re-inference when unchanged
  model        text not null,
  updated_at   timestamptz not null default now()
);
alter table public.user_taste_profiles enable row level security;

-- Cached gift picks per (subject, occasion), tied to the profile version + TTL.
create table if not exists public.gift_recommendations (
  id              uuid primary key default gen_random_uuid(),
  subject_user_id uuid not null references auth.users(id) on delete cascade,
  occasion        text not null default 'any',
  recommendations jsonb not null,  -- [{product_id,title,price,image_url,deep_link,reason}]
  profile_hash    text not null,   -- ties the cache entry to the taste-profile version
  model           text not null,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null
);
create index if not exists gift_recommendations_lookup_idx
  on public.gift_recommendations (subject_user_id, occasion, expires_at desc);
alter table public.gift_recommendations enable row level security;
