-- Batched merge. The single-statement merge_feed_staging had to heap-fetch every
-- existing row to compare (IS DISTINCT FROM), which blew the 120s statement
-- timeout on ~560k rows. Split into client-driven id-range batches (each a
-- bounded statement) plus a standalone sweep run once at the end.

-- Upsert the next p_batch staging rows (by id > p_after). Writes only rows whose
-- content changed. Returns the last id processed (keyset cursor), the batch size,
-- and how many rows actually changed.
create or replace function public.merge_feed_staging_range(
  p_network text,
  p_after   text,
  p_batch   integer
)
returns table(last_id text, processed integer, changed integer)
language sql
security definer
set search_path = public
as $$
  with batch as (
    select distinct on (id) *
    from public.inspo_products_staging
    where network = p_network and id > p_after
    order by id
    limit p_batch
  ),
  ins as (
    insert into public.inspo_products as t (
      id, network, product_name, image_url, deep_link, price, rrp, currency,
      brand_name, category_name, merchant_name, merchant_id, in_stock, gender,
      season, product_type, synced_at
    )
    select
      b.id, b.network, b.product_name, b.image_url, b.deep_link, b.price, b.rrp,
      b.currency, b.brand_name, b.category_name, b.merchant_name, b.merchant_id,
      b.in_stock, b.gender, b.season, b.product_type, now()
    from batch b
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
      or t.product_type  is distinct from excluded.product_type
    returning 1
  )
  select
    (select max(id) from batch)       as last_id,
    (select count(*) from batch)::int as processed,
    (select count(*) from ins)::int   as changed;
$$;

-- Stale sweep: rows we had in stock, for a merchant present in this feed, that
-- did not appear in staging → out of stock. Scoped to seen merchants so a
-- missing/failed feed never hides a whole merchant's catalogue. Touches few rows
-- (only genuine disappearances), so a single statement is fine.
create or replace function public.sweep_feed_staging(p_network text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_marked integer;
begin
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
  return v_marked;
end;
$$;

grant execute on function public.merge_feed_staging_range(text, text, integer) to service_role;
grant execute on function public.sweep_feed_staging(text) to service_role;

notify pgrst, 'reload schema';
