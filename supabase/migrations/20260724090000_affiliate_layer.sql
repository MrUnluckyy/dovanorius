-- Affiliate layer (Phase 1): merchant registry + click attribution.
--
-- NOT YET APPLIED. Review, then run against production.
--
-- Adds the two tables the click-time affiliate rewrite needs:
--
--   affiliate_merchants — hostname → network/deeplink template lookup. The
--     /out redirect resolves the outbound URL's host against `domains`, then
--     builds a tracked deeplink from `deeplink_template`.
--
--   affiliate_clicks — one row per outbound click, for first-party attribution
--     and reconciliation against network payout reports (via `sub_id`).
--
-- RLS mirrors 20260723120000_fix_permissive_rls: public may read only active
-- merchants; all writes and every click row are service-role only (the /out
-- route uses supabaseAdmin, which bypasses RLS).

begin;

-- ---------------------------------------------------------------------------
-- affiliate_merchants
-- ---------------------------------------------------------------------------
create table if not exists public.affiliate_merchants (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  -- Hostnames this merchant owns, e.g. {zara.com, www.zara.com}. Matched
  -- against the outbound URL host (host and its registrable-domain suffix).
  domains               text[] not null default '{}',
  network               text not null default 'direct'
                          check (network in ('awin','tradedoubler','sovrn','direct')),
  -- Advertiser/program id within the network (e.g. Awin `awinmid`). Publisher
  -- ids live in env, not here.
  network_advertiser_id text,
  -- Template with placeholders substituted at click time:
  --   {URL} url-encoded target, {RAW_URL} raw target, {ADVERTISER_ID},
  --   {PUBLISHER_ID}, {SUB_ID}, {SOVRN_KEY}.
  deeplink_template     text,
  commission_rate       numeric(5,2),
  is_allowlisted        boolean not null default false,
  quality_tier          int not null default 0,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Fast host lookup: GIN over the domains array (contains queries).
create index if not exists affiliate_merchants_domains_idx
  on public.affiliate_merchants using gin (domains);

alter table public.affiliate_merchants enable row level security;

-- Public may read only active merchants; writes are service-role only (no
-- write policy → RLS denies for anon/authenticated, service role bypasses).
create policy "public can read active affiliate merchants"
  on public.affiliate_merchants for select to public
  using (is_active);

-- ---------------------------------------------------------------------------
-- affiliate_clicks
-- ---------------------------------------------------------------------------
create table if not exists public.affiliate_clicks (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid references public.items(id) on delete set null,
  user_id     uuid references auth.users(id) on delete set null,
  merchant_id uuid references public.affiliate_merchants(id) on delete set null,
  target_url  text not null,
  sub_id      text,
  created_at  timestamptz not null default now()
);

create index if not exists affiliate_clicks_merchant_idx
  on public.affiliate_clicks (merchant_id, created_at desc);

-- RLS on, no policies: only the service role (supabaseAdmin) can read or write.
alter table public.affiliate_clicks enable row level security;

commit;
