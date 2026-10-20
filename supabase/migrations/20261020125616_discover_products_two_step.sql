-- discover_products rebuild in two calls (follow-up to the T9 migration).
--
-- The first rebuild through the API took 80 s against service_role's 120 s
-- statement timeout: the scan reads ~180 MB from disk and the copy plus six
-- index builds are IO-bound. That leaves no margin on a busy night, so the
-- work is split into two calls the importers make in turn, each well inside
-- the limit:
--
--   discover_products_load()     empty the inactive table and fill it
--   discover_products_publish()  index it, check it, repoint the view
--
-- Readers stay on the active table throughout; a failed publish just means
-- the next load starts over. rebuild_discover_products() still does both in
-- one transaction for manual SQL use.
--
-- Also fixes the first version's state update, which had no WHERE clause:
-- the API connection loads pg-safeupdate, which refuses that even inside a
-- function.

alter table public.discover_products_state
  add column if not exists building char(1) check (building in ('a', 'b')),
  add column if not exists building_rows integer;

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

-- Both steps in one transaction, for manual use from SQL (no API timeout).
create or replace function public.rebuild_discover_products()
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.discover_products_load();
  return public.discover_products_publish();
end;
$$;

revoke all on function public.discover_products_load() from public, anon, authenticated;
revoke all on function public.discover_products_publish() from public, anon, authenticated;
revoke all on function public.rebuild_discover_products() from public, anon, authenticated;
grant execute on function public.discover_products_load() to service_role;
grant execute on function public.discover_products_publish() to service_role;
grant execute on function public.rebuild_discover_products() to service_role;
