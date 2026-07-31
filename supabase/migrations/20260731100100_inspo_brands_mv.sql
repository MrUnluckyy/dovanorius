-- Brand list for the discover brand filter. A live aggregate over ~566k rows was
-- ~14s and 500'd under the API statement timeout, so it's materialized.
-- REFRESH nightly after the feed import:
--   refresh materialized view concurrently public.inspo_brands_mv;
create materialized view if not exists public.inspo_brands_mv as
  select brand_name as brand, count(*)::bigint as n
  from public.inspo_products
  where in_stock
    and image_url is not null
    and deep_link is not null
    and price >= 10
    and brand_name is not null
  group by brand_name
  having count(*) >= 50
  order by count(*) desc;

-- Unique index enables REFRESH ... CONCURRENTLY (non-blocking refresh).
create unique index if not exists inspo_brands_mv_brand_idx
  on public.inspo_brands_mv (brand);

grant select on public.inspo_brands_mv to anon, authenticated;

-- Serve the cached list (fast) instead of recomputing per request.
create or replace function public.get_inspo_brands()
returns table(brand text, n bigint)
language sql
stable
as $$
  select brand, n from public.inspo_brands_mv order by n desc;
$$;

grant execute on function public.get_inspo_brands() to anon, authenticated;
