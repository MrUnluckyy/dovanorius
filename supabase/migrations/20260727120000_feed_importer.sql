-- Feed importer support: multi-network provenance + discount surfacing.
--
-- NOT YET APPLIED. Review, then run against production.
--
-- The rebuilt product-feed importer (lib/feeds/*) upserts into inspo_products
-- keyed on the existing text `id` (the network's own product id). These columns
-- let a single table hold products from more than one affiliate network and let
-- the discover feed surface markdowns:
--
--   network      — which affiliate network the row came from. Existing rows are
--                  all AWIN, so the default backfills them correctly.
--   rrp          — recommended retail / "was" price from the feed. Only stored
--                  when the feed provides one above the selling price.
--   discount_pct — derived, always in sync with price/rrp. null when not on sale.

begin;

alter table public.inspo_products
  add column if not exists network text not null default 'awin'
    check (network in ('awin', 'tradedoubler')),
  add column if not exists rrp numeric,
  add column if not exists discount_pct numeric
    generated always as (
      case
        when rrp is not null and price is not null and rrp > price and rrp > 0
          then round(((rrp - price) / rrp) * 100)
      end
    ) stored;

-- "Deals" sorting/filtering: only index rows that are actually discounted.
create index if not exists inspo_products_discount_idx
  on public.inspo_products (discount_pct desc)
  where discount_pct is not null;

create index if not exists inspo_products_network_idx
  on public.inspo_products (network);

commit;
