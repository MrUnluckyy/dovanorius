-- Two /discover reads that 500'd on 2026-10-14 with "canceling statement due to
-- statement timeout" (anon's limit is 3s). Both are fast when the table is in
-- cache and seconds when it isn't, and on this instance it often isn't.

-- ---------------------------------------------------------------------------
-- 1. Brand filter inside a category
-- ---------------------------------------------------------------------------
-- get_inspo_brands_for_type counted brands live: every row of the category
-- (tens of thousands for clothing or accessory) read from the heap per call.
-- The unscoped list got the same treatment in 20260731100100 for the same
-- reason; this is its per-category twin. Same filter and threshold as the
-- function it replaces, so the list a shopper sees does not change.
create materialized view if not exists public.inspo_type_brands_mv as
  select product_type, brand_name as brand, count(*)::bigint as n
  from public.inspo_products
  where giftable and in_stock
    and product_type is not null
    and brand_name is not null and brand_name <> ''
    and image_url is not null and deep_link is not null
  group by product_type, brand_name
  having count(*) >= 5;

create unique index if not exists inspo_type_brands_mv_key
  on public.inspo_type_brands_mv (product_type, brand);

grant select on public.inspo_type_brands_mv to anon, authenticated;

-- Same signature as before, so web and noriuto-app need no change.
create or replace function public.get_inspo_brands_for_type(p_product_type text)
returns table(brand text, n bigint)
language sql stable security definer set search_path = public as $$
  select brand, n from public.inspo_type_brands_mv
  where product_type = p_product_type
  order by n desc, brand
  limit 300;
$$;

-- The nightly import already calls this at the end; it now rebuilds both.
create or replace function public.refresh_inspo_brands()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  refresh materialized view public.inspo_brands_mv;
  refresh materialized view public.inspo_type_brands_mv;
  select count(*) into n from public.inspo_brands_mv;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. "Cheapest first" inside a category
-- ---------------------------------------------------------------------------
-- Sorting by price within a category walked inspo_products_price_id_idx — every
-- in-stock product in price order — and threw away the other categories one
-- heap row at a time (2,212 rows read for 24 accessories). Leading with
-- product_type makes it read only the rows it returns.
create index if not exists inspo_products_type_price_idx
  on public.inspo_products (product_type, price, id)
  where giftable and in_stock;

notify pgrst, 'reload schema';
