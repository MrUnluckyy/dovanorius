-- discover_page returns display_name as a real column (follow-up to T9).
--
-- display_name(discover_products) was a PostgREST computed column on a view.
-- It worked right after the first publish, then disappeared from PostgREST's
-- schema cache on a later reload ("column discover_products.display_name does
-- not exist"); the view swap in every publish triggers such reloads. Rather
-- than depend on that, discover_page computes the clean name itself for the
-- rows it returns (at most 60, so the cost is nothing) and returns it as an
-- ordinary column: callers just select("*").

alter function public.discover_page(text, text[], text, text, text, numeric, numeric, boolean, text, text, text, integer)
  rename to discover_page_rows;
revoke all on function public.discover_page_rows(text, text[], text, text, text, numeric, numeric, boolean, text, text, text, integer)
  from public, anon, authenticated;

drop function if exists public.display_name(public.discover_products);

create or replace function public.discover_page(
  p_product_type text default null,
  p_product_types text[] default null,
  p_audience text default null,
  p_brand text default null,
  p_merchant text default null,
  p_price_min numeric default null,
  p_price_max numeric default null,
  p_on_sale boolean default false,
  p_hide_season text default null,
  p_sort text default 'recommended',
  p_cursor text default null,
  p_limit integer default 24
)
returns table (
  id text,
  product_name text,
  display_name text,
  brand_name text,
  merchant_name text,
  partner_id uuid,
  price numeric,
  rrp numeric,
  discount_pct numeric,
  image_url text,
  deep_link text,
  product_type text,
  gender text,
  audience text,
  season text,
  gift_score integer,
  pos integer
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.product_name,
         public.clean_product_name(r.product_name, r.brand_name, r.merchant_name),
         r.brand_name, r.merchant_name, r.partner_id, r.price, r.rrp, r.discount_pct,
         r.image_url, r.deep_link, r.product_type, r.gender, r.audience, r.season,
         r.gift_score, r.pos
    from public.discover_page_rows(
           p_product_type, p_product_types, p_audience, p_brand, p_merchant,
           p_price_min, p_price_max, p_on_sale, p_hide_season, p_sort, p_cursor, p_limit
         ) with ordinality as r
   order by r.ordinality
$$;

revoke all on function public.discover_page(text, text[], text, text, text, numeric, numeric, boolean, text, text, text, integer) from public;
grant execute on function public.discover_page(text, text[], text, text, text, numeric, numeric, boolean, text, text, text, integer) to anon, authenticated;
