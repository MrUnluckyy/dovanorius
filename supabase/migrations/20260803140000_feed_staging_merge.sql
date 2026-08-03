-- Delta feed import via a staging table + server-side merge.
--
-- Replaces the previous "upsert every feed row" importer, which re-wrote ~600k
-- rows into a heavily-indexed table (GIN trigram on product_name) every night
-- and blew the statement/job timeouts. Now the importer bulk-loads the feed
-- into an unindexed staging table (cheap heap inserts) and calls
-- merge_feed_staging(), which writes only genuinely-changed rows.

-- Staging: mirrors the content columns of inspo_products with matching types so
-- the IS DISTINCT FROM comparisons in the merge are exact. No indexes / PK /
-- defaults on purpose — plain inserts are fast, which is the whole point.
create table if not exists public.inspo_products_staging (
  id            text not null,
  network       text not null,
  product_name  text,
  image_url     text,
  deep_link     text,
  price         numeric,
  rrp           numeric,
  currency      text,
  brand_name    text,
  category_name text,
  merchant_name text,
  merchant_id   text,
  in_stock      boolean,
  gender        text,
  season        text,
  product_type  text
);

-- RLS on with no policies: denies anon/authenticated entirely; service_role
-- (BYPASSRLS) still reads/writes. Keeps the internal staging table off the API.
alter table public.inspo_products_staging enable row level security;

grant all on table public.inspo_products_staging to service_role;

-- Truncate staging before a run (clears rows a crashed run left behind).
create or replace function public.reset_feed_staging()
returns void
language sql
security definer
set search_path = public
as $$
  truncate table public.inspo_products_staging;
$$;

-- Server-side delta merge: upsert only rows whose content actually changed, then
-- mark disappeared rows out of stock. Both steps are set-based and run in-DB, so
-- the expensive index maintenance touches only genuinely-changed rows.
create or replace function public.merge_feed_staging(p_network text)
returns table(changed integer, marked_out_of_stock integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changed integer;
  v_marked  integer;
begin
  insert into public.inspo_products as t (
    id, network, product_name, image_url, deep_link, price, rrp, currency,
    brand_name, category_name, merchant_name, merchant_id, in_stock, gender,
    season, product_type, synced_at
  )
  select
    s.id, s.network, s.product_name, s.image_url, s.deep_link, s.price, s.rrp,
    s.currency, s.brand_name, s.category_name, s.merchant_name, s.merchant_id,
    s.in_stock, s.gender, s.season, s.product_type, now()
  from public.inspo_products_staging s
  where s.network = p_network
  on conflict (id) do update set
    network       = excluded.network,
    product_name  = excluded.product_name,
    image_url     = excluded.image_url,
    deep_link     = excluded.deep_link,
    price         = excluded.price,
    rrp           = excluded.rrp,
    currency      = excluded.currency,
    brand_name    = excluded.brand_name,
    category_name = excluded.category_name,
    merchant_name = excluded.merchant_name,
    merchant_id   = excluded.merchant_id,
    in_stock      = excluded.in_stock,
    gender        = excluded.gender,
    season        = excluded.season,
    product_type  = excluded.product_type,
    synced_at     = excluded.synced_at
  where
       t.product_name  is distinct from excluded.product_name
    or t.image_url     is distinct from excluded.image_url
    or t.deep_link     is distinct from excluded.deep_link
    or t.price         is distinct from excluded.price
    or t.rrp           is distinct from excluded.rrp
    or t.currency      is distinct from excluded.currency
    or t.brand_name    is distinct from excluded.brand_name
    or t.category_name is distinct from excluded.category_name
    or t.merchant_name is distinct from excluded.merchant_name
    or t.merchant_id   is distinct from excluded.merchant_id
    or t.in_stock      is distinct from excluded.in_stock
    or t.gender        is distinct from excluded.gender
    or t.season        is distinct from excluded.season
    or t.product_type  is distinct from excluded.product_type;
  get diagnostics v_changed = row_count;

  -- Stale sweep: rows we had in stock, for a merchant present in this feed, that
  -- did not appear in staging → gone → out of stock. Scoped to seen merchants so
  -- a missing/failed feed never hides a whole merchant's catalogue.
  update public.inspo_products p
     set in_stock = false, synced_at = now()
   where p.network = p_network
     and p.in_stock
     and p.merchant_id in (
       select distinct s.merchant_id
       from public.inspo_products_staging s
       where s.network = p_network and s.merchant_id is not null
     )
     and not exists (
       select 1 from public.inspo_products_staging s where s.id = p.id
     );
  get diagnostics v_marked = row_count;

  changed := v_changed;
  marked_out_of_stock := v_marked;
  return next;
end;
$$;

grant execute on function public.reset_feed_staging() to service_role;
grant execute on function public.merge_feed_staging(text) to service_role;

notify pgrst, 'reload schema';
