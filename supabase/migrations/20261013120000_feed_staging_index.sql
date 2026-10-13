-- Feed import was ~98% of all database disk IO (1.75 TB read since the
-- pg_stat_statements reset), burning the Disk IO budget every night.
--
-- inspo_products_staging had no index at all. During an import it holds every
-- staged row of a network (hundreds of thousands), and:
--   * merge_feed_staging_range walks it with `network = $1 and id > $2 order by
--     id limit $3` -- a full scan + sort of the whole table per batch;
--   * prune_feed_staging_range re-derived the staged merchant set with a full
--     scan per batch, and its `not exists (... s.id = t.id)` had no index;
--   * sweep_feed_staging had the same not-exists.
-- Thousands of batches a night, each reading the full table.

-- Serves the merge range walk and the per-row existence checks.
create index if not exists inspo_products_staging_network_id_idx
  on public.inspo_products_staging (network, id);

-- The table is truncated and bulk-loaded every run, so it has no statistics
-- mid-import. The importer calls this once staging is loaded.
create or replace function public.analyze_feed_staging()
returns void
language sql
security definer
set search_path = public
as $$ analyze public.inspo_products_staging; $$;

-- The merchants present in staging, computed once per run instead of once per
-- prune batch.
create or replace function public.feed_staging_merchants(p_network text)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct merchant_id), '{}')
  from public.inspo_products_staging
  where network = p_network and merchant_id is not null;
$$;

-- New optional p_merchants: the importer passes the set from
-- feed_staging_merchants(). Without it (an older caller) the set is derived
-- here as before, once per call.
drop function if exists public.prune_feed_staging_range(text, text, integer);
create or replace function public.prune_feed_staging_range(
  p_network text, p_after text, p_batch integer, p_merchants text[] default null
)
returns table(last_id text, scanned integer, deleted integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids text[];
  v_del integer;
  v_merchants text[] := coalesce(p_merchants, public.feed_staging_merchants(p_network));
begin
  select array_agg(id order by id) into v_ids
  from (
    select id
    from public.inspo_products
    where network = p_network and source = 'affiliate' and id > p_after
    order by id
    limit p_batch
  ) s;

  if v_ids is null then
    last_id := null; scanned := 0; deleted := 0;
    return next;
    return;
  end if;

  delete from public.inspo_products t
  where t.id = any(v_ids)
    and t.source = 'affiliate'
    and t.merchant_id = any(v_merchants)
    and not exists (
      -- network first so the (network, id) index serves it
      select 1 from public.inspo_products_staging s
      where s.network = p_network and s.id = t.id
    );
  get diagnostics v_del = row_count;

  last_id := v_ids[array_upper(v_ids, 1)];
  scanned := array_length(v_ids, 1);
  deleted := v_del;
  return next;
end;
$$;

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
     and p.merchant_id = any(public.feed_staging_merchants(p_network))
     and not exists (
       select 1 from public.inspo_products_staging s
       where s.network = p_network and s.id = p.id
     );
  get diagnostics v_marked = row_count;
  return v_marked;
end;
$$;

-- Same lockdown as the functions these replace: service role only.
revoke all on function public.analyze_feed_staging() from public, anon, authenticated;
revoke all on function public.feed_staging_merchants(text) from public, anon, authenticated;
revoke all on function public.prune_feed_staging_range(text, text, integer, text[]) from public, anon, authenticated;
revoke all on function public.sweep_feed_staging(text) from public, anon, authenticated;
grant execute on function public.analyze_feed_staging() to service_role;
grant execute on function public.feed_staging_merchants(text) to service_role;
grant execute on function public.prune_feed_staging_range(text, text, integer, text[]) to service_role;
grant execute on function public.sweep_feed_staging(text) to service_role;
