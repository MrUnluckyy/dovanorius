-- Curated-rebuild prune (P2). Companion to sweep_feed_staging.
--
-- After a curated import stages the collapsed, filtered set, most of the old
-- per-variant rows are no longer represented (curation assigns stable synthetic
-- ids, so a size-run of one product becomes a single 'awc-<hash>' row). sweep
-- would only mark those old rows out of stock — the table would stay ~665k rows
-- / 736 MB. prune DELETES them instead, so the served table becomes exactly the
-- curated staged set.
--
-- Same safety scoping as sweep: only affiliate rows, only for merchants present
-- in this run's staging (a missing/failed feed can't wipe a merchant), and only
-- ids absent from staging. Driven in id-range batches from the importer to stay
-- under the statement timeout.

create or replace function public.prune_feed_staging_range(
  p_network text,
  p_after   text,
  p_batch   integer
)
returns table(last_id text, scanned integer, deleted integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids text[];
  v_del integer;
begin
  -- Next keyset window of affiliate ids for this network.
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
    and t.merchant_id in (
      select distinct s.merchant_id
      from public.inspo_products_staging s
      where s.network = p_network and s.merchant_id is not null
    )
    and not exists (
      select 1 from public.inspo_products_staging s where s.id = t.id
    );
  get diagnostics v_del = row_count;

  last_id := v_ids[array_upper(v_ids, 1)];
  scanned := array_length(v_ids, 1);
  deleted := v_del;
  return next;
end;
$$;

grant execute on function public.prune_feed_staging_range(text, text, integer) to service_role;

notify pgrst, 'reload schema';
