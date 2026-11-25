-- affiliate_transactions: sales from every affiliate network in one place, so
-- the admin "Pajamos" page replaces logging in to Awin, CJ and TradeDoubler.
--
-- Filled nightly by scripts/sync-affiliate-sales.ts, which re-pulls the last
-- 90 days: a sale moves pending -> approved/declined -> paid over weeks, so
-- rows are upserted in place on (network, tx_id).
--
-- click_ref is the sub id /out sends with every click (Awin clickref, CJ sid,
-- TradeDoubler epi) = affiliate_clicks.sub_id, which ties a sale to the wish,
-- Discover product or partner page that produced it.

create table if not exists public.affiliate_transactions (
  network          text not null check (network in ('awin', 'cj', 'tradedoubler')),
  tx_id            text not null,
  advertiser_id    text,
  advertiser_name  text,
  status           text not null check (status in ('pending', 'approved', 'declined', 'paid')),
  sale_amount      numeric(12, 2),
  commission       numeric(12, 2),
  currency         text,
  click_ref        text,
  clicked_at       timestamptz,
  transacted_at    timestamptz not null,
  validated_at     timestamptz,
  raw              jsonb not null,
  synced_at        timestamptz not null default now(),
  primary key (network, tx_id)
);

create index if not exists affiliate_transactions_transacted_idx
  on public.affiliate_transactions (transacted_at desc);
create index if not exists affiliate_transactions_click_ref_idx
  on public.affiliate_transactions (click_ref) where click_ref is not null;

-- Revenue data: service role only (the sync script and /admin pages).
alter table public.affiliate_transactions enable row level security;
revoke all on public.affiliate_transactions from anon, authenticated;

comment on table public.affiliate_transactions is
  'Affiliate network sales (Awin, CJ, TradeDoubler), synced nightly by scripts/sync-affiliate-sales.ts; click_ref = affiliate_clicks.sub_id. Service role only.';

-- The admin page joins each sale to its click by sub_id; make that an index hit.
create index if not exists affiliate_clicks_sub_id_idx
  on public.affiliate_clicks (sub_id) where sub_id is not null;

-- Clicks per merchant since a date, for the admin page: counting in SQL,
-- because the API returns at most 1,000 rows and a year of clicks is more.
create or replace function public.affiliate_click_counts(p_since timestamptz)
returns table (merchant_id uuid, clicks bigint)
language sql
stable
set search_path = public
as $function$
  select merchant_id, count(*)
    from affiliate_clicks
   where created_at >= p_since
   group by merchant_id
$function$;

revoke all on function public.affiliate_click_counts(timestamptz) from public, anon, authenticated;
