-- Recipient type priority for discover grids, and sportswear out of 'sport'.
--
-- After 20261113100000 every grid is one global round-robin over product
-- types, so pages that differ by a type or two ("Dovanos mamai", "Dovanos
-- draugei", "Dovanos moteriai") showed the same first products: 18 of 24
-- shared. A recipient page can now pull its own types forward: those types
-- get a two-round head start (mom: home, kitchen, garden; a friend: beauty,
-- accessories), so each page opens on what it is about.
--
-- discover_products gets `round` (the type round-robin round, as used for
-- pos); discover_page takes p_boost_types and returns `sort_k`, the boosted
-- round, for the keyset cursor "sort_k|pos". Without p_boost_types nothing
-- changes: order and cursor are pos, as before.

-- ---------------------------------------------------------------------------
-- 1. Sportswear is clothing: "Dviratininkų šortai", tamprės, leggings,
--    maikutės, kombinezonai were filed as 'sport' (by "dvirat") and led the
--    women's grids.

create or replace function public.classify_by_title(p_category text, p_name text)
returns text
language sql
immutable
as $function$
  select case
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(kvepal|parfum|perfume|eau de (parfum|toilette|cologne)|tualetinis vanduo|lūp[ųu] daž|makiaž|kremas|kremai|veido|veidui|plauk[ųu]|kosmetik|fragrance|health & beauty|skin care)' then 'beauty'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(bat[aųiø]|batel|pusbač|pusbac|sneaker|krosov|aulini|sandal|šlepet|slepet|loafer|mokasin|shoe|boot|kedai|espadril|basut|sportbač)' then 'shoes'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(rankin|kuprin|krepšy|krepsy|pinigin|backpack|wallet|handbag|lagamin|dėklas|deklas)' then 'bag'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(suknel|kelnės|kelnes|džins|dzins|striuk|palaidin|marškin|marskin|megztin|sijon|liemenėl|\mpaltas\M|švark|svark|kostium|džemper|dzemper|dress|shirt|jean|jacket|coat|sweater|trouser|\mskirts?\M|kardigan|šort|\msortai\M|tampr[ėe]s|tampri[ųu]|leging|legging|maikut|kombinezon)' then 'clothing'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(kepur|šalik|salik|pirštin|pirstin)' then 'accessory'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(žaisl|zaisl|lego|konstruktor|lėl[ėe]|stalo žaidim|stalo zaidim|\mdėlion|\mdelion|pliušin|pliusin|puzzle)' then 'toys'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(ausin[ėe]|kolon[ėe]l|išmanus|ismanus|išmanieji|planšet|planset|telefon|kompiuter|nešiojam|nesiojam|monitor|klaviatūr|klaviatur|konsol|playstation|xbox|fotoaparat|\mkamer(a|os|ą|ų|u)?\M|vaizdo kamer|\mdron(as|ai|ų|u|ui|o|e|es)\M|\mdrones?\M|smartwatch)' then 'tech'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(virtuv[ėe]s ir stalo|puod(as|ai|ų|u)|keptuv|kavos aparat|kavamal|arbatin|taur[ėe]s|indų|stalo įrank|stalo irank|prieskoni|trintuv|virdul)' then 'kitchen'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(įrank|irank|gręžtuv|greztuv|atsuktuv|plaktuk|pjūkl|pjukl|suktuv|dirbtuv|proxxon|makita)' then 'tools'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(sporto prek|sprto prek|dvirat|riedut|riedlent|turizm|žygio|zygio|palapin|miegmaiš|miegmais|treniruokl|joga|fitnes|žvejyb|zvejyb|slidin)' then 'sport'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(gyvūn|gyvun|šuni|suni|katė|naguči|pašar|pasar)' then 'pets'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(sodo prek|sodinin|gėli[ųu]|geli[uu]|vazon|grilis|kepsnin)' then 'garden'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(žvak|zvak|vaz[ao]|namų interjer|namu interjer|pled|paveiksl|dekor|šviestuv|sviestuv|sieninis laikrod)' then 'home'
    when coalesce(p_category,'') || ' ' || coalesce(p_name,'') ~* '(laikrod|kepur|šalik|salik|pirštin|pirstin|dirž|dirz|kaklaraišt|akini|papuoš|papuos|apyrank|grandin[ėe]l|auskar|žied(as|ai|ą))' then 'accessory'
    else 'other'
  end;
$function$;

-- ---------------------------------------------------------------------------
-- 2. discover_products.round

alter table public.discover_products_a add column if not exists round integer;
alter table public.discover_products_b add column if not exists round integer;

do $$
declare cur char(1);
begin
  select active into cur from public.discover_products_state where only_row;
  execute format('create or replace view public.discover_products as select * from public.discover_products_%s', cur);
  revoke all on public.discover_products from anon, authenticated;
end $$;

create or replace function public.discover_products_load()
returns integer
language plpgsql
security definer
set search_path to 'public'
set work_mem to '96MB'
set lock_timeout to '30s'
as $function$
declare
  n integer;
  cur char(1);
  t text;
begin
  perform pg_advisory_xact_lock(hashtext('rebuild_discover_products'));
  select active into cur from discover_products_state where only_row for update;
  t := 'discover_products_' || case when cur = 'a' then 'b' else 'a' end;

  execute format('truncate public.%I', t);
  execute format('drop index if exists public.%I, public.%I, public.%I, public.%I, public.%I, public.%I, public.%I',
    t || '_pos', t || '_type_pos', t || '_brand_pos', t || '_merchant_pos', t || '_price', t || '_discount', t || '_age_type_pos');

  execute format($q$
    insert into public.%I
      (id, product_name, brand_name, merchant_name, partner_id, price, rrp,
       discount_pct, image_url, deep_link, product_type, gender, audience, season,
       gift_score, pos, round)
    with base as (
      select p.*,
             coalesce(nullif(p.dedupe_key, ''), public.product_dedupe_key(p.brand_name, p.product_name), p.id) as dkey
        from public.inspo_products p
       where p.in_stock
         and p.giftable
         and p.image_url is not null
         and p.deep_link is not null
         and p.price >= 10
    ),
    dedup as (
      select b.*, row_number() over (partition by dkey order by price, gift_score desc nulls last, id) as dup_rank
        from base b
    ),
    by_brand as (
      select d.*,
             row_number() over (
               partition by product_type, lower(coalesce(brand_name, ''))
               order by gift_score desc nulls last, sort_key, id) as brand_rank,
             row_number() over (
               partition by product_type, coalesce(category_name, '')
               order by gift_score desc nulls last, sort_key, id) as cat_rank
        from dedup d
       where dup_rank = 1
    ),
    by_type as (
      select b.*,
             (row_number() over (
               partition by product_type
               order by greatest(brand_rank, cat_rank), gift_score desc nulls last, sort_key, id)
              * case when product_type = 'other' then 4 else 1 end)::int as rnd
        from by_brand b
    )
    select id, product_name, brand_name, merchant_name, partner_id, price, rrp,
           discount_pct, image_url, deep_link, product_type, gender, audience, season,
           gift_score,
           row_number() over (order by rnd, gift_score desc nulls last, sort_key, id)::int,
           rnd
      from by_type
  $q$, t);
  get diagnostics n = row_count;

  update discover_products_state
     set building = case when cur = 'a' then 'b' else 'a' end, building_rows = n
   where only_row;
  return n;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 3. discover_page_rows / discover_page: p_boost_types. The signature
--    changes, so drop and recreate (callers pass named arguments; the new one
--    has a default).

drop function if exists public.discover_page(text, text[], text, text, text, numeric, numeric, boolean, text, text, text, integer, text);
drop function if exists public.discover_page_rows(text, text[], text, text, text, numeric, numeric, boolean, text, text, text, integer, text);

create function public.discover_page_rows(
  p_product_type text DEFAULT NULL::text, p_product_types text[] DEFAULT NULL::text[],
  p_audience text DEFAULT NULL::text, p_brand text DEFAULT NULL::text, p_merchant text DEFAULT NULL::text,
  p_price_min numeric DEFAULT NULL::numeric, p_price_max numeric DEFAULT NULL::numeric,
  p_on_sale boolean DEFAULT false, p_hide_season text DEFAULT NULL::text,
  p_sort text DEFAULT 'recommended'::text, p_cursor text DEFAULT NULL::text, p_limit integer DEFAULT 24,
  p_age_group text DEFAULT NULL::text, p_boost_types text[] DEFAULT NULL::text[])
returns setof discover_products
language plpgsql
stable security definer
set search_path to 'public'
as $function$
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
  elsif p_boost_types is not null and p_product_type is null then
    -- Recommended with a recipient's priority: its types two rounds early.
    -- Cursor "sort_k|pos"; within one sort_k, pos keeps the global order.
    return query
      select d.* from discover_products d
       where (p_product_types is null or d.product_type = any(p_product_types))
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
         and (c_id is null
              or (coalesce(d.round, d.pos) - case when d.product_type = any(p_boost_types) then 2 else 0 end, d.pos)
                 > (c_num, c_id::int))
       order by coalesce(d.round, d.pos) - case when d.product_type = any(p_boost_types) then 2 else 0 end, d.pos
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
$function$;

create function public.discover_page(
  p_product_type text DEFAULT NULL::text, p_product_types text[] DEFAULT NULL::text[],
  p_audience text DEFAULT NULL::text, p_brand text DEFAULT NULL::text, p_merchant text DEFAULT NULL::text,
  p_price_min numeric DEFAULT NULL::numeric, p_price_max numeric DEFAULT NULL::numeric,
  p_on_sale boolean DEFAULT false, p_hide_season text DEFAULT NULL::text,
  p_sort text DEFAULT 'recommended'::text, p_cursor text DEFAULT NULL::text, p_limit integer DEFAULT 24,
  p_age_group text DEFAULT NULL::text, p_boost_types text[] DEFAULT NULL::text[])
returns table(id text, product_name text, display_name text, brand_name text, merchant_name text,
              partner_id uuid, price numeric, rrp numeric, discount_pct numeric, image_url text,
              deep_link text, product_type text, gender text, audience text, season text,
              gift_score integer, pos integer, sort_k integer)
language sql
stable security definer
set search_path to 'public'
as $function$
  select r.id, r.product_name,
         public.clean_product_name(r.product_name, r.brand_name, r.merchant_name),
         r.brand_name, r.merchant_name, r.partner_id, r.price, r.rrp, r.discount_pct,
         r.image_url, r.deep_link, r.product_type, r.gender, r.audience, r.season,
         r.gift_score, r.pos,
         -- The boosted round, for the "sort_k|pos" cursor; null when unboosted.
         case when p_boost_types is not null and p_product_type is null
                and coalesce(p_sort, 'recommended') not in ('price_asc', 'price_desc', 'discount')
              then (coalesce(r.round, r.pos) - case when r.product_type = any(p_boost_types) then 2 else 0 end)::int
         end
    from public.discover_page_rows(
           p_product_type, p_product_types, p_audience, p_brand, p_merchant,
           p_price_min, p_price_max, p_on_sale, p_hide_season, p_sort, p_cursor, p_limit,
           p_age_group, p_boost_types
         ) with ordinality as r
   order by r.ordinality
$function$;

revoke all on function public.discover_page_rows(text, text[], text, text, text, numeric, numeric, boolean, text, text, text, integer, text, text[]) from public, anon, authenticated;
grant execute on function public.discover_page(text, text[], text, text, text, numeric, numeric, boolean, text, text, text, integer, text, text[]) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Re-derive the sportswear rows; then rebuild discover_products separately
--    (select discover_products_load(); select discover_products_publish();).

update public.inspo_products
   set product_name = product_name
 where product_type in ('sport', 'other', 'accessory', 'toys')
   and search_norm ~ '(sort|tampr|leging|legging|maikut|kombinezon)';
