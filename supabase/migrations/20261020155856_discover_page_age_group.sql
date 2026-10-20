-- Age group on discover_page (follow-up to T9).
--
-- Recipient pages filtered by category and gender but not by age, so
-- "Vaikui > Drabužiai" showed adult clothing and "Moteriai > Drabužiai" could
-- show girls' dresses. discover_products carries the feed's audience
-- (adult / kid / teen; babies are kid), so discover_page takes p_age_group:
--
--   kid    kid products only (Vaikui, Kūdikiui)
--   teen   teen clothing, shoes and sport, plus adult products in every other
--          category: teen tech or beauty is classified adult, and those are
--          exactly the teen gifts (Paaugliui)
--   adult  adult products only (Moteriai, Vyrui, Sau, Porai, ...)
--   null   no filter (Namams, browse)
--
-- PostgREST resolves RPCs by argument names, so both functions are recreated
-- with the new parameter rather than overloaded.

drop function if exists public.discover_page(text, text[], text, text, text, numeric, numeric, boolean, text, text, text, integer);
drop function if exists public.discover_page_rows(text, text[], text, text, text, numeric, numeric, boolean, text, text, text, integer);

create function public.discover_page_rows(
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
  p_limit integer default 24,
  p_age_group text default null
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
         and (p_age_group is null
              or (p_age_group = 'kid' and d.audience = 'kid')
              or (p_age_group = 'adult' and d.audience = 'adult')
              or (p_age_group = 'teen' and (d.audience = 'teen'
                    or (d.audience = 'adult' and d.product_type not in ('clothing', 'shoes', 'sport')))))
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
         and (p_age_group is null
              or (p_age_group = 'kid' and d.audience = 'kid')
              or (p_age_group = 'adult' and d.audience = 'adult')
              or (p_age_group = 'teen' and (d.audience = 'teen'
                    or (d.audience = 'adult' and d.product_type not in ('clothing', 'shoes', 'sport')))))
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
         and (p_age_group is null
              or (p_age_group = 'kid' and d.audience = 'kid')
              or (p_age_group = 'adult' and d.audience = 'adult')
              or (p_age_group = 'teen' and (d.audience = 'teen'
                    or (d.audience = 'adult' and d.product_type not in ('clothing', 'shoes', 'sport')))))
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
         and (p_age_group is null
              or (p_age_group = 'kid' and d.audience = 'kid')
              or (p_age_group = 'adult' and d.audience = 'adult')
              or (p_age_group = 'teen' and (d.audience = 'teen'
                    or (d.audience = 'adult' and d.product_type not in ('clothing', 'shoes', 'sport')))))
         and (c_num is null or d.pos > c_num)
       order by d.pos
       limit lim;
  end if;
end;
$$;

revoke all on function public.discover_page_rows(text, text[], text, text, text, numeric, numeric, boolean, text, text, text, integer, text) from public, anon, authenticated;

create function public.discover_page(
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
  p_limit integer default 24,
  p_age_group text default null
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
           p_price_min, p_price_max, p_on_sale, p_hide_season, p_sort, p_cursor, p_limit,
           p_age_group
         ) with ordinality as r
   order by r.ordinality
$$;

revoke all on function public.discover_page(text, text[], text, text, text, numeric, numeric, boolean, text, text, text, integer, text) from public;
grant execute on function public.discover_page(text, text[], text, text, text, numeric, numeric, boolean, text, text, text, integer, text) to anon, authenticated;

-- Kid and teen pages filter a few percent of the table; give them an index,
-- in every future build and on both tables now.
create or replace function public.discover_products_load()
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
  t text;
begin
  perform pg_advisory_xact_lock(hashtext('rebuild_discover_products'));
  select active into cur from discover_products_state where only_row for update;
  t := 'discover_products_' || case when cur = 'a' then 'b' else 'a' end;

  execute format('truncate public.%I', t);
  -- Bulk load without secondary indexes; publish builds them once.
  execute format('drop index if exists public.%I, public.%I, public.%I, public.%I, public.%I, public.%I, public.%I',
    t || '_pos', t || '_type_pos', t || '_brand_pos', t || '_merchant_pos', t || '_price', t || '_discount', t || '_age_type_pos');

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

  update discover_products_state
     set building = case when cur = 'a' then 'b' else 'a' end, building_rows = n
   where only_row;
  return n;
end;
$$;

create or replace function public.discover_products_publish()
returns integer
language plpgsql
security definer
set search_path = public
set work_mem = '96MB'
set maintenance_work_mem = '128MB'
set lock_timeout = '30s'
as $$
declare
  cur char(1);
  nxt char(1);
  n integer;
  t text;
begin
  perform pg_advisory_xact_lock(hashtext('rebuild_discover_products'));
  select active, building, building_rows into cur, nxt, n
    from discover_products_state where only_row for update;
  if nxt is null then
    raise exception 'discover_products_publish: nothing loaded (run discover_products_load first)';
  end if;
  -- An empty or collapsed build (a broken import) must not replace a good one.
  if n < 1000 then
    raise exception 'discover_products rebuild produced % rows; keeping the current table', n;
  end if;
  t := 'discover_products_' || nxt;

  execute format('create unique index %I on public.%I (pos)', t || '_pos', t);
  execute format('create index %I on public.%I (product_type, pos)', t || '_type_pos', t);
  execute format('create index %I on public.%I (brand_name, pos)', t || '_brand_pos', t);
  execute format('create index %I on public.%I (merchant_name, pos)', t || '_merchant_pos', t);
  execute format('create index %I on public.%I (price, id)', t || '_price', t);
  execute format('create index %I on public.%I (discount_pct desc, id desc) where discount_pct > 0 and discount_pct <= 85', t || '_discount', t);
  execute format('create index %I on public.%I (audience, product_type, pos)', t || '_age_type_pos', t);
  execute format('analyze public.%I', t);

  execute format('create or replace view public.discover_products as select * from public.%I', t);
  revoke all on public.discover_products from anon, authenticated;
  update discover_products_state
     set active = nxt, building = null, building_rows = null, rebuilt_at = now(), row_count = n
   where only_row;

  -- Free the old copy's space now rather than holding two full copies.
  execute format('truncate public.%I', 'discover_products_' || cur);
  return n;
end;
$$;

create index if not exists discover_products_a_age_type_pos on public.discover_products_a (audience, product_type, pos);
create index if not exists discover_products_b_age_type_pos on public.discover_products_b (audience, product_type, pos);
