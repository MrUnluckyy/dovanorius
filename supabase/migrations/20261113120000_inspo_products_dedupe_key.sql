-- inspo_products.dedupe_key: computed once per row at import, not on every
-- discover_products rebuild.
--
-- 20261113100000 made discover_products_load build the key for all ~262k rows
-- every night (split the name into words, sort, join). The load went from a
-- few seconds to ~73 s, and the importer calls it under the 120 s
-- service_role statement timeout, retrying on failure. Moving the key into the
-- derive trigger costs a few ms per imported row and brings the load back
-- down.
--
-- Backfill runs separately, in batches with app.skip_derive = 'on' so the rest
-- of the derive trigger doesn't run again for 290k rows:
--   set app.skip_derive = 'on';
--   update inspo_products set dedupe_key = product_dedupe_key(brand_name, product_name)
--    where id in (select id from inspo_products where dedupe_key is null limit 20000);

-- Brand + the name's distinct words, sorted, minus the brand's own words:
-- "Rankinė Liu Jo AA6176 E1012 Ruda" and "Liu Jo Rankinė AA6176 E1012 Ruda"
-- are one product. Colour stays in the name, so colours stay apart.
create or replace function public.product_dedupe_key(p_brand text, p_name text)
returns text
language sql
immutable
set search_path = public
as $function$
  select lower(coalesce(p_brand, '')) || '|' || coalesce((
    select string_agg(distinct w, ' ' order by w)
      from regexp_split_to_table(lower(public.nr_unaccent(coalesce(p_name, ''))), '[^a-z0-9]+') w
     where length(w) > 1
       and position(w in lower(public.nr_unaccent(coalesce(p_brand, '')))) = 0
  ), '')
$function$;

alter table public.inspo_products add column if not exists dedupe_key text;

create or replace function public.inspo_products_derive()
returns trigger
language plpgsql
as $function$
begin
  if coalesce(current_setting('app.skip_derive', true), '') = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT'
     and public.is_age_restricted(new.category_name, new.product_name, new.brand_name) then
    return null;
  end if;

  new.product_type := public.classify_product_type(
    new.category_name, new.product_name, new.merchant_name);
  new.giftable     := public.is_giftable(new.category_name, new.product_name);

  new.audience := public.classify_audience(
    new.category_name, new.product_name, new.merchant_name, new.suitable_for);

  if new.audience in ('kid', 'teen') and new.gender is null then
    new.gender := public.classify_kid_gender(new.category_name, new.product_name);
  end if;

  new.search_norm := lower(public.nr_unaccent(
    concat_ws(' ', new.product_name, new.brand_name, new.category_name)));

  new.dedupe_key := public.product_dedupe_key(new.brand_name, new.product_name);

  new.gift_score := public.compute_gift_score(
    new.brand_name, new.product_type, new.price, new.discount_pct,
    new.product_name, new.gender, new.rrp);

  return new;
end;
$function$;

-- The load reads the stored key; a row not backfilled yet (null) falls back
-- to computing it, so the rebuild is right during and after the backfill.
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
       gift_score, pos)
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
      select b.*, row_number() over (
               partition by product_type
               order by greatest(brand_rank, cat_rank), gift_score desc nulls last, sort_key, id) as type_rank
        from by_brand b
    )
    select id, product_name, brand_name, merchant_name, partner_id, price, rrp,
           discount_pct, image_url, deep_link, product_type, gender, audience, season,
           gift_score,
           row_number() over (
             order by type_rank * case when product_type = 'other' then 4 else 1 end,
                      gift_score desc nulls last, sort_key, id)::int
      from by_type
  $q$, t);
  get diagnostics n = row_count;

  update discover_products_state
     set building = case when cur = 'a' then 'b' else 'a' end, building_rows = n
   where only_row;
  return n;
end;
$function$;
