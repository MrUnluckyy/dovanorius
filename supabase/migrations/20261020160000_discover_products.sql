-- discover_products + discover_page (T9 of dev-issue-discover-premium, 6.2-6.4).
--
-- Browse read inspo_products directly: 917 MB (255 MB of rows, the rest in 21
-- indexes) against ~280 MB of shared buffers, so the nightly import kept
-- pushing discover's pages out of cache and browse queries hit the 3 s anon
-- timeout. Offset pagination made deep pages slower still.
--
-- discover_products is a slim copy of only what discover shows (in stock,
-- giftable, with an image and a link, from 10 EUR) and only the columns a
-- card or filter needs, ~250k rows / ~110 MB. The import never writes to it,
-- so its hot pages stay hot. It is rebuilt after each import into a second
-- table and the view is repointed, so readers never wait on the rebuild.
--
-- discover_page() is the one read path, for web and app: keyset pagination
-- (a cursor instead of an offset), every browse filter and sort.
--
-- Later tickets slot in without changing the shape:
--   T7  merchant tiers: exclude tier D in rebuild, add the tier term to pos.
--   T11 variant groups: keep one row per group in rebuild.
--   T15 image check: exclude failed images in rebuild.

-- Two identical tables, A and B, behind a view. A rebuild fills the inactive
-- one and repoints the view. Swapping tables by RENAME does not work here:
-- discover_page and display_name are bound to the row type by OID, so they
-- would follow the renamed old table. The view keeps one row type for good.
create table if not exists public.discover_products_a (
  id text primary key,
  product_name text not null,
  brand_name text,
  merchant_name text,
  partner_id uuid,
  price numeric not null,
  rrp numeric,
  discount_pct numeric,
  image_url text not null,
  deep_link text not null,
  product_type text,
  gender text,
  audience text,
  season text,
  gift_score integer,
  -- Position in the recommended order (gift_score, then the random sort_key
  -- that rotates equally good items), precomputed so keyset paging on the
  -- default sort is a single integer comparison.
  pos integer not null
);
create table if not exists public.discover_products_b (like public.discover_products_a including all);

-- Which table the view serves. One row.
create table if not exists public.discover_products_state (
  only_row boolean primary key default true check (only_row),
  active char(1) not null default 'a' check (active in ('a', 'b')),
  rebuilt_at timestamptz,
  row_count integer
);
insert into public.discover_products_state (only_row) values (true) on conflict do nothing;

create or replace view public.discover_products as select * from public.discover_products_a;

-- Only reachable through discover_page (security definer); no API access.
alter table public.discover_products_a enable row level security;
alter table public.discover_products_b enable row level security;
alter table public.discover_products_state enable row level security;
revoke all on public.discover_products_a, public.discover_products_b,
  public.discover_products_state, public.discover_products from anon, authenticated;

-- Clean names, same rules as inspo_products.display_name (T6). Computed per
-- returned row rather than stored: storing it would add ~35 s to every rebuild.
create or replace function public.display_name(p public.discover_products)
returns text
language sql
stable
parallel safe
set search_path = public
as $$
  select public.clean_product_name(p.product_name, p.brand_name, p.merchant_name)
$$;
grant execute on function public.display_name(public.discover_products) to anon, authenticated;

/**
 * Rebuild discover_products from inspo_products. Called at the end of the
 * network import and the partner-feed sync. Fills the inactive table (indexes
 * dropped for the bulk load, rebuilt after), then repoints the view. Readers
 * keep using the active table throughout. Returns the number of rows.
 */
create or replace function public.rebuild_discover_products()
returns integer
language plpgsql
security definer
set search_path = public
set work_mem = '96MB'
set lock_timeout = '30s'
as $$
declare
  n integer;
  cur char(1);
  nxt char(1);
  t text;
begin
  -- One rebuild at a time: the import and the partner sync can overlap.
  perform pg_advisory_xact_lock(hashtext('rebuild_discover_products'));

  select active into cur from discover_products_state for update;
  nxt := case when cur = 'a' then 'b' else 'a' end;
  t := 'discover_products_' || nxt;

  execute format('truncate public.%I', t);
  -- Bulk load without secondary indexes, then build them once.
  execute format('drop index if exists public.%I, public.%I, public.%I, public.%I, public.%I, public.%I',
    t || '_pos', t || '_type_pos', t || '_brand_pos', t || '_merchant_pos', t || '_price', t || '_discount');

  execute format($q$
    insert into public.%I
      (id, product_name, brand_name, merchant_name, partner_id, price, rrp,
       discount_pct, image_url, deep_link, product_type, gender, audience, season,
       gift_score, pos)
    select id, product_name, brand_name, merchant_name, partner_id, price, rrp,
           discount_pct, image_url, deep_link, product_type, gender, audience, season,
           gift_score,
           row_number() over (order by gift_score desc nulls last, sort_key, id)::int
      from public.inspo_products
     where in_stock
       and giftable
       and image_url is not null
       and deep_link is not null
       and price >= 10
       -- T7: and coalesce(tier_override, merchant_tier, 'C') <> 'D'
       -- T15: and image_ok
       -- T11: one row per variant_group
  $q$, t);
  get diagnostics n = row_count;

  execute format('create unique index %I on public.%I (pos)', t || '_pos', t);
  execute format('create index %I on public.%I (product_type, pos)', t || '_type_pos', t);
  execute format('create index %I on public.%I (brand_name, pos)', t || '_brand_pos', t);
  execute format('create index %I on public.%I (merchant_name, pos)', t || '_merchant_pos', t);
  execute format('create index %I on public.%I (price, id)', t || '_price', t);
  execute format('create index %I on public.%I (discount_pct desc, id desc) where discount_pct > 0 and discount_pct <= 85', t || '_discount', t);
  execute format('analyze public.%I', t);

  -- An empty or collapsed build (a broken import) must not replace a good one.
  if n < 1000 then
    raise exception 'discover_products rebuild produced % rows; keeping the current table', n;
  end if;

  execute format('create or replace view public.discover_products as select * from public.%I', t);
  revoke all on public.discover_products from anon, authenticated;
  update discover_products_state set active = nxt, rebuilt_at = now(), row_count = n;

  -- Free the old copy's space now rather than holding two full copies.
  execute format('truncate public.%I', 'discover_products_' || cur);
  return n;
end;
$$;

revoke all on function public.rebuild_discover_products() from public, anon, authenticated;
grant execute on function public.rebuild_discover_products() to service_role;

/**
 * One page of discover products. Keyset pagination: pass back the cursor of
 * the last row you got (discover_cursor()) to get the next page; no offsets,
 * so page 50 costs what page 1 costs.
 *
 *   p_sort  recommended | price_asc | price_desc | discount
 *   p_cursor  recommended: "<pos>"; the rest: "<value>|<id>"
 *
 * Request display_name alongside: rpc('discover_page', ...).select('*, display_name').
 */
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
returns setof public.discover_products
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  lim int := least(greatest(coalesce(p_limit, 24), 1), 60);
  c_num numeric;
  c_id text;
begin
  if p_cursor is not null and position('|' in p_cursor) > 0 then
    c_num := nullif(split_part(p_cursor, '|', 1), '')::numeric;
    c_id := substr(p_cursor, position('|' in p_cursor) + 1);
  elsif p_cursor is not null then
    c_num := p_cursor::numeric;
  end if;

  -- One static query per sort, so each can use its own index.
  if p_sort = 'price_asc' then
    return query
      select d.* from discover_products d
       where (p_product_type is null or d.product_type = p_product_type)
         and (p_product_types is null or p_product_type is not null or d.product_type = any(p_product_types))
         and (p_audience is distinct from 'her' or d.gender is distinct from 'male')
         and (p_audience is distinct from 'him' or d.gender is distinct from 'female')
         and (p_brand is null or d.brand_name = p_brand)
         and (p_merchant is null or d.merchant_name = p_merchant)
         and (p_price_min is null or d.price >= p_price_min)
         and (p_price_max is null or d.price <= p_price_max)
         and (not coalesce(p_on_sale, false) or d.discount_pct > 0)
         and (p_hide_season is null or d.season is distinct from p_hide_season)
         and (c_id is null or (d.price, d.id) > (c_num, c_id))
       order by d.price, d.id
       limit lim;
  elsif p_sort = 'price_desc' then
    return query
      select d.* from discover_products d
       where (p_product_type is null or d.product_type = p_product_type)
         and (p_product_types is null or p_product_type is not null or d.product_type = any(p_product_types))
         and (p_audience is distinct from 'her' or d.gender is distinct from 'male')
         and (p_audience is distinct from 'him' or d.gender is distinct from 'female')
         and (p_brand is null or d.brand_name = p_brand)
         and (p_merchant is null or d.merchant_name = p_merchant)
         and (p_price_min is null or d.price >= p_price_min)
         and (p_price_max is null or d.price <= p_price_max)
         and (not coalesce(p_on_sale, false) or d.discount_pct > 0)
         and (p_hide_season is null or d.season is distinct from p_hide_season)
         and (c_id is null or (d.price, d.id) < (c_num, c_id))
       order by d.price desc, d.id desc
       limit lim;
  elsif p_sort = 'discount' then
    -- Capped at 85 %: above that it is almost always an rrp parsing glitch.
    return query
      select d.* from discover_products d
       where d.discount_pct > 0 and d.discount_pct <= 85
         and (p_product_type is null or d.product_type = p_product_type)
         and (p_product_types is null or p_product_type is not null or d.product_type = any(p_product_types))
         and (p_audience is distinct from 'her' or d.gender is distinct from 'male')
         and (p_audience is distinct from 'him' or d.gender is distinct from 'female')
         and (p_brand is null or d.brand_name = p_brand)
         and (p_merchant is null or d.merchant_name = p_merchant)
         and (p_price_min is null or d.price >= p_price_min)
         and (p_price_max is null or d.price <= p_price_max)
         and (p_hide_season is null or d.season is distinct from p_hide_season)
         and (c_id is null or (d.discount_pct, d.id) < (c_num, c_id))
       order by d.discount_pct desc, d.id desc
       limit lim;
  else
    return query
      select d.* from discover_products d
       where (p_product_type is null or d.product_type = p_product_type)
         and (p_product_types is null or p_product_type is not null or d.product_type = any(p_product_types))
         and (p_audience is distinct from 'her' or d.gender is distinct from 'male')
         and (p_audience is distinct from 'him' or d.gender is distinct from 'female')
         and (p_brand is null or d.brand_name = p_brand)
         and (p_merchant is null or d.merchant_name = p_merchant)
         and (p_price_min is null or d.price >= p_price_min)
         and (p_price_max is null or d.price <= p_price_max)
         and (not coalesce(p_on_sale, false) or d.discount_pct > 0)
         and (p_hide_season is null or d.season is distinct from p_hide_season)
         and (c_num is null or d.pos > c_num)
       order by d.pos
       limit lim;
  end if;
end;
$$;

revoke all on function public.discover_page(text, text[], text, text, text, numeric, numeric, boolean, text, text, text, integer) from public;
grant execute on function public.discover_page(text, text[], text, text, text, numeric, numeric, boolean, text, text, text, integer) to anon, authenticated;

-- Never used since stats began (0 scans), 40 MB the import has to maintain on
-- every write. The other browse indexes on inspo_products get a second look
-- once browse has run on discover_products for a while.
drop index if exists public.inspo_products_audience_type_giftscore_idx;
